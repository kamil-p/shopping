/**
 * Shared shapes for the offline sync engine, imported by BOTH the server
 * endpoints (`./actions.ts`) and the browser mirror (`@/lib/offline/*`).
 *
 * The model is "timestamp last-write-wins": the client mirrors every domain row
 * in IndexedDB, edits locally (bumping `updatedAt`), and reconciles with the
 * server by pushing changed rows and pulling the server's changes back. Deletes
 * are soft (a non-null `deletedAt` tombstone) so they sync like any other edit.
 */
import type { List, ListItem, Set, SetItem, Store } from "@/db/schema";

/**
 * The five mirrored domain tables. Order matters for push: parents
 * (stores/sets/lists) before children (setItems/listItems), so a freshly
 * created parent exists before its children are upserted.
 */
export const SYNC_TABLES = [
  "stores",
  "sets",
  "lists",
  "setItems",
  "listItems",
] as const;

export type SyncTableName = (typeof SYNC_TABLES)[number];

/** Row type for each mirrored table (exactly the Drizzle row shapes). */
export type SyncRow = {
  stores: Store;
  sets: Set;
  lists: List;
  setItems: SetItem;
  listItems: ListItem;
};

/** A batch of rows keyed by table, used by both pull and push. */
export type SyncPayload = {
  [K in SyncTableName]: SyncRow[K][];
};

export type PullResult = { rows: SyncPayload; serverTime: number };
export type PushResult = { serverTime: number; rejected: string[] };

export function emptyPayload(): SyncPayload {
  return { stores: [], sets: [], lists: [], setItems: [], listItems: [] };
}
