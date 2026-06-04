"use client";

import { useEffect, useState } from "react";

import type { Set, SetItem, Store } from "@/db/schema";
import { readSetWithItems } from "@/lib/offline/db";
import { isOnline } from "@/lib/offline/offline-mode";
import { syncNow } from "@/lib/offline/sync";
import { useRouteId } from "@/lib/offline/use-route-id";
import { Card } from "@/components/ui/card";
import { SetEditor } from "@/components/set-editor/set-editor";

type Data = { set: Set; items: SetItem[]; stores: Store[] };

/**
 * Local-first set editor. Renders from the IndexedDB mirror (instant, works
 * offline); when online it reconciles with the server and re-reads. The id comes
 * from the real URL (`useRouteId`, not `useParams`) so an un-warmed set booted
 * from another set's cached shell offline still loads the right record.
 */
export default function SetEditorPage() {
  const id = useRouteId();
  // undefined = loading, null = not available, Data = ready.
  const [data, setData] = useState<Data | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const local = await readSetWithItems(id);
      if (cancelled) return;
      if (local) setData(local);

      if (isOnline()) {
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
