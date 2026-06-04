"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, XIcon } from "lucide-react";

import type { Set, SetItem, Store } from "@/db/schema";
import { saveLocal, softDeleteLocal } from "@/lib/offline/db";
import { pushLocal } from "@/lib/offline/sync";
import { produkty } from "@/lib/format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { DefaultStorePicker } from "./default-store-picker";
import { MakeListDialog } from "./make-list-dialog";
import { ProductRow } from "./product-row";

const EMOJIS = [
  "🧺", "🥦", "🍎", "🥕", "🍌", "🥩", "🐟", "🧀",
  "🥖", "🍷", "🧴", "🧻", "🍫", "🧊", "🍕", "🥗",
];

function EmojiButton({
  value,
  onPick,
}: {
  value: string;
  onPick: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button className="zk-set-emoji" type="button" aria-label="Zmień ikonę" />
        }
      >
        {value}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <div className="grid grid-cols-6 gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
              className="flex size-9 items-center justify-center rounded-md text-xl hover:bg-accent"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SetEditor({
  set,
  initialItems,
  initialStores,
}: {
  set: Set;
  initialItems: SetItem[];
  initialStores: Store[];
}) {
  const userId = set.userId;
  const currentSet = useRef<Set>(set);

  const [name, setName] = useState(set.name);
  const committedName = useRef(set.name);
  const [icon, setIcon] = useState(set.icon);
  const [defaultStoreId, setDefaultStoreId] = useState(set.defaultStoreId);
  const [stores, setStores] = useState(initialStores);
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const movedDuringDrag = useRef(false);

  const defaultStore = stores.find((s) => s.id === defaultStoreId);

  // Persist a set-level change to the mirror and queue it for the next sync.
  const persistSet = useCallback((patch: Partial<Set>) => {
    const updated: Set = {
      ...currentSet.current,
      ...patch,
      updatedAt: new Date(),
    };
    currentSet.current = updated;
    void saveLocal("sets", updated).then(() => void pushLocal());
  }, []);

  // Persist already-stamped item rows to the mirror and queue for sync.
  const persistItems = useCallback((rows: SetItem[]) => {
    void (async () => {
      for (const row of rows) await saveLocal("setItems", row);
      void pushLocal();
    })();
  }, []);

  function commitName() {
    const next = name.trim();
    if (!next) {
      setName(committedName.current);
      return;
    }
    if (next === committedName.current) return;
    committedName.current = next;
    setName(next);
    persistSet({ name: next });
  }

  function pickIcon(emoji: string) {
    setIcon(emoji);
    persistSet({ icon: emoji });
  }

  function chooseDefaultStore(storeId: string | null) {
    setDefaultStoreId(storeId);
    persistSet({ defaultStoreId: storeId });
  }

  async function createStore(input: { name: string; url?: string }) {
    const now = new Date();
    const store: Store = {
      id: crypto.randomUUID(),
      userId,
      name: input.name.trim().slice(0, 80),
      url: input.url?.trim() ? input.url.trim().slice(0, 500) : null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    setStores((prev) =>
      [...prev, store].sort((a, b) => a.name.localeCompare(b.name, "pl")),
    );
    await saveLocal("stores", store);
    void pushLocal();
    return store;
  }

  function addProduct() {
    const value = draft.trim();
    if (!value) return;
    const now = new Date();
    const maxSort = items.reduce((m, it) => Math.max(m, it.sortOrder), 0);
    const item: SetItem = {
      id: crypto.randomUUID(),
      setId: set.id,
      name: value.slice(0, 120),
      storeId: null,
      sortOrder: maxSort + 10,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    setItems((prev) => [...prev, item]);
    setDraft("");
    draftRef.current?.focus();
    persistItems([item]);
  }

  function renameProduct(id: string, value: string) {
    const target = items.find((it) => it.id === id);
    if (!target) return;
    const updated: SetItem = {
      ...target,
      name: value.slice(0, 120),
      updatedAt: new Date(),
    };
    setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    persistItems([updated]);
  }

  function changeProductStore(id: string, storeId: string | null) {
    const target = items.find((it) => it.id === id);
    if (!target) return;
    const updated: SetItem = { ...target, storeId, updatedAt: new Date() };
    setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    persistItems([updated]);
  }

  function deleteProduct(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    void softDeleteLocal("setItems", id).then(() => void pushLocal());
  }

  function moveProduct(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    persistOrder(next);
  }

  // Renumber to the server's (i+1)*10 scheme; write only the rows that moved.
  function persistOrder(ordered: SetItem[]) {
    const now = new Date();
    const changed: SetItem[] = [];
    const renumbered = ordered.map((it, i) => {
      const sortOrder = (i + 1) * 10;
      if (it.sortOrder === sortOrder) return it;
      const updated = { ...it, sortOrder, updatedAt: now };
      changed.push(updated);
      return updated;
    });
    setItems(renumbered);
    if (changed.length) persistItems(changed);
  }

  function dragStart(id: string) {
    dragId.current = id;
    setDraggingId(id);
    movedDuringDrag.current = false;
  }

  function dragOverRow(overId: string) {
    const fromId = dragId.current;
    if (!fromId || fromId === overId) return;
    setItems((prev) => {
      const from = prev.findIndex((it) => it.id === fromId);
      const to = prev.findIndex((it) => it.id === overId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      movedDuringDrag.current = true;
      return next;
    });
  }

  function dragEnd() {
    dragId.current = null;
    setDraggingId(null);
    if (!movedDuringDrag.current) return;
    movedDuringDrag.current = false;
    persistOrder(items);
  }

  return (
    <>
      <main className="zk-main">
        <Link href="/sets" className="zk-back">
          <ArrowLeftIcon className="size-4" />
          Zestawy
        </Link>

        {/* Set header */}
        <div className="zk-set-head">
          <EmojiButton value={icon} onPick={pickIcon} />
          <div className="zk-set-name-wrap">
            <input
              className="zk-set-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label="Nazwa zestawu"
            />
            <div className="zk-set-sub">
              {items.length} {produkty(items.length)}
            </div>
          </div>
        </div>

        {/* Default store */}
        <section>
          <div className="zk-sec-label">Domyślny sklep</div>
          <div className="zk-chips">
            {defaultStore ? (
              <span className="zk-chip">
                {defaultStore.name}
                <button
                  type="button"
                  className="x"
                  onClick={() => chooseDefaultStore(null)}
                  aria-label={`Usuń ${defaultStore.name}`}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ) : null}
            <DefaultStorePicker
              stores={stores}
              currentId={defaultStoreId}
              onSelect={chooseDefaultStore}
              onCreate={createStore}
            />
          </div>
        </section>

        {/* Products */}
        <section>
          <div className="zk-sec-label">Produkty</div>
          <div className="zk-list">
            {items.length === 0 ? (
              <div className="zk-empty">
                Pusto — dopisz pierwszy produkt poniżej 👇
              </div>
            ) : (
              items.map((item, index) => (
                <ProductRow
                  key={item.id}
                  item={item}
                  stores={stores}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                  isDragging={draggingId === item.id}
                  onRename={(value) => renameProduct(item.id, value)}
                  onSetStore={(storeId) => changeProductStore(item.id, storeId)}
                  onMove={(direction) => moveProduct(index, direction)}
                  onDelete={() => deleteProduct(item.id)}
                  onDragStart={() => dragStart(item.id)}
                  onDragEnter={() => dragOverRow(item.id)}
                  onDragEnd={dragEnd}
                />
              ))
            )}
          </div>

          {/* Quick add */}
          <div
            className="zk-quick"
            style={{ marginTop: 9 }}
            onClick={() => draftRef.current?.focus()}
          >
            <span className="plus">
              <PlusIcon className="size-5" />
            </span>
            <input
              ref={draftRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addProduct();
                }
              }}
              placeholder="Dodaj produkt…"
            />
            {draft.trim() ? (
              <button
                type="button"
                className="zk-quick-add-btn"
                onClick={addProduct}
                aria-label="Dodaj"
              >
                <ArrowRightIcon className="size-[19px]" />
              </button>
            ) : (
              <span className="zk-enter-hint">ENTER</span>
            )}
          </div>
        </section>
      </main>

      {/* Sticky make-list CTA */}
      <div className="zk-cta-bar">
        <MakeListDialog setId={set.id} setName={name} itemCount={items.length} />
      </div>
    </>
  );
}
