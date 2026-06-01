"use client";

import { useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import type { SetItem, Store } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function ProductRow({
  item,
  stores,
  isFirst,
  isLast,
  onRename,
  onSetStore,
  onMove,
  onDelete,
}: {
  item: SetItem;
  stores: Store[];
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => void;
  onSetStore: (storeId: string | null) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const overrideStore = stores.find((s) => s.id === item.storeId);

  function commit(value: string) {
    const next = value.trim();
    setEditing(false);
    if (next && next !== item.name) onRename(next);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5">
      <GripVerticalIcon
        className="size-4 shrink-0 cursor-grab text-muted-foreground/50"
        aria-hidden
      />

      {editing ? (
        <Input
          autoFocus
          defaultValue={item.name}
          className="h-7 flex-1"
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget.value);
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 truncate text-left text-sm"
        >
          {item.name}
        </button>
      )}

      {overrideStore ? (
        <Badge variant="outline" className="shrink-0 text-muted-foreground">
          @{overrideStore.name}
        </Badge>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Opcje dla ${item.name}`}
            />
          }
        >
          <MoreVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <PencilIcon />
            Zmień nazwę
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Sklep</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={item.storeId ?? "none"}
            onValueChange={(value) =>
              onSetStore(value === "none" ? null : value)
            }
          >
            <DropdownMenuRadioItem value="none">
              Domyślny zestawu
            </DropdownMenuRadioItem>
            {stores.map((store) => (
              <DropdownMenuRadioItem key={store.id} value={store.id}>
                {store.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={isFirst} onClick={() => onMove(-1)}>
            <ArrowUpIcon />
            Przenieś w górę
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isLast} onClick={() => onMove(1)}>
            <ArrowDownIcon />
            Przenieś w dół
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon />
            Usuń
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
