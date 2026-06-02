"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCartIcon } from "lucide-react";
import { toast } from "sonner";

import { createListFromSet } from "@/lib/lists/actions";
import { produkty } from "@/lib/format";
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

function defaultListName(setName: string): string {
  const date = new Date().toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  });
  return `${setName} — ${date}`;
}

export function MakeListDialog({
  setId,
  setName,
  itemCount,
}: {
  setId: string;
  setName: string;
  itemCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName_] = useState("");
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setName_(defaultListName(setName));
  }

  function create() {
    startTransition(async () => {
      try {
        const { id } = await createListFromSet(setId, name.trim() || undefined);
        toast.success("Utworzono listę zakupów");
        setOpen(false);
        router.push(`/lists/${id}`);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Nie udało się utworzyć listy",
        );
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          <button type="button" className="zk-cta" disabled={itemCount === 0} />
        }
      >
        <ShoppingCartIcon className="size-5" />
        Zrób listę zakupów
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto w-full gap-3 rounded-t-3xl px-5 pt-3.5 pb-7 sm:max-w-[600px]"
      >
        <span className="mx-auto h-1 w-10 rounded-full bg-border-strong" aria-hidden />
        <SheetTitle className="font-heading text-[22px] font-bold tracking-tight">
          Utwórz listę zakupów
        </SheetTitle>
        <p className="-mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
          {itemCount} {produkty(itemCount)}
          <span className="size-1 rounded-full bg-text-faint" aria-hidden />
          zestaw zostaje nietknięty
        </p>

        <div className="mt-1 flex flex-col gap-1.5">
          <Label htmlFor="list-name" className="text-xs font-semibold text-muted-foreground">
            Nazwa listy
          </Label>
          <Input
            id="list-name"
            className="h-11 bg-secondary text-[15.5px]"
            value={name}
            onChange={(e) => setName_(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
          />
        </div>

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
