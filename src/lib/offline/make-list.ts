/**
 * Build a shopping list locally from a mirrored set — the offline equivalent of
 * the server `createListFromSet`. Resolves each item's store to a plain-text
 * `storeName` snapshot (item override → set default), mints client ids, writes
 * everything to the mirror, and queues it for sync. Browser-only.
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
      storeName: item.storeId
        ? (storeName.get(item.storeId) ?? defaultName)
        : defaultName,
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
