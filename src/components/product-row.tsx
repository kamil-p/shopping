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

/**
 * One editable product row, shared by the set editor and the list editor.
 * Domain-neutral: the store is a radio over opaque `storeOptions` values
 * (store ids for sets, store names for lists) with "none" meaning "inherit
 * the parent's default" (`inheritLabel`).
 */
export function ProductRow({
  id,
  name,
  storeTag,
  storeValue,
  storeOptions,
  inheritLabel,
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
  id: string;
  name: string;
  /** Label of the current store override, shown as a tag; null when inheriting. */
  storeTag: string | null;
  /** Current radio value; "none" selects the inherit option. */
  storeValue: string;
  storeOptions: { value: string; label: string }[];
  inheritLabel: string;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  onRename: (name: string) => void;
  onSetStore: (value: string | null) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [grabbed, setGrabbed] = useState(false);

  function commit(value: string) {
    const next = value.trim();
    setEditing(false);
    if (next && next !== name) onRename(next);
  }

  return (
    <div
      className={`zk-row${isDragging ? " dragging" : ""}`}
      draggable={grabbed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox only starts a drag once some data is set.
        e.dataTransfer.setData("text/plain", id);
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
          defaultValue={name}
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
          {name}
        </button>
      )}

      {storeTag ? (
        <span className="zk-store-tag">
          <TagIcon className="size-[13px]" />
          {storeTag}
        </span>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="zk-row-kebab"
              aria-label={`Opcje dla ${name}`}
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
            value={storeValue}
            onValueChange={(value) =>
              onSetStore(value === "none" ? null : value)
            }
          >
            <DropdownMenuLabel>Sklep</DropdownMenuLabel>
            <DropdownMenuRadioItem value="none">
              {inheritLabel}
            </DropdownMenuRadioItem>
            {storeOptions.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
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
