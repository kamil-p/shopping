"use client";

import { useState, useTransition } from "react";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import type { Store } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export function DefaultStorePicker({
  stores,
  onSelect,
  onCreate,
}: {
  stores: Store[];
  onSelect: (storeId: string) => void;
  onCreate: (input: { name: string; url?: string }) => Promise<Store>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

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
        setName("");
        setUrl("");
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="border-dashed" />
        }
      >
        <PlusIcon />
        dodaj sklep
        <ChevronDownIcon className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        {stores.length > 0 ? (
          <>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Z zapisanych
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stores.map((store) => (
                <Button
                  key={store.id}
                  variant="secondary"
                  size="xs"
                  onClick={() => pick(store.id)}
                >
                  {store.name}
                </Button>
              ))}
            </div>
            <Separator />
          </>
        ) : null}

        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Nowy sklep
        </p>
        <Input
          placeholder="nazwa sklepu"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
        />
        <Input
          placeholder="link (opcjonalnie)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={create} disabled={pending || !name.trim()}>
            Dodaj
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
