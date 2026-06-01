import { and, asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  setItems,
  sets,
  stores,
  type Set,
  type SetItem,
  type Store,
} from "@/db/schema";

export type SetSummary = Set & { itemCount: number };

export type SetWithItems = {
  set: Set;
  items: SetItem[];
  stores: Store[];
};

/** All of a user's sets with their product counts, alphabetical. */
export function listSets(userId: string): Promise<SetSummary[]> {
  return db
    .select({
      id: sets.id,
      userId: sets.userId,
      name: sets.name,
      icon: sets.icon,
      defaultStoreId: sets.defaultStoreId,
      createdAt: sets.createdAt,
      updatedAt: sets.updatedAt,
      itemCount: count(setItems.id),
    })
    .from(sets)
    .leftJoin(setItems, eq(setItems.setId, sets.id))
    .where(eq(sets.userId, userId))
    .groupBy(sets.id)
    .orderBy(asc(sets.name))
    .all();
}

/** A single set (ownership-scoped) with its ordered items and the user's stores. */
export async function getSetWithItems(
  setId: string,
  userId: string,
): Promise<SetWithItems | null> {
  const set = await db
    .select()
    .from(sets)
    .where(and(eq(sets.id, setId), eq(sets.userId, userId)))
    .get();

  if (!set) return null;

  const [items, userStores] = await Promise.all([
    db
      .select()
      .from(setItems)
      .where(eq(setItems.setId, setId))
      .orderBy(asc(setItems.sortOrder))
      .all(),
    db
      .select()
      .from(stores)
      .where(eq(stores.userId, userId))
      .orderBy(asc(stores.name))
      .all(),
  ]);

  return { set, items, stores: userStores };
}
