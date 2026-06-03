import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { listItems, lists, type List, type ListItem } from "@/db/schema";

export type ListSummary = List & { itemCount: number; checkedCount: number };

export type ListWithItems = { list: List; items: ListItem[] };

/** A user's active (non-archived) lists, newest first, with progress counts. */
export function listActiveLists(userId: string): Promise<ListSummary[]> {
  return db
    .select({
      id: lists.id,
      userId: lists.userId,
      setId: lists.setId,
      name: lists.name,
      status: lists.status,
      createdAt: lists.createdAt,
      itemCount: sql<number>`count(${listItems.id})`.mapWith(Number),
      checkedCount: sql<number>`coalesce(sum(${listItems.checked}), 0)`.mapWith(
        Number,
      ),
    })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .where(and(eq(lists.userId, userId), eq(lists.status, "active")))
    .groupBy(lists.id)
    .orderBy(desc(lists.createdAt))
    .all();
}

/** A single list (ownership-scoped) with its ordered items. */
export async function getListWithItems(
  listId: string,
  userId: string,
): Promise<ListWithItems | null> {
  const list = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)))
    .get();

  if (!list) return null;

  const items = await db
    .select()
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.sortOrder))
    .all();

  return { list, items };
}

/**
 * All of a user's active lists plus a flat array of their items, in one payload.
 * Used to warm the offline mirror (IndexedDB) so every active list is available
 * without a network round-trip. See `src/lib/offline/`.
 */
export async function selectActiveListsSnapshot(
  userId: string,
): Promise<{ lists: List[]; items: ListItem[] }> {
  const activeLists = await db
    .select()
    .from(lists)
    .where(and(eq(lists.userId, userId), eq(lists.status, "active")))
    .orderBy(desc(lists.createdAt))
    .all();

  if (activeLists.length === 0) return { lists: [], items: [] };

  const items = await db
    .select()
    .from(listItems)
    .where(
      inArray(
        listItems.listId,
        activeLists.map((l) => l.id),
      ),
    )
    .orderBy(asc(listItems.sortOrder))
    .all();

  return { lists: activeLists, items };
}
