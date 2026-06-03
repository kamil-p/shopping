"use server";

import { and, asc, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  listItems,
  lists,
  setItems,
  sets,
  stores,
  type List,
  type ListItem,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import { selectActiveListsSnapshot } from "@/lib/lists/queries";

const itemNameSchema = z.string().trim().min(1, "Podaj nazwę").max(120);

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

  // The list's date is shown separately (from createdAt), so the name is just
  // the set name — no date suffix.
  const listName = name?.trim() || set.name;

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

/** Throws unless the list exists and belongs to the user. */
async function ownedList(listId: string, userId: string): Promise<void> {
  const row = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)))
    .get();
  if (!row) throw new Error("Lista nie istnieje");
}

/**
 * Add an ad-hoc item to a list. Lists are standalone snapshots, so this only
 * inserts into list_items — the source set is never touched. The item has no
 * store (lands in the "Bez sklepu" group) and is appended to the end.
 */
export async function addListItem(
  listId: string,
  name: string,
): Promise<ListItem> {
  const user = await requireUser();
  await ownedList(listId, user.id);

  const parsed = itemNameSchema.safeParse(name);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Nieprawidłowa nazwa");
  }

  const top = await db
    .select({ value: max(listItems.sortOrder) })
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .get();

  const created = await db
    .insert(listItems)
    .values({
      listId,
      name: parsed.data,
      storeName: null,
      sortOrder: (top?.value ?? 0) + 10,
    })
    .returning()
    .get();

  revalidatePath(`/lists/${listId}`);
  revalidatePath("/lists");
  return created;
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

/**
 * Snapshot of all the current user's active lists + items, for warming the
 * offline mirror. Auth flows through the `session` cookie that Server Actions
 * attach automatically, so the same call works for the initial pull AND for the
 * post-reconnect refresh.
 */
export async function getActiveListsSnapshot(): Promise<{
  lists: List[];
  items: ListItem[];
}> {
  const user = await requireUser();
  return selectActiveListsSnapshot(user.id);
}

export async function deleteList(listId: string): Promise<void> {
  const user = await requireUser();
  await db
    .delete(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, user.id)))
    .run();
  revalidatePath("/lists");
}
