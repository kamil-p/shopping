"use server";

import { and, eq, max } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { setItems, sets, stores, type Set, type SetItem } from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";

const nameSchema = z.string().trim().min(1, "Podaj nazwę").max(120);

function cleanName(value: string): string {
  const result = nameSchema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Nieprawidłowa nazwa");
  }
  return result.data;
}

/** Throws unless the set exists and belongs to the user. */
async function ownedSet(setId: string, userId: string): Promise<Set> {
  const set = await db
    .select()
    .from(sets)
    .where(and(eq(sets.id, setId), eq(sets.userId, userId)))
    .get();
  if (!set) throw new Error("Zestaw nie istnieje");
  return set;
}

/** Throws unless the item exists and its set belongs to the user. */
async function ownedItem(itemId: string, userId: string): Promise<SetItem> {
  const row = await db
    .select({ item: setItems })
    .from(setItems)
    .innerJoin(sets, eq(setItems.setId, sets.id))
    .where(and(eq(setItems.id, itemId), eq(sets.userId, userId)))
    .get();
  if (!row) throw new Error("Produkt nie istnieje");
  return row.item;
}

/** Throws unless the store exists and belongs to the user. */
async function assertStoreOwned(storeId: string, userId: string): Promise<void> {
  const store = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.id, storeId), eq(stores.userId, userId)))
    .get();
  if (!store) throw new Error("Sklep nie istnieje");
}

/** Create an empty set and open its editor. Usable directly as a <form action>. */
export async function createSet(): Promise<void> {
  const user = await requireUser();
  const created = await db
    .insert(sets)
    .values({ userId: user.id, name: "Nowy zestaw" })
    .returning({ id: sets.id })
    .get();

  revalidatePath("/sets");
  redirect(`/sets/${created.id}`);
}

export async function renameSet(setId: string, name: string): Promise<void> {
  const user = await requireUser();
  await ownedSet(setId, user.id);
  await db
    .update(sets)
    .set({ name: cleanName(name), updatedAt: new Date() })
    .where(eq(sets.id, setId))
    .run();
  revalidatePath(`/sets/${setId}`);
  revalidatePath("/sets");
}

export async function setSetIcon(setId: string, icon: string): Promise<void> {
  const user = await requireUser();
  await ownedSet(setId, user.id);
  const clean = icon.trim().slice(0, 8) || "🧺";
  await db
    .update(sets)
    .set({ icon: clean, updatedAt: new Date() })
    .where(eq(sets.id, setId))
    .run();
  revalidatePath(`/sets/${setId}`);
  revalidatePath("/sets");
}

export async function setDefaultStore(
  setId: string,
  storeId: string | null,
): Promise<void> {
  const user = await requireUser();
  await ownedSet(setId, user.id);
  if (storeId) await assertStoreOwned(storeId, user.id);
  await db
    .update(sets)
    .set({ defaultStoreId: storeId, updatedAt: new Date() })
    .where(eq(sets.id, setId))
    .run();
  revalidatePath(`/sets/${setId}`);
}

export async function deleteSet(setId: string): Promise<void> {
  const user = await requireUser();
  await ownedSet(setId, user.id);
  await db.delete(sets).where(eq(sets.id, setId)).run();
  revalidatePath("/sets");
}

export async function addSetItem(
  setId: string,
  name: string,
): Promise<SetItem> {
  const user = await requireUser();
  await ownedSet(setId, user.id);

  const last = await db
    .select({ max: max(setItems.sortOrder) })
    .from(setItems)
    .where(eq(setItems.setId, setId))
    .get();
  const sortOrder = (last?.max ?? 0) + 10;

  const item = await db
    .insert(setItems)
    .values({ setId, name: cleanName(name), sortOrder })
    .returning()
    .get();

  revalidatePath(`/sets/${setId}`);
  revalidatePath("/sets");
  return item;
}

export async function renameSetItem(
  itemId: string,
  name: string,
): Promise<void> {
  const user = await requireUser();
  const item = await ownedItem(itemId, user.id);
  await db
    .update(setItems)
    .set({ name: cleanName(name) })
    .where(eq(setItems.id, itemId))
    .run();
  revalidatePath(`/sets/${item.setId}`);
}

export async function setItemStore(
  itemId: string,
  storeId: string | null,
): Promise<void> {
  const user = await requireUser();
  const item = await ownedItem(itemId, user.id);
  if (storeId) await assertStoreOwned(storeId, user.id);
  await db
    .update(setItems)
    .set({ storeId })
    .where(eq(setItems.id, itemId))
    .run();
  revalidatePath(`/sets/${item.setId}`);
}

export async function deleteSetItem(itemId: string): Promise<void> {
  const user = await requireUser();
  const item = await ownedItem(itemId, user.id);
  await db.delete(setItems).where(eq(setItems.id, itemId)).run();
  revalidatePath(`/sets/${item.setId}`);
  revalidatePath("/sets");
}

/** Persist a new order. orderedIds must be the full set of item ids for the set. */
export async function reorderSetItems(
  setId: string,
  orderedIds: string[],
): Promise<void> {
  const user = await requireUser();
  await ownedSet(setId, user.id);

  const existing = await db
    .select({ id: setItems.id })
    .from(setItems)
    .where(eq(setItems.setId, setId))
    .all();
  const valid = new Set(existing.map((r) => r.id));
  const ids = orderedIds.filter((id) => valid.has(id));

  for (let i = 0; i < ids.length; i++) {
    await db
      .update(setItems)
      .set({ sortOrder: (i + 1) * 10 })
      .where(and(eq(setItems.id, ids[i]), eq(setItems.setId, setId)))
      .run();
  }

  revalidatePath(`/sets/${setId}`);
}
