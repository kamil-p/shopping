"use client";

import { useCallback, useEffect, useState } from "react";

import type { List, ListItem } from "@/db/schema";
import { readListWithItems, saveLocal } from "@/lib/offline/db";
import { pushLocal, syncNow } from "@/lib/offline/sync";

/**
 * Local-first state for a single list. The IndexedDB mirror is the source of
 * truth: every change updates React state + the mirror + a dirty marker, then
 * pushes. Online the push replays to the server right away; offline the
 * optimistic state simply stands (no rollback) until the network returns.
 * New items get a client-minted id, so they need no server reconciliation.
 */
export function useOfflineListSync(list: List, initialItems: ListItem[]) {
  const [items, setItems] = useState<ListItem[]>(initialItems);

  const refresh = useCallback(async () => {
    const data = await readListWithItems(list.id);
    if (data) setItems(data.items);
  }, [list.id]);

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

  const toggle = useCallback((item: ListItem) => {
    const updated: ListItem = {
      ...item,
      checked: !item.checked,
      updatedAt: new Date(),
    };
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    void (async () => {
      await saveLocal("listItems", updated);
      void pushLocal();
    })();
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
        storeName: null,
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

  return { items, toggle, addItem };
}
