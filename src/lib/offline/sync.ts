/**
 * Sync bridge between the IndexedDB mirror and the server. Always PUSH local
 * changes before PULLing the server's, so a pull never overwrites an edit that
 * hasn't reached the server yet. Reconciliation is per-row last-write-wins by
 * `updatedAt`. Browser-only — calls the `@/lib/sync` Server Actions, which carry
 * the session cookie automatically.
 */
import { pullChanges, pushChanges } from "@/lib/sync/actions";
import { SYNC_TABLES, emptyPayload } from "@/lib/sync/shared";
import {
  clearDirty,
  deleteRow,
  getDirty,
  getMeta,
  getRow,
  putRow,
  setMeta,
} from "@/lib/offline/db";
import { isOnline } from "@/lib/offline/offline-mode";

function timeOf(value: Date | null): number {
  return value ? value.getTime() : 0;
}

let syncing = false;

/**
 * Replay every locally-changed row to the server. Markers clear on success;
 * rows the server rejected (validation) stay queued. Returns true if anything
 * was sent.
 */
export async function pushLocal(): Promise<boolean> {
  if (!isOnline()) return false;
  const dirty = await getDirty();
  if (dirty.length === 0) return false;

  const payload = emptyPayload();
  for (const marker of dirty) {
    const row = await getRow(marker.table, marker.id);
    if (row) (payload[marker.table] as unknown[]).push(row);
  }

  const { rejected } = await pushChanges(payload);
  const rejectedIds = new Set(rejected);
  await clearDirty(
    dirty.filter((m) => !rejectedIds.has(m.id)).map((m) => m.key),
  );
  return true;
}

/**
 * Pull the server's changes since the last cursor and merge them per-row by
 * last-write-wins, never clobbering a row that's still dirty locally. A pulled
 * tombstone drops the row from the mirror.
 */
export async function pullRemote(): Promise<boolean> {
  if (!isOnline()) return false;
  const since = await getMeta<number>("lastSyncedAt");
  const { rows, serverTime } = await pullChanges(since);

  const dirty = new Set((await getDirty()).map((m) => m.key));
  for (const table of SYNC_TABLES) {
    for (const row of rows[table] ?? []) {
      const key = `${table}:${row.id}`;
      if (dirty.has(key)) continue; // unsynced local edit wins until pushed
      const existing = await getRow(table, row.id);
      if (existing && timeOf(row.updatedAt) < timeOf(existing.updatedAt)) {
        continue; // local copy is newer
      }
      if (row.deletedAt != null) {
        if (existing) await deleteRow(table, row.id);
      } else {
        await putRow(table, row);
      }
    }
  }

  await setMeta("lastSyncedAt", serverTime);
  return true;
}

/**
 * Full reconcile: push then pull. Safe to call on app start, on `online`, and on
 * tab focus; no-ops gracefully when offline (the dirty queue is durable).
 */
export async function syncNow(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    await pushLocal();
    await pullRemote();
  } catch {
    // Offline / auth bounce / transient — local state stands, retry next trigger.
  } finally {
    syncing = false;
  }
}
