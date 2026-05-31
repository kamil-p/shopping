import { defineConfig } from "drizzle-kit";

const dbPath = process.env.DATABASE_PATH ?? "data/app.db";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: `file:${dbPath}`,
  },
});
