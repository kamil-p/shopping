import { requireUser } from "@/lib/auth/require-user";
import { listActiveLists } from "@/lib/lists/queries";
import { formatListDate, listDisplayName } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { OfflineLink } from "@/components/offline/offline-link";

export default async function ListyPage() {
  const user = await requireUser();
  const lists = await listActiveLists(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <h1 className="mb-6 font-heading text-2xl font-semibold tracking-tight">
        Aktywne listy zakupów
      </h1>

      {lists.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Brak aktywnych list. Utwórz listę z zestawu, klikając „Zrób listę
            zakupów”.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => {
            const done = list.itemCount > 0 && list.checkedCount === list.itemCount;
            return (
              <OfflineLink
                key={list.id}
                href={`/lists/${list.id}`}
                className="group block"
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
              </OfflineLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
