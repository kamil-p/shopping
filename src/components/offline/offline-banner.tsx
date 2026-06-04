"use client";

import { WifiOffIcon } from "lucide-react";

import { useOnline } from "@/lib/offline/use-online";

/**
 * Thin indicator shown only while offline, so it's obvious the app is running
 * from the local cache and changes will sync later.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/15 px-4 py-1.5 text-center text-xs font-medium text-amber-700 dark:text-amber-300"
    >
      <WifiOffIcon className="size-3.5 shrink-0" />
      Tryb offline — zmiany zapiszą się po powrocie sieci
    </div>
  );
}
