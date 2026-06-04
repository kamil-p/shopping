"use client";

import { useEffect, useState } from "react";
import { ExternalLinkIcon, PlusIcon, Trash2Icon } from "lucide-react";

import type { Store } from "@/db/schema";
import {
  nullStoreReferences,
  readAllStores,
  saveLocal,
  softDeleteLocal,
} from "@/lib/offline/db";
import { isOnline } from "@/lib/offline/offline-mode";
import { pushLocal, syncNow } from "@/lib/offline/sync";
import { useUserId } from "@/components/offline/user-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function StoreRow({
  store,
  onRename,
  onDelete,
}: {
  store: Store;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  function commit(value: string) {
    const next = value.trim();
    setEditing(false);
    if (next && next !== store.name) onRename(next);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      {editing ? (
        <Input
          autoFocus
          defaultValue={store.name}
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
          {store.name}
        </button>
      )}

      {store.url ? (
        <a
          href={store.url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Otwórz link sklepu"
        >
          <ExternalLinkIcon className="size-4" />
        </a>
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Usuń ${store.name}`}
        onClick={onDelete}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}

/**
 * Local-first store catalog. Reads the mirror so it renders instantly and works
 * offline; add/rename/delete write locally and queue for sync. Deleting a store
 * also clears it from any set that referenced it.
 */
export function StoreCatalog() {
  const userId = useUserId();
  const [stores, setStores] = useState<Store[] | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = await readAllStores();
      if (!cancelled) setStores(local);
      if (isOnline()) {
        await syncNow();
        if (!cancelled) setStores(await readAllStores());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function sorted(list: Store[]) {
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = new Date();
    const store: Store = {
      id: crypto.randomUUID(),
      userId,
      name: trimmed.slice(0, 80),
      url: url.trim() ? url.trim().slice(0, 500) : null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    setStores((prev) => sorted([...(prev ?? []), store]));
    setName("");
    setUrl("");
    void saveLocal("stores", store).then(() => void pushLocal());
  }

  function remove(id: string) {
    setStores((prev) => (prev ?? []).filter((s) => s.id !== id));
    void (async () => {
      await softDeleteLocal("stores", id);
      await nullStoreReferences(id);
      void pushLocal();
    })();
  }

  function rename(id: string, value: string) {
    const list = stores ?? [];
    const target = list.find((s) => s.id === id);
    if (!target) return;
    const updated: Store = { ...target, name: value.slice(0, 80), updatedAt: new Date() };
    setStores(sorted(list.map((s) => (s.id === id ? updated : s))));
    void saveLocal("stores", updated).then(() => void pushLocal());
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      <h1 className="mb-6 font-heading text-2xl font-semibold tracking-tight">
        Katalog sklepów
      </h1>

      <Card className="mb-6 gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="nazwa sklepu"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className="sm:flex-1"
          />
          <Input
            placeholder="link (opcjonalnie)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="sm:flex-1"
          />
          <Button onClick={add} disabled={!name.trim()}>
            <PlusIcon />
            Dodaj
          </Button>
        </div>
      </Card>

      {stores === null ? null : stores.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Brak sklepów. Dodaj pierwszy powyżej.
        </p>
      ) : (
        <div className="space-y-2">
          {stores.map((store) => (
            <StoreRow
              key={store.id}
              store={store}
              onRename={(value) => rename(store.id, value)}
              onDelete={() => remove(store.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
