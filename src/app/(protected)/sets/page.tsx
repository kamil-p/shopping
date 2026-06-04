"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import type { Set } from "@/db/schema";
import { readAllSets, saveLocal, type SetSummary } from "@/lib/offline/db";
import { pushLocal, syncNow } from "@/lib/offline/sync";
import { useUserId } from "@/components/offline/user-context";
import { produkty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Local-first sets overview. Reads the mirror so it renders instantly and works
 * offline; "Nowy zestaw" mints a set locally (client UUID) and opens its editor
 * without needing the network.
 */
export default function ZestawyPage() {
  const router = useRouter();
  const userId = useUserId();
  const [sets, setSets] = useState<SetSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = await readAllSets();
      if (!cancelled) setSets(local);
      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      if (online) {
        await syncNow();
        if (!cancelled) setSets(await readAllSets());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createSet() {
    const now = new Date();
    const set: Set = {
      id: crypto.randomUUID(),
      userId,
      name: "Nowy zestaw",
      icon: "🧺",
      defaultStoreId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await saveLocal("sets", set);
    void pushLocal();
    router.push(`/sets/${set.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Zestawy
        </h1>
        <Button type="button" onClick={createSet}>
          <PlusIcon />
          Nowy zestaw
        </Button>
      </header>

      {sets === null ? null : sets.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nie masz jeszcze żadnych zestawów.
          </p>
          <Button type="button" onClick={createSet}>
            <PlusIcon />
            Utwórz pierwszy zestaw
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sets.map((set) => (
            <Link key={set.id} href={`/sets/${set.id}`} className="group">
              <Card className="flex h-full flex-row items-center gap-3 p-4 transition-colors group-hover:ring-ring">
                <span className="text-2xl" aria-hidden>
                  {set.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{set.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {set.itemCount} {produkty(set.itemCount)}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
