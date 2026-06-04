"use client";

import { useEffect, useState } from "react";

import type { List, ListItem } from "@/db/schema";
import { readListWithItems } from "@/lib/offline/db";
import { isOnline } from "@/lib/offline/offline-mode";
import { syncNow } from "@/lib/offline/sync";
import { useRouteId } from "@/lib/offline/use-route-id";
import { Card } from "@/components/ui/card";
import { ListView } from "@/components/list-view/list-view";

type Data = { list: List; items: ListItem[] };

/**
 * Local-first list detail. Renders from the IndexedDB mirror (instant, works
 * offline); when online it reconciles with the server and re-reads. The id comes
 * from the real URL (`useRouteId`, not `useParams`), so the service worker can
 * boot any list from one cached detail shell offline and we still load the right
 * record.
 */
export default function ListDetailPage() {
  const id = useRouteId();
  // undefined = loading, null = not available, Data = ready.
  const [data, setData] = useState<Data | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const local = await readListWithItems(id);
      if (cancelled) return;
      if (local) setData(local);

      if (isOnline()) {
        await syncNow();
        if (cancelled) return;
        const fresh = await readListWithItems(id);
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
            Tej listy nie ma w pamięci offline. Otwórz ją raz przy połączeniu z
            siecią.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <ListView key={data.list.id} list={data.list} initialItems={data.items} />
  );
}
