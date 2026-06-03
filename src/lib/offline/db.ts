/**
 * Offline mirror of the shopping lists, stored in IndexedDB.
 *
 * This is the source of truth WHILE OFFLINE: the lists pages render from here
 * and writes (toggle / add item) land here first, then get replayed to the
 * server from the outbox once the network returns (see ./sync.ts).
 *
 * The stored shapes are exactly the Drizzle `List` / `ListItem` row types, so
 * they render in <ListView> with no conversion (a `Date` survives the
 * IndexedDB structured clone).
 *
 * Browser-only — every export touches `indexedDB` and must be called from
 * client components / effects, never during SSR.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { List, ListItem } from "@/db/schema";

/** A pending mutation waiting to be replayed against the server. */
export type OutboxOp =
  | { kind: "toggle"; itemId: string; checked: boolean }
  | { kind: "addItem"; tempId: string; listId: string; name: string };

export type OutboxEntry = OutboxOp & { seq: number };

/** A list plus the progress counts the overview shows (mirrors ListSummary). */
export type ListSummary = List & { itemCount: number; checkedCount: number };

interface ShoppingDB extends DBSchema {
  lists: { key: string; value: List };
  listItems: { key: string; value: ListItem; indexes: { byList: string } };
  meta: { key: string; value: unknown };
  outbox: { key: number; value: OutboxEntry };
}

const DB_NAME = "zakupy-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ShoppingDB>> | null = null;

function getDb(): Promise<IDBPDatabase<ShoppingDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable (server)"));
  }
  if (!dbPromise) {
    dbPromise = openDB<ShoppingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("lists", { keyPath: "id" });
        const items = db.createObjectStore("listItems", { keyPath: "id" });
        items.createIndex("byList", "listId");
        db.createObjectStore("meta");
        db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

// --- Snapshot / seeding (online → local mirror) ---

/**
 * Replace the entire mirror with a fresh server snapshot of all active lists.
 * Call this only AFTER the outbox has been flushed, so a pull never clobbers
 * unsynced local changes.
 */
export async function putSnapshot(
  snapshot: { lists: List[]; items: ListItem[] },
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["lists", "listItems"], "readwrite");
  await tx.objectStore("lists").clear();
  await tx.objectStore("listItems").clear();
  const lists = tx.objectStore("lists");
  const items = tx.objectStore("listItems");
  for (const list of snapshot.lists) void lists.put(list);
  for (const item of snapshot.items) void items.put(item);
  await tx.done;
}

/**
 * Write-through one list and its items (used when a list is opened online), so
 * it is available offline later. Replaces just this list's items, leaving the
 * rest of the mirror untouched.
 */
export async function seedList(list: List, items: ListItem[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["lists", "listItems"], "readwrite");
  void tx.objectStore("lists").put(list);
  const store = tx.objectStore("listItems");
  const existing = await store.index("byList").getAllKeys(list.id);
  for (const key of existing) void store.delete(key);
  for (const item of items) void store.put(item);
  await tx.done;
}

// --- Reads (offline rendering) ---

/** All mirrored lists with progress counts, newest first (mirrors listActiveLists). */
export async function readAllLists(): Promise<ListSummary[]> {
  const db = await getDb();
  const [lists, allItems] = await Promise.all([
    db.getAll("lists"),
    db.getAll("listItems"),
  ]);
  const counts = new Map<string, { itemCount: number; checkedCount: number }>();
  for (const item of allItems) {
    const c = counts.get(item.listId) ?? { itemCount: 0, checkedCount: 0 };
    c.itemCount += 1;
    if (item.checked) c.checkedCount += 1;
    counts.set(item.listId, c);
  }
  return lists
    .map((list) => ({
      ...list,
      itemCount: counts.get(list.id)?.itemCount ?? 0,
      checkedCount: counts.get(list.id)?.checkedCount ?? 0,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** One mirrored list with its ordered items (mirrors getListWithItems). */
export async function readListWithItems(
  listId: string,
): Promise<{ list: List; items: ListItem[] } | null> {
  const db = await getDb();
  const list = await db.get("lists", listId);
  if (!list) return null;
  const items = await db.getAllFromIndex("listItems", "byList", listId);
  items.sort((a, b) => a.sortOrder - b.sortOrder);
  return { list, items };
}

// --- Local writes (optimistic, before sync) ---

export async function putListItem(item: ListItem): Promise<void> {
  const db = await getDb();
  await db.put("listItems", item);
}

// --- Outbox ---

export async function enqueue(op: OutboxOp): Promise<void> {
  const db = await getDb();
  // `seq` is an autoincrement inline key — IndexedDB assigns it on add.
  const entry = op as OutboxEntry;
  // Coalesce repeated toggles of the same item (last write wins).
  if (op.kind === "toggle") {
    const tx = db.transaction("outbox", "readwrite");
    let cursor = await tx.store.openCursor();
    while (cursor) {
      const v = cursor.value;
      if (v.kind === "toggle" && v.itemId === op.itemId) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.store.add(entry);
    await tx.done;
    return;
  }
  await db.add("outbox", entry);
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  const db = await getDb();
  const all = await db.getAll("outbox");
  return all.sort((a, b) => a.seq - b.seq);
}

export async function deleteOutboxEntry(seq: number): Promise<void> {
  const db = await getDb();
  await db.delete("outbox", seq);
}

/**
 * After a queued addItem syncs, the optimistic temp id becomes a real server id.
 * Rewrite any still-queued toggles that referenced the temp id, and remap the
 * mirrored item row to its real id.
 */
export async function remapItemId(
  tempId: string,
  realItem: ListItem,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["listItems", "outbox"], "readwrite");
  const items = tx.objectStore("listItems");
  void items.delete(tempId);
  void items.put(realItem);
  const outbox = tx.objectStore("outbox");
  let cursor = await outbox.openCursor();
  while (cursor) {
    const v = cursor.value;
    if (v.kind === "toggle" && v.itemId === tempId) {
      await cursor.update({ ...v, itemId: realItem.id });
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("meta", value, key);
}
