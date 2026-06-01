import { requireUser } from "@/lib/auth/require-user";
import { listStores } from "@/lib/stores/queries";
import { StoreCatalog } from "@/components/store-catalog/store-catalog";

export default async function SklepyPage() {
  const user = await requireUser();
  const stores = await listStores(user.id);

  return <StoreCatalog initialStores={stores} />;
}
