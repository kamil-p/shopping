"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLinkIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type { Store } from "@/db/schema";
import { addStore, deleteStore, renameStore } from "@/lib/stores/actions";
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

export function StoreCatalog({ initialStores }: { initialStores: Store[] }) {
  const router = useRouter();
  const [stores, setStores] = useState(initialStores);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  function sorted(list: Store[]) {
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const store = await addStore({
          name: trimmed,
          url: url.trim() || undefined,
        });
        setStores((prev) => sorted([...prev, store]));
        setName("");
        setUrl("");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Nie udało się dodać sklepu",
        );
      }
    });
  }

  function remove(id: string) {
    const snapshot = stores;
    setStores((prev) => prev.filter((s) => s.id !== id));
    startTransition(async () => {
      try {
        await deleteStore(id);
      } catch (error) {
        setStores(snapshot);
        toast.error(
          error instanceof Error ? error.message : "Nie udało się usunąć sklepu",
        );
      }
    });
  }

  function rename(id: string, value: string) {
    setStores((prev) =>
      sorted(prev.map((s) => (s.id === id ? { ...s, name: value } : s))),
    );
    startTransition(async () => {
      try {
        await renameStore(id, value);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Nie udało się zmienić nazwy",
        );
        router.refresh();
      }
    });
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
          <Button onClick={add} disabled={pending || !name.trim()}>
            <PlusIcon />
            Dodaj
          </Button>
        </div>
      </Card>

      {stores.length === 0 ? (
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
