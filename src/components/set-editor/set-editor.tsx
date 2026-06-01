"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import type { Set, SetItem, Store } from "@/db/schema";
import {
  addSetItem,
  deleteSetItem,
  renameSet,
  renameSetItem,
  reorderSetItems,
  setDefaultStore,
  setItemStore,
  setSetIcon,
} from "@/lib/sets/actions";
import { addStore } from "@/lib/stores/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
          <Button variant="outline" size="icon-lg" aria-label="Zmień ikonę" />
        }
      >
        <span className="text-xl leading-none">{value}</span>
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
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [name, setName] = useState(set.name);
  const committedName = useRef(set.name);
  const [icon, setIcon] = useState(set.icon);
  const [defaultStoreId, setDefaultStoreId] = useState(set.defaultStoreId);
  const [stores, setStores] = useState(initialStores);
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);

  const defaultStore = stores.find((s) => s.id === defaultStoreId);

  function run(fn: () => Promise<unknown>, message: string) {
    startTransition(async () => {
      try {
        await fn();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : message);
        router.refresh();
      }
    });
  }

  function commitName() {
    const next = name.trim();
    if (!next) {
      setName(committedName.current);
      return;
    }
    if (next === committedName.current) return;
    committedName.current = next;
    setName(next);
    run(() => renameSet(set.id, next), "Nie udało się zmienić nazwy");
  }

  function pickIcon(emoji: string) {
    setIcon(emoji);
    run(() => setSetIcon(set.id, emoji), "Nie udało się zmienić ikony");
  }

  function chooseDefaultStore(storeId: string | null) {
    setDefaultStoreId(storeId);
    run(() => setDefaultStore(set.id, storeId), "Nie udało się ustawić sklepu");
  }

  async function createStore(input: { name: string; url?: string }) {
    const store = await addStore(input);
    setStores((prev) =>
      [...prev, store].sort((a, b) => a.name.localeCompare(b.name, "pl")),
    );
    return store;
  }

  function addProduct() {
    const value = draft.trim();
    if (!value) return;
    const tempId = crypto.randomUUID();
    const maxSort = items.reduce((m, it) => Math.max(m, it.sortOrder), 0);
    const optimistic: SetItem = {
      id: tempId,
      setId: set.id,
      name: value,
      storeId: null,
      sortOrder: maxSort + 10,
      createdAt: new Date(),
    };
    setItems((prev) => [...prev, optimistic]);
    setDraft("");
    draftRef.current?.focus();

    startTransition(async () => {
      try {
        const created = await addSetItem(set.id, value);
        setItems((prev) => prev.map((it) => (it.id === tempId ? created : it)));
      } catch (error) {
        setItems((prev) => prev.filter((it) => it.id !== tempId));
        toast.error(
          error instanceof Error ? error.message : "Nie udało się dodać produktu",
        );
      }
    });
  }

  function renameProduct(id: string, value: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, name: value } : it)),
    );
    run(() => renameSetItem(id, value), "Nie udało się zmienić nazwy");
  }

  function changeProductStore(id: string, storeId: string | null) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, storeId } : it)),
    );
    run(() => setItemStore(id, storeId), "Nie udało się zmienić sklepu");
  }

  function deleteProduct(id: string) {
    const snapshot = items;
    setItems((prev) => prev.filter((it) => it.id !== id));
    startTransition(async () => {
      try {
        await deleteSetItem(id);
      } catch (error) {
        setItems(snapshot);
        toast.error(
          error instanceof Error ? error.message : "Nie udało się usunąć produktu",
        );
      }
    });
  }

  function moveProduct(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    run(
      () =>
        reorderSetItems(
          set.id,
          next.map((it) => it.id),
        ),
      "Nie udało się zmienić kolejności",
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <div className="flex-1 space-y-6 px-4 py-6 md:px-6">
        <Link
          href="/sets"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Zestawy
        </Link>

        {/* Set name */}
        <div className="space-y-1.5">
          <label
            htmlFor="set-name"
            className="text-xs font-medium text-muted-foreground"
          >
            Nazwa zestawu
          </label>
          <div className="flex items-center gap-2">
            <EmojiButton value={icon} onPick={pickIcon} />
            <Input
              id="set-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="h-11 flex-1 text-lg font-medium md:text-lg"
            />
          </div>
        </div>

        {/* Default store */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Domyślny sklep
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {defaultStore ? (
              <Badge variant="secondary" className="h-7 gap-1 pr-1 pl-2.5">
                {defaultStore.name}
                <button
                  type="button"
                  aria-label="Usuń domyślny sklep"
                  onClick={() => chooseDefaultStore(null)}
                  className="grid size-4 place-items-center rounded-full hover:bg-foreground/10"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ) : null}
            <DefaultStorePicker
              stores={stores}
              onSelect={chooseDefaultStore}
              onCreate={createStore}
            />
          </div>
        </div>

        {/* Products */}
        <div className="space-y-2">
          {items.map((item, index) => (
            <ProductRow
              key={item.id}
              item={item}
              stores={stores}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              onRename={(value) => renameProduct(item.id, value)}
              onSetStore={(storeId) => changeProductStore(item.id, storeId)}
              onMove={(direction) => moveProduct(index, direction)}
              onDelete={() => deleteProduct(item.id)}
            />
          ))}

          {/* Quick add */}
          <div className="flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5">
            <PlusIcon className="size-4 shrink-0 text-primary" />
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
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <span className="shrink-0 text-xs text-muted-foreground">
              wpisz nazwę · Enter
            </span>
          </div>
        </div>
      </div>

      {/* Sticky make-list CTA */}
      <div className="sticky bottom-0 border-t bg-background/85 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex justify-end">
          <MakeListDialog
            setId={set.id}
            setName={name}
            itemCount={items.length}
          />
        </div>
      </div>
    </div>
  );
}
