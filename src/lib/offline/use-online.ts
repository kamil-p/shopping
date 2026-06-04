"use client";

import { useSyncExternalStore } from "react";

/**
 * Live online/offline state. Driven by the browser's `online`/`offline` events
 * so the UI reacts immediately when connectivity drops or returns. SSR snapshot
 * assumes online (no flash of "offline" before hydration).
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
