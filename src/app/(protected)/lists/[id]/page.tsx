import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { getListWithItems } from "@/lib/lists/queries";
import { ListView } from "@/components/list-view/list-view";

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const data = await getListWithItems(id, user.id);
  if (!data) notFound();

  return <ListView list={data.list} initialItems={data.items} />;
}
