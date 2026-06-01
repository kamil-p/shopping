"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { listItems, lists, setItems, sets, stores } from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Create a shopping list as a SNAPSHOT of a set's products.
 * The set is left untouched; store names are copied as text so later edits to
 * the set or store catalog never mutate an existing list.
 */
export async function createListFromSet(
  setId: string,
  name?: string,
): Promise<{ id: string }> {
  const user = await requireUser();

  const set = await db
    .select()
    .from(sets)
    .where(and(eq(sets.id, setId), eq(sets.userId, user.id)))
    .get();
  if (!set) throw new Error("Zestaw nie istnieje");

  const items = await db
    .select()
    .from(setItems)
    .where(eq(setItems.setId, setId))
    .orderBy(asc(setItems.sortOrder))
    .all();

  const userStores = await db
    .select()
    .from(stores)
    .where(eq(stores.userId, user.id))
    .all();
  const storeName = new Map(userStores.map((s) => [s.id, s.name]));
  const defaultName = set.defaultStoreId
    ? (storeName.get(set.defaultStoreId) ?? null)
    : null;

  const listName =
    name?.trim() ||
    `${set.name} — ${new Date().toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    })}`;

  const list = await db
    .insert(lists)
    .values({ userId: user.id, setId: set.id, name: listName })
    .returning({ id: lists.id })
    .get();

  if (items.length > 0) {
    await db.insert(listItems).values(
      items.map((item, index) => ({
        listId: list.id,
        name: item.name,
        storeName: item.storeId
          ? (storeName.get(item.storeId) ?? defaultName)
          : defaultName,
        sortOrder: (index + 1) * 10,
      })),
    );
  }

  revalidatePath("/lists");
  return { id: list.id };
}

/** Returns the parent list id (ownership-scoped) for a list item, or throws. */
async function ownedListItem(itemId: string, userId: string): Promise<string> {
  const row = await db
    .select({ listId: listItems.listId })
    .from(listItems)
    .innerJoin(lists, eq(listItems.listId, lists.id))
    .where(and(eq(listItems.id, itemId), eq(lists.userId, userId)))
    .get();
  if (!row) throw new Error("Pozycja nie istnieje");
  return row.listId;
}

export async function toggleListItem(
  itemId: string,
  checked: boolean,
): Promise<void> {
  const user = await requireUser();
  const listId = await ownedListItem(itemId, user.id);
  await db
    .update(listItems)
    .set({ checked })
    .where(eq(listItems.id, itemId))
    .run();
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/lists");
}

export async function archiveList(listId: string): Promise<void> {
  const user = await requireUser();
  await db
    .update(lists)
    .set({ status: "archived" })
    .where(and(eq(lists.id, listId), eq(lists.userId, user.id)))
    .run();
  revalidatePath("/lists");
}

export async function deleteList(listId: string): Promise<void> {
  const user = await requireUser();
  await db
    .delete(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, user.id)))
    .run();
  revalidatePath("/lists");
}
