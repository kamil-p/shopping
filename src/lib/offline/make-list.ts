/**
 * Build a shopping list locally — the offline-first equivalent of a server
 * "create list" action. Store semantics mirror sets: the list carries a
 * default store as a plain-text snapshot (`lists.storeName`), and an item
 * carries its own `storeName` only when it overrides that default; null means
 * "inherit". Mints client ids, writes to the mirror, queues for sync.
 * Browser-only.
 */
import type { List, ListItem } from "@/db/schema";
import { readSetWithItems, saveLocal } from "@/lib/offline/db";
import { pushLocal } from "@/lib/offline/sync";

export async function createListFromMirror(
  setId: string,
  userId: string,
  name?: string,
): Promise<string | null> {
  const data = await readSetWithItems(setId);
  if (!data) return null;
  const { set, items, stores } = data;

  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  const defaultName = set.defaultStoreId
    ? (storeName.get(set.defaultStoreId) ?? null)
    : null;

  const now = new Date();
  const listId = crypto.randomUUID();
  const list: List = {
    id: listId,
    userId,
    setId: set.id,
    name: name?.trim() || set.name,
    storeName: defaultName,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await saveLocal("lists", list);

  let order = 0;
  for (const item of items) {
    order += 1;
    const listItem: ListItem = {
      id: crypto.randomUUID(),
      listId,
      name: item.name,
      // Snapshot only the per-item override; null inherits the list default.
      storeName: item.storeId ? (storeName.get(item.storeId) ?? null) : null,
      checked: false,
      sortOrder: order * 10,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await saveLocal("listItems", listItem);
  }

  void pushLocal();
  return listId;
}

/** An empty ad-hoc list ("Szybkie zakupy") with no source set. */
export async function createQuickList(
  userId: string,
  name: string,
  storeName: string | null,
): Promise<string> {
  const now = new Date();
  const list: List = {
    id: crypto.randomUUID(),
    userId,
    setId: null,
    name: name.trim().slice(0, 120) || "Szybkie zakupy",
    storeName: storeName?.trim().slice(0, 120) || null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await saveLocal("lists", list);
  void pushLocal();
  return list.id;
}
