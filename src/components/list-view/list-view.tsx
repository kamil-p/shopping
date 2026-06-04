"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckCheckIcon, CheckIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import type { List, ListItem } from "@/db/schema";
import { softDeleteLocal } from "@/lib/offline/db";
import { pushLocal } from "@/lib/offline/sync";
import { listDisplayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OfflineLink } from "@/components/offline/offline-link";
import { useOfflineListSync } from "@/components/list-view/use-offline-list-sync";

export function ListView({
  list,
  initialItems,
  onBack,
}: {
  list: List;
  initialItems: ListItem[];
  /** When set (offline shell), the back control returns to the overview in-app
   *  instead of routing to /lists. */
  onBack?: () => void;
}) {
  const router = useRouter();
  const { items, toggle, addItem } = useOfflineListSync(list, initialItems);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  function submitDraft() {
    const value = draft.trim();
    if (!value) return;
    addItem(value);
    setDraft("");
    draftRef.current?.focus();
  }

  function finish() {
    // Works offline: soft-delete locally (the row vanishes from the UI) and
    // queue it; the server hard-purges the tombstone after the sync window.
    setConfirmOpen(false);
    void softDeleteLocal("lists", list.id).then(() => void pushLocal());
    toast.success("Zakupy zakończone");
    if (onBack) onBack();
    else router.push("/lists");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Listy
        </button>
      ) : (
        <OfflineLink
          href="/lists"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Listy
        </OfflineLink>
      )}

      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {listDisplayName(list.name)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {checkedCount}/{items.length} odhaczonych
          </p>
        </div>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger render={<Button variant="outline" />}>
            <CheckCheckIcon />
            Zakończ zakupy
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Zakończyć listę?</DialogTitle>
              <DialogDescription>
                Lista „{listDisplayName(list.name)}” zostanie trwale usunięta.
                Nie można tego cofnąć.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Anuluj
              </DialogClose>
              <Button variant="destructive" onClick={finish}>
                Zakończ i usuń
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                  submitDraft();
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
