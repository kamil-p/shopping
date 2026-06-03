"use client";

import { useCallback, useEffect, useState } from "react";

import type { List, ListItem } from "@/db/schema";
import {
  readAllLists,
  readListWithItems,
  type ListSummary,
} from "@/lib/offline/db";
import { syncNow } from "@/lib/offline/sync";
import { formatListDate, listDisplayName } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { ListView } from "@/components/list-view/list-view";

/**
 * Offline app shell. The service worker serves this for any navigation that
 * fails (cold launch with no network, or a link tapped while offline). It is a
 * self-contained SPA reading from the IndexedDB mirror — switching lists is
 * client state (+ history) so it never triggers an RSC fetch that needs the
 * server.
 */
type Detail = { id: string; data: { list: List; items: ListItem[] } | null };

export default function OfflinePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [summaries, setSummaries] = useState<ListSummary[] | null>(null);

  // Track the URL the SW fell back from, and follow back/forward navigation.
  // setState lives in the `syncFromUrl` callback (driven by an external system,
  // the browser history), not synchronously in the effect body.
  useEffect(() => {
    const syncFromUrl = () => {
      const match = window.location.pathname.match(/^\/lists\/([^/]+)$/);
      setSelectedId(match ? decodeURIComponent(match[1]) : null);
    };
    syncFromUrl();
    // We might actually be online (navigated here directly) — try a sync.
    void syncNow();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  // Load the overview when nothing is selected.
  useEffect(() => {
    if (selectedId) return;
    let cancelled = false;
    void readAllLists().then((rows) => {
      if (!cancelled) setSummaries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Load the selected list's detail, keyed by id so we can tell "still loading"
  // (no entry for this id yet) from "not in the mirror" (entry with data null).
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void readListWithItems(selectedId).then((data) => {
      if (!cancelled) setDetail({ id: selectedId, data });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const select = useCallback((id: string) => {
    window.history.pushState(null, "", `/lists/${id}`);
    setSelectedId(id);
  }, []);

  const back = useCallback(() => {
    window.history.pushState(null, "", "/lists");
    setSelectedId(null);
  }, []);

  if (selectedId) {
    const ready = detail && detail.id === selectedId;
    if (!ready) return null; // still loading from IndexedDB
    if (detail.data === null) {
      return (
        <OfflineEmpty
          message="Tej listy nie ma w pamięci offline. Otwórz ją raz przy połączeniu z siecią."
          onBack={back}
        />
      );
    }
    return (
      <ListView
        key={detail.data.list.id}
        list={detail.data.list}
        initialItems={detail.data.items}
        onBack={back}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <h1 className="mb-1 font-heading text-2xl font-semibold tracking-tight">
        Aktywne listy zakupów
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">Tryb offline</p>

      {summaries === null ? null : summaries.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Brak zapisanych list. Otwórz aplikację przy połączeniu z siecią, aby
            pobrać listy do trybu offline.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {summaries.map((list) => {
            const done =
              list.itemCount > 0 && list.checkedCount === list.itemCount;
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => select(list.id)}
                className="group block w-full text-left"
              >
                <Card className="flex flex-row items-center justify-between gap-4 p-4 transition-colors group-hover:ring-ring">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {listDisplayName(list.name)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatListDate(list.createdAt)}
                    </p>
                  </div>
                  <span
                    className={
                      done
                        ? "shrink-0 text-sm font-medium text-primary"
                        : "shrink-0 text-sm text-muted-foreground"
                    }
                  >
                    {list.checkedCount}/{list.itemCount}
                  </span>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OfflineEmpty({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Listy
      </button>
      <Card className="p-10 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
      </Card>
    </div>
  );
}
