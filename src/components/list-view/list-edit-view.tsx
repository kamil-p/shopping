"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CheckIcon, PlusIcon, XIcon } from "lucide-react";

import type { List, ListItem, Store } from "@/db/schema";
import { readAllStores, saveLocal } from "@/lib/offline/db";
import { pushLocal } from "@/lib/offline/sync";
import { listDisplayName, produkty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ProductRow } from "@/components/product-row";
import { DefaultStorePicker } from "@/components/set-editor/default-store-picker";

/**
 * Edit mode for a list — same URL as the shopping view, toggled by state.
 * Mirrors the set editor's interactions, with one twist: the list stores its
 * default store as a plain-text name (`list.storeName`), so the catalog picker
 * is mapped id ↔ name here and the selection is saved as text.
 */
export function ListEditView({
  list,
  items,
  setItems,
  onAdd,
  onUpdateList,
  onRenameItem,
  onSetItemStore,
  onDeleteItem,
  onReorder,
  onDone,
}: {
  list: List;
  items: ListItem[];
  setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  onAdd: (name: string) => void;
  onUpdateList: (patch: Partial<Pick<List, "name" | "storeName">>) => void;
  onRenameItem: (item: ListItem, name: string) => void;
  onSetItemStore: (item: ListItem, storeName: string | null) => void;
  onDeleteItem: (id: string) => void;
  onReorder: (ordered: ListItem[]) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(listDisplayName(list.name));
  const committedName = useRef(listDisplayName(list.name));
  const [stores, setStores] = useState<Store[]>([]);
  // Latest catalog for id → name lookups right after an inline store create
  // (state updates aren't visible to the picker's already-captured callbacks).
  const storesRef = useRef<Store[]>([]);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const movedDuringDrag = useRef(false);

  useEffect(() => {
    void readAllStores().then((all) => {
      storesRef.current = all;
      setStores(all);
    });
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
    onUpdateList({ name: next });
  }

  function chooseStore(storeId: string) {
    const store = storesRef.current.find((s) => s.id === storeId);
    if (store) onUpdateList({ storeName: store.name });
  }

  async function createStore(input: { name: string; url?: string }) {
    const now = new Date();
    const store: Store = {
      id: crypto.randomUUID(),
      userId: list.userId,
      name: input.name.trim().slice(0, 80),
      url: input.url?.trim() ? input.url.trim().slice(0, 500) : null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    storesRef.current = [...storesRef.current, store].sort((a, b) =>
      a.name.localeCompare(b.name, "pl"),
    );
    setStores(storesRef.current);
    await saveLocal("stores", store);
    void pushLocal();
    return store;
  }

  function addProduct() {
    const value = draft.trim();
    if (!value) return;
    onAdd(value);
    setDraft("");
    draftRef.current?.focus();
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
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
    onReorder(items);
  }

  // The current default store may be a name with no catalog match (renamed or
  // deleted store) — the chip still shows it; the picker just has no selection.
  const currentStoreId =
    stores.find((s) => s.name === list.storeName)?.id ?? null;

  return (
    <main className="zk-main">
      {/* Header: inline name + done */}
      <div className="zk-set-head">
        <div className="zk-set-name-wrap">
          <input
            className="zk-set-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label="Nazwa listy"
          />
          <div className="zk-set-sub">
            {items.length} {produkty(items.length)}
          </div>
        </div>
        <Button onClick={onDone} className="shrink-0">
          <CheckIcon />
          Gotowe
        </Button>
      </div>

      {/* Default store */}
      <section>
        <div className="zk-sec-label">Domyślny sklep</div>
        <div className="zk-chips">
          {list.storeName ? (
            <span className="zk-chip">
              {list.storeName}
              <button
                type="button"
                className="x"
                onClick={() => onUpdateList({ storeName: null })}
                aria-label={`Usuń ${list.storeName}`}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ) : null}
          <DefaultStorePicker
            stores={stores}
            currentId={currentStoreId}
            onSelect={chooseStore}
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
                id={item.id}
                name={item.name}
                storeTag={item.storeName}
                storeValue={item.storeName ?? "none"}
                storeOptions={stores.map((s) => ({
                  value: s.name,
                  label: s.name,
                }))}
                inheritLabel="Domyślny listy"
                isFirst={index === 0}
                isLast={index === items.length - 1}
                isDragging={draggingId === item.id}
                onRename={(value) => onRenameItem(item, value)}
                onSetStore={(storeName) => onSetItemStore(item, storeName)}
                onMove={(direction) => moveItem(index, direction)}
                onDelete={() => onDeleteItem(item.id)}
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
  );
}
