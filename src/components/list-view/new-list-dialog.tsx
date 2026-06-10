"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import type { Store } from "@/db/schema";
import { readAllStores } from "@/lib/offline/db";
import { createQuickList } from "@/lib/offline/make-list";
import { useUserId } from "@/components/offline/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * "Nowa lista" — an ad-hoc quick list with no source set. Optional store choice
 * from the catalog becomes the list's default store (a plain-text snapshot);
 * on success the user lands straight in edit mode to add products.
 */
export function NewListDialog() {
  const router = useRouter();
  const userId = useUserId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [stores, setStores] = useState<Store[]>([]);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName("Szybkie zakupy");
      setStoreName(null);
      void readAllStores().then(setStores);
    }
  }

  function create() {
    setPending(true);
    void (async () => {
      try {
        const id = await createQuickList(userId, name, storeName);
        setOpen(false);
        router.push(`/lists/${id}?edit=1`);
      } catch {
        toast.error("Nie udało się utworzyć listy");
      } finally {
        setPending(false);
      }
    })();
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button />}>
        <PlusIcon />
        Nowa lista
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto w-full gap-3 rounded-t-3xl px-5 pt-3.5 pb-7 sm:max-w-[600px]"
      >
        <span className="mx-auto h-1 w-10 rounded-full bg-border-strong" aria-hidden />
        <SheetTitle className="font-heading text-[22px] font-bold tracking-tight">
          Nowa lista zakupów
        </SheetTitle>
        <p className="-mt-1.5 text-sm text-muted-foreground">
          Pusta lista bez zestawu — produkty dopiszesz za chwilę.
        </p>

        <div className="mt-1 flex flex-col gap-1.5">
          <Label htmlFor="quick-list-name" className="text-xs font-semibold text-muted-foreground">
            Nazwa listy
          </Label>
          <Input
            id="quick-list-name"
            className="h-11 bg-secondary text-[15.5px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
          />
        </div>

        {stores.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Sklep <span className="font-normal text-text-faint">(opcjonalnie)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {stores.map((store) => {
                const selected = store.name === storeName;
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setStoreName(selected ? null : store.name)}
                    className={
                      selected
                        ? "rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-[13.5px] font-semibold text-accent-text"
                        : "rounded-full border border-border bg-secondary px-3 py-1.5 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent-text"
                    }
                  >
                    {store.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-1 flex gap-2.5">
          <SheetClose render={<Button variant="outline" className="h-11 flex-1" />}>
            Anuluj
          </SheetClose>
          <Button className="h-11 flex-[1.4]" onClick={create} disabled={pending}>
            Utwórz listę
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
