import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH ?? "data/app.db";

function createConnection(): Client {
  mkdirSync(dirname(dbPath), { recursive: true });
  return createClient({ url: `file:${dbPath}` });
}

// Reuse a single client across hot reloads in development.
const globalForDb = globalThis as unknown as {
  __libsql?: Client;
};

const client = globalForDb.__libsql ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__libsql = client;
}

export const db = drizzle(client, { schema });
export { schema };
