"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVerticalIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { softDeleteSet } from "@/lib/offline/db";
import { pushLocal } from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Set-level options (kebab) with a destructive "delete set" that confirms first.
 * Deletes locally (mirror tombstone + items) so it works offline, queues the
 * change for sync, then returns to the sets overview.
 */
export function DeleteSetMenu({
  setId,
  setName,
}: {
  setId: string;
  setName: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  function remove() {
    setPending(true);
    void (async () => {
      await softDeleteSet(setId);
      void pushLocal();
      toast.success("Usunięto zestaw");
      router.push("/sets");
    })();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-lg"
              className="shrink-0"
              aria-label="Opcje zestawu"
            />
          }
        >
          <MoreVerticalIcon className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2Icon />
            Usuń zestaw
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Usunąć „{setName}”?</DialogTitle>
            <DialogDescription>
              Zestaw i jego produkty zostaną usunięte. Listy zakupów zrobione z
              tego zestawu pozostają nietknięte.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Anuluj</DialogClose>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              <Trash2Icon />
              Usuń zestaw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
