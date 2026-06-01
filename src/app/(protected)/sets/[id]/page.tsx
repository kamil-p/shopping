import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { getSetWithItems } from "@/lib/sets/queries";
import { SetEditor } from "@/components/set-editor/set-editor";

export default async function SetEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const data = await getSetWithItems(id, user.id);
  if (!data) notFound();

  return (
    <SetEditor
      set={data.set}
      initialItems={data.items}
      initialStores={data.stores}
    />
  );
}
