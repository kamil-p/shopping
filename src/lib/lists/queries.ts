import { and, asc, desc, eq, sql } from "drizzle-orm";

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
