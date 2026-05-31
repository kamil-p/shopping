/**
 * Create a new user.
 *
 *   pnpm create-user <email> <password>   # non-interactive
 *   pnpm create-user                       # interactive prompts (password hidden)
 */
import { input, password as passwordPrompt } from "@inquirer/prompts";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { users } from "../src/db/schema";
import { credentialsSchema, normalizeEmail } from "../src/lib/auth/credentials";
import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const [argEmail, argPassword] = process.argv.slice(2);

  const email = argEmail ?? (await input({ message: "Email:" }));
  const password =
    argPassword ??
    (await passwordPrompt({ message: "Password (min 8 chars):", mask: "*" }));

  const parsed = credentialsSchema.safeParse({
    email: email?.trim(),
    password,
  });

  if (!parsed.success) {
    console.error(
      "❌ " + parsed.error.issues.map((issue) => issue.message).join("; "),
    );
    process.exit(1);
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .get();

  if (existing) {
    console.error(`❌ A user with email "${normalizedEmail}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const created = await db
    .insert(users)
    .values({ email: normalizedEmail, passwordHash })
    .returning({ id: users.id, email: users.email })
    .get();

  console.log(`✅ Created user ${created.email} (id: ${created.id})`);
  process.exit(0);
}

main().catch((error) => {
  // Inquirer throws on Ctrl-C; treat as a clean cancel.
  if (error instanceof Error && error.name === "ExitPromptError") {
    process.exit(130);
  }
  console.error(error);
  process.exit(1);
});
