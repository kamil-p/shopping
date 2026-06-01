import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { createSet } from "@/lib/sets/actions";
import { listSets } from "@/lib/sets/queries";
import { produkty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function ZestawyPage() {
  const user = await requireUser();
  const sets = await listSets(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Zestawy
        </h1>
        <form action={createSet}>
          <Button type="submit">
            <PlusIcon />
            Nowy zestaw
          </Button>
        </form>
      </header>

      {sets.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nie masz jeszcze żadnych zestawów.
          </p>
          <form action={createSet}>
            <Button type="submit">
              <PlusIcon />
              Utwórz pierwszy zestaw
            </Button>
          </form>
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
