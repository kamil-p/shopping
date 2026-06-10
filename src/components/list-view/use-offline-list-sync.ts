"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { List, ListItem } from "@/db/schema";
import { readListWithItems, saveLocal, softDeleteLocal } from "@/lib/offline/db";
import { pushLocal, syncNow } from "@/lib/offline/sync";

/**
 * Local-first state for a single list (the row itself plus its items). The
 * IndexedDB mirror is the source of truth: every change updates React state +
 * the mirror + a dirty marker, then pushes. Online the push replays to the
 * server right away; offline the optimistic state simply stands (no rollback)
 * until the network returns. New rows get a client-minted id, so they need no
 * server reconciliation.
 */
export function useOfflineListSync(
  initialList: List,
  initialItems: ListItem[],
) {
  const [list, setList] = useState(initialList);
  const [items, setItems] = useState<ListItem[]>(initialItems);
  // Latest list row for read-modify-write updates (state may lag a tick).
  const listRef = useRef(initialList);

  const refresh = useCallback(async () => {
    const data = await readListWithItems(listRef.current.id);
    if (data) {
      listRef.current = data.list;
      setList(data.list);
      setItems(data.items);
    }
  }, []);

  // Reconcile on mount and whenever the network or app focus returns.
  useEffect(() => {
    let cancelled = false;
    const sync = () =>
      void syncNow().then(() => {
        if (!cancelled) void refresh();
      });
    sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // --- List-level edits ---

  const updateList = useCallback(
    (patch: Partial<Pick<List, "name" | "storeName">>) => {
      const updated: List = {
        ...listRef.current,
        ...patch,
        updatedAt: new Date(),
      };
      listRef.current = updated;
      setList(updated);
      void saveLocal("lists", updated).then(() => void pushLocal());
    },
    [],
  );

  // --- Item-level edits ---

  const persistItem = useCallback((updated: ListItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    void saveLocal("listItems", updated).then(() => void pushLocal());
  }, []);

  const toggle = useCallback(
    (item: ListItem) => {
      persistItem({ ...item, checked: !item.checked, updatedAt: new Date() });
    },
    [persistItem],
  );

  const renameItem = useCallback(
    (item: ListItem, name: string) => {
      const value = name.trim().slice(0, 120);
      if (!value || value === item.name) return;
      persistItem({ ...item, name: value, updatedAt: new Date() });
    },
    [persistItem],
  );

  /** Set or clear the item's store override (null inherits the list default). */
  const setItemStore = useCallback(
    (item: ListItem, storeName: string | null) => {
      persistItem({ ...item, storeName, updatedAt: new Date() });
    },
    [persistItem],
  );

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    void softDeleteLocal("listItems", id).then(() => void pushLocal());
  }, []);

  const addItem = useCallback(
    (name: string) => {
      // Mirror the server's name rule (max 120) so a queued add can never fail
      // validation and linger in the dirty queue.
      const value = name.trim().slice(0, 120);
      if (!value) return;
      const now = new Date();
      const maxSort = items.reduce((m, it) => Math.max(m, it.sortOrder), 0);
      const optimistic: ListItem = {
        id: crypto.randomUUID(),
        listId: list.id,
        name: value,
        storeName: null, // inherits the list's default store
        checked: false,
        sortOrder: maxSort + 10,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      setItems((prev) => [...prev, optimistic]);
      void (async () => {
        await saveLocal("listItems", optimistic);
        void pushLocal();
      })();
    },
    [items, list.id],
  );

  /** Commit a new item order: renumber to (i+1)*10, persist only moved rows. */
  const reorderItems = useCallback((ordered: ListItem[]) => {
    const now = new Date();
    const changed: ListItem[] = [];
    const renumbered = ordered.map((it, i) => {
      const sortOrder = (i + 1) * 10;
      if (it.sortOrder === sortOrder) return it;
      const updated = { ...it, sortOrder, updatedAt: now };
      changed.push(updated);
      return updated;
    });
    setItems(renumbered);
    if (changed.length) {
      void (async () => {
        for (const row of changed) await saveLocal("listItems", row);
        void pushLocal();
      })();
    }
  }, []);

  return {
    list,
    items,
    setItems,
    toggle,
    addItem,
    updateList,
    renameItem,
    setItemStore,
    deleteItem,
    reorderItems,
  };
}
