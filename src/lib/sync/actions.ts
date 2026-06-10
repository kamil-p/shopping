"use server";

import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { listItems, lists, setItems, sets, stores } from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import type { PullResult, PushResult, SyncPayload } from "@/lib/sync/shared";

// Mirror the per-field rules the granular actions enforce, so a synced row can
// never fail server validation differently than it would interactively.
const nameSchema = z.string().trim().min(1).max(120);
const storeNameSchema = z.string().trim().min(1).max(80);

// Tombstones older than this are physically deleted (every device has synced by
// then). Purged opportunistically on each push — no cron needed.
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Re-pull a small overlap window so a row written in the same second as the last
// pull's cursor is never missed; applying a row twice is idempotent (LWW).
const PULL_OVERLAP_MS = 2000;

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Everything the user owns that changed since `since` (a previous `serverTime`),
 * tombstones included. With no `since`, returns the full dataset (initial pull).
 */
export async function pullChanges(since?: number): Promise<PullResult> {
  const user = await requireUser();
  const sinceDate =
    typeof since === "number" ? new Date(since - PULL_OVERLAP_MS) : null;

  const [storeRows, setRows, listRows, setItemRows, listItemRows] =
    await Promise.all([
      db
        .select()
        .from(stores)
        .where(
          and(
            eq(stores.userId, user.id),
            sinceDate ? gt(stores.updatedAt, sinceDate) : undefined,
          ),
        )
        .all(),
      db
        .select()
        .from(sets)
        .where(
          and(
            eq(sets.userId, user.id),
            sinceDate ? gt(sets.updatedAt, sinceDate) : undefined,
          ),
        )
        .all(),
      db
        .select()
        .from(lists)
        .where(
          and(
            eq(lists.userId, user.id),
            sinceDate ? gt(lists.updatedAt, sinceDate) : undefined,
          ),
        )
        .all(),
      db
        .select({ item: setItems })
        .from(setItems)
        .innerJoin(sets, eq(setItems.setId, sets.id))
        .where(
          and(
            eq(sets.userId, user.id),
            sinceDate ? gt(setItems.updatedAt, sinceDate) : undefined,
          ),
        )
        .all(),
      db
        .select({ item: listItems })
        .from(listItems)
        .innerJoin(lists, eq(listItems.listId, lists.id))
        .where(
          and(
            eq(lists.userId, user.id),
            sinceDate ? gt(listItems.updatedAt, sinceDate) : undefined,
          ),
        )
        .all(),
    ]);

  return {
    rows: {
      stores: storeRows,
      sets: setRows,
      lists: listRows,
      setItems: setItemRows.map((r) => r.item),
      listItems: listItemRows.map((r) => r.item),
    },
    serverTime: Date.now(),
  };
}

/**
 * Apply a batch of locally-changed rows with per-row last-write-wins: a row is
 * written only when the incoming `updatedAt` is newer than the stored one AND
 * the row belongs to the user. New rows carry a client-minted id, so the upsert
 * is idempotent. Rows that fail validation are reported in `rejected` and skip
 * (one bad row never blocks the batch).
 */
