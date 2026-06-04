"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import type { List, ListItem } from "@/db/schema";
import { readListWithItems } from "@/lib/offline/db";
import { syncNow } from "@/lib/offline/sync";
import { Card } from "@/components/ui/card";
import { ListView } from "@/components/list-view/list-view";

type Data = { list: List; items: ListItem[] };

/**
 * Local-first list detail. Renders from the IndexedDB mirror (instant, works
 * offline); when online it reconciles with the server and re-reads. Because the
 * id comes from the URL on the client, the service worker can serve one cached
 * shell for any list offline.
 */
export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  // undefined = loading, null = not available, Data = ready.
  const [data, setData] = useState<Data | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const local = await readListWithItems(id);
      if (cancelled) return;
      if (local) setData(local);

      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      if (online) {
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
