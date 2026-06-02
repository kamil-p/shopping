"use client";

import { useRef, useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import type { Store } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function DefaultStorePicker({
  stores,
  currentId,
  onSelect,
  onCreate,
}: {
  stores: Store[];
  currentId: string | null;
  onSelect: (storeId: string) => void;
  onCreate: (input: { name: string; url?: string }) => Promise<Store>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  const suggestions = stores.filter((s) => s.id !== currentId);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName("");
      setUrl("");
      setTimeout(() => nameRef.current?.focus(), 60);
    }
  }

  function pick(storeId: string) {
    onSelect(storeId);
    setOpen(false);
  }

  function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const store = await onCreate({
          name: trimmed,
          url: url.trim() || undefined,
        });
        setOpen(false);
        onSelect(store.id);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Nie udało się dodać sklepu",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<button type="button" className="zk-chip-add" />}
      >
        <PlusIcon className="size-[15px]" />
        dodaj sklep
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Dodaj sklep</DialogTitle>
        </DialogHeader>

        {suggestions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold tracking-wider text-text-faint uppercase">
              Z katalogu
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => pick(store.id)}
                  className="rounded-full border border-border bg-secondary px-3 py-1.5 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent-text"
                >
                  {store.name}
                </button>
              ))}
            </div>
            <Separator className="my-1" />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="store-name" className="text-xs font-semibold text-muted-foreground">
            Nazwa sklepu
          </Label>
          <Input
            id="store-name"
            ref={nameRef}
            className="h-11 bg-secondary text-[15.5px]"
            placeholder="np. Carrefour"
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="store-url" className="text-xs font-semibold text-muted-foreground">
            Link <span className="font-normal text-text-faint">(opcjonalnie)</span>
          </Label>
          <Input
            id="store-url"
            className="h-11 bg-secondary text-[15.5px]"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="mt-1 flex gap-2.5">
          <DialogClose render={<Button variant="outline" className="h-11 flex-1" />}>
            Anuluj
          </DialogClose>
          <Button
            className="h-11 flex-[1.4]"
            onClick={create}
            disabled={pending || !name.trim()}
          >
            Dodaj sklep
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
