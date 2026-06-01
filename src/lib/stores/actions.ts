"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { stores, type Store } from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";

const storeSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę sklepu").max(80),
  url: z.string().trim().max(500).optional(),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Nieprawidłowe dane");
  }
  return result.data;
}

export async function addStore(input: {
  name: string;
  url?: string;
}): Promise<Store> {
  const user = await requireUser();
  const { name, url } = parse(storeSchema, input);

  const store = await db
    .insert(stores)
    .values({ userId: user.id, name, url: url ? url : null })
    .returning()
    .get();

  revalidatePath("/stores");
  return store;
}

export async function renameStore(id: string, name: string): Promise<void> {
  const user = await requireUser();
  const { name: clean } = parse(storeSchema.pick({ name: true }), { name });

  await db
    .update(stores)
    .set({ name: clean, updatedAt: new Date() })
    .where(and(eq(stores.id, id), eq(stores.userId, user.id)))
    .run();

  revalidatePath("/stores");
}

export async function deleteStore(id: string): Promise<void> {
  const user = await requireUser();
  // FK onDelete: "set null" clears defaultStoreId on sets and storeId on set_items.
  await db
    .delete(stores)
    .where(and(eq(stores.id, id), eq(stores.userId, user.id)))
    .run();

  revalidatePath("/stores");
}
