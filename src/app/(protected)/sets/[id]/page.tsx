"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import type { Set, SetItem, Store } from "@/db/schema";
import { readSetWithItems } from "@/lib/offline/db";
import { syncNow } from "@/lib/offline/sync";
import { Card } from "@/components/ui/card";
import { SetEditor } from "@/components/set-editor/set-editor";

type Data = { set: Set; items: SetItem[]; stores: Store[] };

/**
 * Local-first set editor. Renders from the IndexedDB mirror (instant, works
 * offline); when online it reconciles with the server and re-reads.
 */
export default function SetEditorPage() {
  const { id } = useParams<{ id: string }>();
  // undefined = loading, null = not available, Data = ready.
  const [data, setData] = useState<Data | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const local = await readSetWithItems(id);
      if (cancelled) return;
      if (local) setData(local);

      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      if (online) {
        await syncNow();
        if (cancelled) return;
        const fresh = await readSetWithItems(id);
        setData(fresh ?? local ?? null);
      } else if (!local) {
        setData(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (data === undefined) return null; // brief load from IndexedDB
  if (data === null) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Tego zestawu nie ma w pamięci offline. Otwórz go raz przy połączeniu z
            siecią.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <SetEditor
      key={data.set.id}
      set={data.set}
      initialItems={data.items}
      initialStores={data.stores}
    />
  );
}
