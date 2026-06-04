"use client";

import { useSyncExternalStore } from "react";

import {
  getForcedOffline,
  isOnline,
  setForcedOffline,
  subscribeForcedOffline,
} from "@/lib/offline/offline-mode";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  const unForced = subscribeForcedOffline(onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
    unForced();
  };
}

/**
 * Live online/offline state. Driven by the browser's `online`/`offline` events
 * AND the offline-simulation toggle, so the UI reacts immediately when either
 * changes. SSR snapshot assumes online (no flash of "offline" before hydration).
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}

/**
 * The offline-simulation flag plus its setter, reactive across the app. Lets the
 * toggle and the banner stay in sync wherever they're mounted.
 */
export function useForcedOffline(): [boolean, (value: boolean) => void] {
  const forced = useSyncExternalStore(
    subscribeForcedOffline,
    getForcedOffline,
    () => false,
  );
  return [forced, setForcedOffline];
}
