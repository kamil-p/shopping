"use client";

/**
 * Single source of truth for "is the app online?".
 *
 * Real connectivity (`navigator.onLine`) AND a user-toggleable **offline
 * simulation** flag (persisted in localStorage) feed the same `isOnline()`, so
 * flipping the simulation makes the whole app behave offline — banner, sync
 * queue, IndexedDB-first reads — without actually cutting the network. Browser
 * only; SSR is treated as online so there's no flash of "offline" before hydrate.
 */
const KEY = "zakupy:force-offline";
const EVENT = "zakupy:force-offline-change";

export function getForcedOffline(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setForcedOffline(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // localStorage blocked (private mode) — the in-memory event still drives UI.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Subscribe to simulation toggles (for `useSyncExternalStore`). */
export function subscribeForcedOffline(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** True when the network is up AND the offline simulation is off. */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine && !getForcedOffline();
}
