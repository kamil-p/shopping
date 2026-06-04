/**
 * Offline mirror of the whole shopping domain (stores, sets, set items, lists,
 * list items), stored in IndexedDB. This is the source of truth WHILE OFFLINE:
 * every screen renders from here and every edit lands here first, then reconciles
 * with the server through the last-write-wins engine in `@/lib/sync` (see
 * `./sync.ts`). The stored shapes are exactly the Drizzle row types, so a `Date`
 * survives the structured clone and rows render with no conversion.
 *
 * Browser-only — every export touches `indexedDB`; call from client components.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { List, ListItem, Set, SetItem, Store } from "@/db/schema";
import { type SyncRow, type SyncTableName } from "@/lib/sync/shared";

export type { SyncTableName };

/** A list plus the progress counts the overview shows. */
export type ListSummary = List & { itemCount: number; checkedCount: number };
/** A set plus its product count. */
export type SetSummary = Set & { itemCount: number };

type DirtyMarker = { key: string; table: SyncTableName; id: string };

interface ShoppingDB extends DBSchema {
  stores: { key: string; value: Store };
  sets: { key: string; value: Set };
  setItems: { key: string; value: SetItem; indexes: { bySet: string } };
  lists: { key: string; value: List };
  listItems: { key: string; value: ListItem; indexes: { byList: string } };
  meta: { key: string; value: unknown };
  dirty: { key: string; value: DirtyMarker };
}

const DB_NAME = "zakupy-offline";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ShoppingDB>> | null = null;