export async function pushChanges(
  payload: Partial<SyncPayload>,
): Promise<PushResult> {
  const user = await requireUser();
  const rejected: string[] = [];

  // --- Parents (userId is forced server-side; never trusted from the client) ---
  for (const row of payload.stores ?? []) {
    const name = storeNameSchema.safeParse(row.name);
    const updatedAt = toDate(row.updatedAt);
    if (!name.success || !updatedAt) {
      rejected.push(row.id);
      continue;
    }
    const url =
      typeof row.url === "string" ? row.url.trim().slice(0, 500) || null : null;
    const deletedAt = toDate(row.deletedAt);
    await db
      .insert(stores)
      .values({
        id: row.id,
        userId: user.id,
        name: name.data,
        url,
        createdAt: toDate(row.createdAt) ?? updatedAt,
        updatedAt,
        deletedAt,
      })
      .onConflictDoUpdate({
        target: stores.id,
        set: { name: name.data, url, updatedAt, deletedAt },
        setWhere: and(lt(stores.updatedAt, updatedAt), eq(stores.userId, user.id)),
      })
      .run();
  }

  for (const row of payload.sets ?? []) {
    const name = nameSchema.safeParse(row.name);
    const updatedAt = toDate(row.updatedAt);
    if (!name.success || !updatedAt) {
      rejected.push(row.id);
      continue;
    }
    const icon =
      (typeof row.icon === "string" ? row.icon.trim().slice(0, 8) : "") || "🧺";
    const defaultStoreId =
      typeof row.defaultStoreId === "string" ? row.defaultStoreId : null;
    const deletedAt = toDate(row.deletedAt);
    await db
      .insert(sets)
      .values({
        id: row.id,
        userId: user.id,
        name: name.data,
        icon,
        defaultStoreId,
        createdAt: toDate(row.createdAt) ?? updatedAt,
        updatedAt,
        deletedAt,
      })
      .onConflictDoUpdate({
        target: sets.id,
        set: { name: name.data, icon, defaultStoreId, updatedAt, deletedAt },
        setWhere: and(lt(sets.updatedAt, updatedAt), eq(sets.userId, user.id)),
      })
      .run();
  }

  for (const row of payload.lists ?? []) {
    const name = nameSchema.safeParse(row.name);
    const updatedAt = toDate(row.updatedAt);
    if (!name.success || !updatedAt) {
      rejected.push(row.id);
      continue;
    }
    const setId = typeof row.setId === "string" ? row.setId : null;
    const storeName =
      typeof row.storeName === "string"
        ? row.storeName.trim().slice(0, 120) || null
        : null;
    const deletedAt = toDate(row.deletedAt);
    await db
      .insert(lists)
      .values({
        id: row.id,
        userId: user.id,
        setId,
        name: name.data,
        storeName,
        createdAt: toDate(row.createdAt) ?? updatedAt,
        updatedAt,
        deletedAt,
      })
      .onConflictDoUpdate({
        target: lists.id,
        set: { name: name.data, setId, storeName, updatedAt, deletedAt },
        setWhere: and(lt(lists.updatedAt, updatedAt), eq(lists.userId, user.id)),
      })
      .run();
  }

  // --- Children: scope by parents owned NOW (includes parents just inserted) ---
  const ownedSetIds = (
    await db.select({ id: sets.id }).from(sets).where(eq(sets.userId, user.id)).all()
  ).map((r) => r.id);
  const ownedListIds = (
    await db.select({ id: lists.id }).from(lists).where(eq(lists.userId, user.id)).all()
  ).map((r) => r.id);
  const ownedSets = new Set(ownedSetIds);
  const ownedLists = new Set(ownedListIds);

  for (const row of payload.setItems ?? []) {
    const name = nameSchema.safeParse(row.name);
    const updatedAt = toDate(row.updatedAt);
    if (!name.success || !updatedAt) {
      rejected.push(row.id);
      continue;
    }
    if (typeof row.setId !== "string" || !ownedSets.has(row.setId)) {
      rejected.push(row.id);
      continue;
    }
    const storeId = typeof row.storeId === "string" ? row.storeId : null;
    const sortOrder = Number.isFinite(row.sortOrder) ? Number(row.sortOrder) : 0;
    const deletedAt = toDate(row.deletedAt);
    await db
      .insert(setItems)
      .values({
        id: row.id,
        setId: row.setId,
        name: name.data,
        storeId,
        sortOrder,
        createdAt: toDate(row.createdAt) ?? updatedAt,
        updatedAt,
        deletedAt,
      })
      .onConflictDoUpdate({
        target: setItems.id,
        set: { name: name.data, storeId, sortOrder, updatedAt, deletedAt },
        // Guard against id-collision hijacks: only touch rows whose existing
        // parent is owned by the user.
        setWhere: and(
          lt(setItems.updatedAt, updatedAt),
          inArray(setItems.setId, ownedSetIds),
        ),
      })
      .run();
  }

  for (const row of payload.listItems ?? []) {
    const name = nameSchema.safeParse(row.name);
    const updatedAt = toDate(row.updatedAt);
    if (!name.success || !updatedAt) {
      rejected.push(row.id);
      continue;
    }
    if (typeof row.listId !== "string" || !ownedLists.has(row.listId)) {
      rejected.push(row.id);
      continue;
    }
    const storeName =
      typeof row.storeName === "string" ? row.storeName.slice(0, 120) : null;
    const sortOrder = Number.isFinite(row.sortOrder) ? Number(row.sortOrder) : 0;
    const deletedAt = toDate(row.deletedAt);
    await db
      .insert(listItems)
      .values({
        id: row.id,
        listId: row.listId,
        name: name.data,
        storeName,
        checked: !!row.checked,
        sortOrder,
        createdAt: toDate(row.createdAt) ?? updatedAt,
        updatedAt,
        deletedAt,
      })
      .onConflictDoUpdate({
        target: listItems.id,
        set: {
          name: name.data,
          storeName,
          checked: !!row.checked,
          sortOrder,
          updatedAt,
          deletedAt,
        },
        setWhere: and(
          lt(listItems.updatedAt, updatedAt),
          inArray(listItems.listId, ownedListIds),
        ),
      })
      .run();
  }

  await purgeTombstones();
  return { serverTime: Date.now(), rejected };
}

/** Physically delete rows tombstoned longer than the TTL (children first). */
async function purgeTombstones(): Promise<void> {
  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_MS);
  await db.delete(listItems).where(lt(listItems.deletedAt, cutoff)).run();
  await db.delete(setItems).where(lt(setItems.deletedAt, cutoff)).run();
  await db.delete(lists).where(lt(lists.deletedAt, cutoff)).run();
  await db.delete(sets).where(lt(sets.deletedAt, cutoff)).run();
  await db.delete(stores).where(lt(stores.deletedAt, cutoff)).run();
}
