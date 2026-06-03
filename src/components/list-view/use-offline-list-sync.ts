"use client";

import { useCallback, useEffect, useState } from "react";

import type { List, ListItem } from "@/db/schema";
import {
  enqueue,
  putListItem,
  readListWithItems,
  seedList,
} from "@/lib/offline/db";
import { flushOutbox } from "@/lib/offline/sync";

/**
 * Local-first state for a single list. The IndexedDB mirror is the source of
 * truth: every change updates React state + the mirror + the outbox, then tries
 * to flush. Online that flush replays to the server right away; offline it
 * stays queued and the optimistic state simply stands (no rollback) until the
 * network returns. Survives an app restart because it lives in IndexedDB.
 */
export function useOfflineListSync(list: List, initialItems: ListItem[]) {
  const [items, setItems] = useState<ListItem[]>(initialItems);

  const refresh = useCallback(async () => {
    const data = await readListWithItems(list.id);
    if (data) setItems(data.items);
  }, [list.id]);

  // Mirror this list locally and try to drain anything queued for it. Re-read
  // after a successful flush so optimistic temp ids get reconciled to real ones.
  useEffect(() => {
    let cancelled = false;
    void seedList(list, initialItems)
      .then(() => flushOutbox())
      .then((drained) => {
        if (drained && !cancelled) void refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Seed once on mount with the server/IndexedDB data we were handed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id]);

  // Drain + reconcile when the network or app focus comes back.
  useEffect(() => {
    const sync = () => {
      void flushOutbox().then((drained) => {
        if (drained) void refresh();
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const toggle = useCallback((item: ListItem) => {
    const next = !item.checked;
    const updated = { ...item, checked: next };
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    void (async () => {
      await putListItem(updated);
      await enqueue({ kind: "toggle", itemId: item.id, checked: next });
      await flushOutbox();
    })();
  }, []);

  const addItem = useCallback(
    (name: string) => {
      // Mirror the server's itemNameSchema (max 120) so a queued add can never
      // fail server validation and become a poison entry that blocks the outbox.
      const value = name.trim().slice(0, 120);
      if (!value) return;
      const tempId = crypto.randomUUID();
      const maxSort = items.reduce((m, it) => Math.max(m, it.sortOrder), 0);
      const optimistic: ListItem = {
        id: tempId,
        listId: list.id,
        name: value,
        storeName: null,
        checked: false,
        sortOrder: maxSort + 10,
      };
      setItems((prev) => [...prev, optimistic]);
      void (async () => {
        await putListItem(optimistic);
        await enqueue({ kind: "addItem", tempId, listId: list.id, name: value });
        const drained = await flushOutbox();
        if (drained) await refresh();
      })();
    },
    [items, list.id, refresh],
  );

  return { items, toggle, addItem };
}
