/**
 * Sync bridge between the offline mirror (IndexedDB) and the server.
 *
 * Order matters: always FLUSH local changes before PULLing a fresh snapshot, so
 * a pull never overwrites edits that haven't reached the server yet.
 *
 * Replay goes through the existing Server Actions (`toggleListItem`,
 * `addListItem`) — no REST layer — and the `session` cookie rides along
 * automatically. Browser-only.
 */
import {
  addListItem,
  getActiveListsSnapshot,
  toggleListItem,
} from "@/lib/lists/actions";
import {
  deleteOutboxEntry,
  getOutbox,
  putSnapshot,
  remapItemId,
  setMeta,
  type OutboxEntry,
} from "@/lib/offline/db";

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

let flushing = false;

/**
 * Replay every queued mutation in order. Stops early on the first network-like
 * error (the entry stays queued and is retried on the next trigger). Returns
 * true if at least one entry was drained (so callers can refresh their view).
 */
export async function flushOutbox(): Promise<boolean> {
  if (flushing || !isOnline()) return false;
  flushing = true;
  let drained = false;
  try {
    const entries = await getOutbox();
    for (const entry of entries) {
      try {
        await replay(entry);
        await deleteOutboxEntry(entry.seq);
        drained = true;
      } catch {
        // Likely offline again / transient — keep this and the rest queued.
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return drained;
}

async function replay(entry: OutboxEntry): Promise<void> {
  if (entry.kind === "toggle") {
    await toggleListItem(entry.itemId, entry.checked);
    return;
  }
  // addItem: create on the server, then promote the optimistic temp id to the
  // real row everywhere (mirror + any queued toggles that referenced it).
  const created = await addListItem(entry.listId, entry.name);
  await remapItemId(entry.tempId, created);
}

/** Pull a fresh server snapshot into the mirror (call AFTER flushOutbox). */
export async function pullSnapshot(): Promise<void> {
  if (!isOnline()) return;
  const snapshot = await getActiveListsSnapshot();
  await putSnapshot(snapshot);
  await setMeta("lastSyncedAt", Date.now());
}

/**
 * Full reconcile: drain the outbox, then refresh the local mirror. Safe to call
 * on app start, on `online`, and on tab focus. No-ops gracefully when offline.
 */
export async function syncNow(): Promise<void> {
  try {
    await flushOutbox();
    await pullSnapshot();
  } catch {
    // Offline or auth bounce — the outbox is durable, we'll retry next trigger.
  }
}
