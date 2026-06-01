import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { stores, type Store } from "@/db/schema";

/** All stores in the user's catalog, alphabetical. */
export function listStores(userId: string): Promise<Store[]> {
  return db
    .select()
    .from(stores)
    .where(eq(stores.userId, userId))
    .orderBy(asc(stores.name))
    .all();
}