function getDb(): Promise<IDBPDatabase<ShoppingDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable (server)"));
  }
  if (!dbPromise) {
    dbPromise = openDB<ShoppingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // v1 had only lists/listItems/meta/outbox (intent queue). Drop the old
        // stores so the next sync repopulates fresh rows with timestamps.
        const raw = db as unknown as IDBPDatabase;
        for (const name of ["outbox", "lists", "listItems", "meta"]) {
          if (raw.objectStoreNames.contains(name)) raw.deleteObjectStore(name);
        }
        db.createObjectStore("stores", { keyPath: "id" });
        db.createObjectStore("sets", { keyPath: "id" });
        db.createObjectStore("setItems", { keyPath: "id" }).createIndex(
          "bySet",
          "setId",
        );
        db.createObjectStore("lists", { keyPath: "id" });
        db.createObjectStore("listItems", { keyPath: "id" }).createIndex(
          "byList",
          "listId",
        );
        db.createObjectStore("meta");
        db.createObjectStore("dirty", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

// --- Generic row access (used by the sync engine) ---

export async function getAllRows<K extends SyncTableName>(
  table: K,
): Promise<SyncRow[K][]> {
  const db = await getDb();
  return (await db.getAll(table)) as SyncRow[K][];
}

export async function getRow<K extends SyncTableName>(
  table: K,
  id: string,
): Promise<SyncRow[K] | undefined> {
  const db = await getDb();
  return (await db.get(table, id)) as SyncRow[K] | undefined;
}

export async function putRow<K extends SyncTableName>(
  table: K,
  row: SyncRow[K],
): Promise<void> {
  const db = await getDb();
  await db.put(table, row as never);
}

export async function deleteRow(
  table: SyncTableName,
  id: string,
): Promise<void> {
  const db = await getDb();
  await db.delete(table, id);
}

// --- Dirty markers (rows changed locally, awaiting push) ---

export async function markDirty(
  table: SyncTableName,
  id: string,
): Promise<void> {
  const db = await getDb();
  await db.put("dirty", { key: `${table}:${id}`, table, id });
}

export async function getDirty(): Promise<DirtyMarker[]> {
  const db = await getDb();
  return db.getAll("dirty");
}

export async function clearDirty(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("dirty", "readwrite");
  for (const key of keys) void tx.store.delete(key);
  await tx.done;
}

// --- Meta (sync watermark) ---

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return (await db.get("meta", key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("meta", value, key);
}

// --- Optimistic local writes (callers stamp updatedAt before calling) ---

/** Persist a locally-edited row and queue it for the next push. */
export async function saveLocal<K extends SyncTableName>(
  table: K,
  row: SyncRow[K],
): Promise<void> {
  await putRow(table, row);
  await markDirty(table, (row as { id: string }).id);
}

/** Soft-delete: stamp `deletedAt`/`updatedAt`, persist, and queue for push. */
export async function softDeleteLocal(
  table: SyncTableName,
  id: string,
): Promise<void> {
  const row = await getRow(table, id);
  if (!row) return;
  const now = new Date();
  (row as { deletedAt: Date | null }).deletedAt = now;
  (row as { updatedAt: Date }).updatedAt = now;
  await putRow(table, row);
  await markDirty(table, id);
}

/**
 * Soft-delete a set together with its items, queuing every tombstoned row for
 * sync. Tombstoning the items too keeps them from lingering as orphans (and lets
 * the server's tombstone TTL clean them up). Lists made from the set are
 * untouched — they snapshot their data, with no FK back to the set.
 */
export async function softDeleteSet(setId: string): Promise<void> {
  await softDeleteLocal("sets", setId);
  for (const item of await getAllRows("setItems")) {
    if (item.setId === setId && item.deletedAt == null) {
      await softDeleteLocal("setItems", item.id);
    }
  }
}

/**
 * Clear every reference to a (just deleted) store: null `defaultStoreId` on sets
 * and `storeId` on set items that point at it, queuing those rows for sync.
 * Lists are unaffected — they snapshot the store name as plain text.
 */
export async function nullStoreReferences(storeId: string): Promise<void> {
  const now = new Date();
  for (const set of await getAllRows("sets")) {
    if (set.defaultStoreId === storeId) {
      await saveLocal("sets", { ...set, defaultStoreId: null, updatedAt: now });
    }
  }
  for (const item of await getAllRows("setItems")) {
    if (item.storeId === storeId) {
      await saveLocal("setItems", { ...item, storeId: null, updatedAt: now });
    }
  }
}

// --- Domain reads (mirror the server queries, but from IndexedDB) ---

const alive = <T extends { deletedAt: Date | null }>(r: T) => r.deletedAt == null;
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "pl");

/** Active lists with progress counts, newest first. */
export async function readAllLists(): Promise<ListSummary[]> {
  const db = await getDb();
  const [allLists, allItems] = await Promise.all([
    db.getAll("lists"),
    db.getAll("listItems"),
  ]);
  const counts = new Map<string, { itemCount: number; checkedCount: number }>();
  for (const item of allItems) {
    if (!alive(item)) continue;
    const c = counts.get(item.listId) ?? { itemCount: 0, checkedCount: 0 };
    c.itemCount += 1;
    if (item.checked) c.checkedCount += 1;
    counts.set(item.listId, c);
  }
  return allLists
    .filter(alive)
    .map((list) => ({
      ...list,
      itemCount: counts.get(list.id)?.itemCount ?? 0,
      checkedCount: counts.get(list.id)?.checkedCount ?? 0,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** One list with its ordered items, or null if missing/deleted. */
export async function readListWithItems(
  listId: string,
): Promise<{ list: List; items: ListItem[] } | null> {
  const db = await getDb();
  const list = await db.get("lists", listId);
  if (!list || !alive(list)) return null;
  const items = (await db.getAllFromIndex("listItems", "byList", listId))
    .filter(alive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return { list, items };
}

/** All sets with product counts, alphabetical. */
export async function readAllSets(): Promise<SetSummary[]> {
  const db = await getDb();
  const [allSets, allItems] = await Promise.all([
    db.getAll("sets"),
    db.getAll("setItems"),
  ]);
  const counts = new Map<string, number>();
  for (const item of allItems) {
    if (!alive(item)) continue;
    counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
  }
  return allSets
    .filter(alive)
    .map((set) => ({ ...set, itemCount: counts.get(set.id) ?? 0 }))
    .sort(byName);
}

/** One set with its ordered items and the user's stores, or null if missing/deleted. */
export async function readSetWithItems(
  setId: string,
): Promise<{ set: Set; items: SetItem[]; stores: Store[] } | null> {
  const db = await getDb();
  const set = await db.get("sets", setId);
  if (!set || !alive(set)) return null;
  const [items, allStores] = await Promise.all([
    db.getAllFromIndex("setItems", "bySet", setId),
    db.getAll("stores"),
  ]);
  return {
    set,
    items: items.filter(alive).sort((a, b) => a.sortOrder - b.sortOrder),
    stores: allStores.filter(alive).sort(byName),
  };
}

/** The user's store catalog, alphabetical. */
export async function readAllStores(): Promise<Store[]> {
  const db = await getDb();
  return (await db.getAll("stores")).filter(alive).sort(byName);
}
