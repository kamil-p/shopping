"use client";

import { useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MoreVerticalIcon,
  PencilIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";

import type { SetItem, Store } from "@/db/schema";
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

export function ProductRow({
  item,
  stores,
  isFirst,
  isLast,
  isDragging,
  onRename,
  onSetStore,
  onMove,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  item: SetItem;
  stores: Store[];
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  onRename: (name: string) => void;
  onSetStore: (storeId: string | null) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [grabbed, setGrabbed] = useState(false);
  const overrideStore = stores.find((s) => s.id === item.storeId);

  function commit(value: string) {
    const next = value.trim();
    setEditing(false);
    if (next && next !== item.name) onRename(next);
  }

  return (
    <div
      className={`zk-row${isDragging ? " dragging" : ""}`}
      draggable={grabbed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox only starts a drag once some data is set.
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={() => {
        setGrabbed(false);
        onDragEnd();
      }}
    >
      <span
        className="zk-grip"
        aria-hidden
        onPointerDown={() => setGrabbed(true)}
        onPointerUp={() => setGrabbed(false)}
        onPointerCancel={() => setGrabbed(false)}
      >
        <span className="gr">
          <i />
          <i />
        </span>
        <span className="gr">
          <i />
          <i />
        </span>
        <span className="gr">
          <i />
          <i />
        </span>
      </span>

      {editing ? (
        <input
          autoFocus
          className="zk-row-name editable"
          defaultValue={item.name}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget.value);
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="zk-row-name truncate"
          onClick={() => setEditing(true)}
        >
          {item.name}
        </button>
      )}

      {overrideStore ? (
        <span className="zk-store-tag">
          <TagIcon className="size-[13px]" />
          {overrideStore.name}
        </span>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="zk-row-kebab"
              aria-label={`Opcje dla ${item.name}`}
            />
          }
        >
          <MoreVerticalIcon className="size-[17px]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <PencilIcon />
            Zmień nazwę
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={item.storeId ?? "none"}
            onValueChange={(value) =>
              onSetStore(value === "none" ? null : value)
            }
          >
            <DropdownMenuLabel>Sklep</DropdownMenuLabel>
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
