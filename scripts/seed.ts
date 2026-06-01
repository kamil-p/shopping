/**
 * Seed demo data for a user (so the editor has realistic content).
 *
 *   pnpm db:seed <email>
 *
 * Idempotent: skips if the demo "Warzywa" set already exists for the user.
 */
import { and, eq } from "drizzle-orm";

import { db } from "../src/db";
import { setItems, sets, stores, users } from "../src/db/schema";
import { normalizeEmail } from "../src/lib/auth/credentials";

async function main() {
  const [argEmail] = process.argv.slice(2);
  if (!argEmail) {
    console.error("Usage: pnpm db:seed <email>");
    process.exit(1);
  }

  const email = normalizeEmail(argEmail.trim());
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user) {
    console.error(`❌ No user with email "${email}". Create one first.`);
    process.exit(1);
  }

  const existing = await db
    .select({ id: sets.id })
    .from(sets)
    .where(and(eq(sets.userId, user.id), eq(sets.name, "Warzywa")))
    .get();

  if (existing) {
    console.log("ℹ️  Demo data already present — skipping.");
    process.exit(0);
  }

  const warzywniak = await db
    .insert(stores)
    .values({ userId: user.id, name: "Warzywniak" })
    .returning()
    .get();
  const allegro = await db
    .insert(stores)
    .values({ userId: user.id, name: "Allegro", url: "https://allegro.pl" })
    .returning()
    .get();
  await db
    .insert(stores)
    .values({ userId: user.id, name: "Biedronka" })
    .run();

  const set = await db
    .insert(sets)
    .values({
      userId: user.id,
      name: "Warzywa",
      icon: "🥦",
      defaultStoreId: warzywniak.id,
    })
    .returning()
    .get();

  const products: Array<[string, string | null]> = [
    ["Pomidory", null],
    ["Ogórki", null],
    ["Orzechy", allegro.id],
    ["Sałata", null],
    ["Papryka", null],
  ];

  await db.insert(setItems).values(
    products.map(([name, storeId], index) => ({
      setId: set.id,
      name,
      storeId,
      sortOrder: (index + 1) * 10,
    })),
  );

  console.log(`✅ Seeded demo set „Warzywa" for ${email}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
