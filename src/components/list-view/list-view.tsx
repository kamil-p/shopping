"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveIcon, ArrowLeftIcon, CheckIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import type { List, ListItem } from "@/db/schema";
import { addListItem, archiveList, toggleListItem } from "@/lib/lists/actions";
import { listDisplayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ListView({
  list,
  initialItems,
}: {
  list: List;
  initialItems: ListItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const checkedCount = items.filter((i) => i.checked).length;

  const groups = useMemo(() => {
    const map = new Map<string, ListItem[]>();
    for (const item of items) {
      const key = item.storeName ?? "Bez sklepu";
      const arr = map.get(key);
      if (arr) arr.push(item);
      else map.set(key, [item]);
    }
    return Array.from(map, ([store, groupItems]) => ({
      store,
      items: groupItems,
    }));
  }, [items]);

  function toggle(item: ListItem) {
    const next = !item.checked;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: next } : i)),
    );
    startTransition(async () => {
      try {
        await toggleListItem(item.id, next);
      } catch (error) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, checked: !next } : i)),
        );
        toast.error(
          error instanceof Error ? error.message : "Nie udało się zaktualizować",
        );
      }
    });
  }

  function addItem() {
    const value = draft.trim();
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
    setDraft("");
    draftRef.current?.focus();

    startTransition(async () => {
      try {
        const created = await addListItem(list.id, value);
        setItems((prev) => prev.map((it) => (it.id === tempId ? created : it)));
      } catch (error) {
        setItems((prev) => prev.filter((it) => it.id !== tempId));
        toast.error(
          error instanceof Error ? error.message : "Nie udało się dodać pozycji",
        );
      }
    });
  }

  function archive() {
    startTransition(async () => {
      try {
        await archiveList(list.id);
        toast.success("Lista zarchiwizowana");
        router.push("/lists");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Nie udało się zarchiwizować",
        );
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      <Link
        href="/lists"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Listy
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {listDisplayName(list.name)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {checkedCount}/{items.length} odhaczonych
          </p>
        </div>
        <Button variant="outline" onClick={archive}>
          <ArchiveIcon />
          Zarchiwizuj
        </Button>
      </header>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.store} className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.store}
            </p>
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item)}
                  className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                      item.checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {item.checked ? <CheckIcon className="size-3.5" /> : null}
                  </span>
                  <span
                    className={cn(
                      "flex-1 truncate",
                      item.checked && "text-muted-foreground line-through",
                    )}
                  >
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Add ad-hoc items. A list is a standalone snapshot — these never
            touch the source set. */}
        <div>
          {items.length === 0 ? (
            <p className="mb-2 text-sm text-muted-foreground">
              Ta lista jest pusta. Dodaj pierwszą pozycję poniżej.
            </p>
          ) : null}
          <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2">
            <PlusIcon className="size-4 shrink-0 text-primary" />
            <input
              ref={draftRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
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
    </div>
  );
}
