import { StoreCatalog } from "@/components/store-catalog/store-catalog";

/** The catalog is local-first and loads itself from the IndexedDB mirror. */
export default function SklepyPage() {
  return <StoreCatalog />;
}
