"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, ShoppingCartIcon } from "lucide-react";
import { toast } from "sonner";

import { createListFromSet } from "@/lib/lists/actions";
import { produkty } from "@/lib/format";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button size="lg" disabled={itemCount === 0} />}
      >
        <ShoppingCartIcon />
        Zrób listę zakupów
        <ArrowRightIcon />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Utwórz listę zakupów</DialogTitle>
          <DialogDescription>
            {itemCount} {produkty(itemCount)} · zestaw zostaje nietknięty
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="list-name">Nazwa listy</Label>
          <Input
            id="list-name"
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

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Anuluj</DialogClose>
          <Button onClick={create} disabled={pending}>
            Utwórz
            <ArrowRightIcon />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
