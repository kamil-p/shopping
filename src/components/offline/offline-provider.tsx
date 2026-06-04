"use client";

import { useEffect } from "react";

import { readAllLists, readAllSets } from "@/lib/offline/db";
import { syncNow } from "@/lib/offline/sync";

/**
 * Boots the offline layer for logged-in users: registers the service worker
 * (production only — in dev it would cache Turbopack HMR chunks), keeps the
 * IndexedDB mirror warm + the outbox drained on load / reconnect / focus, and
 * tells the SW to precache the list route documents so every active list opens
 * offline (even ones not visited this session). Mounted inside the (protected)
 * layout so it never runs on /login and the snapshot pull always has a cookie.
 */
export function OfflineProvider() {
  useEffect(() => {
    const swEnabled =
      process.env.NODE_ENV === "production" && "serviceWorker" in navigator;
    if (swEnabled) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    void (async () => {
      await syncNow();
      if (!swEnabled || !navigator.onLine) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const [lists, sets] = await Promise.all([readAllLists(), readAllSets()]);
        const urls = [
          "/",
          "/lists",
          "/sets",
          "/stores",
          ...lists.map((l) => `/lists/${l.id}`),
          ...sets.map((s) => `/sets/${s.id}`),
        ];
        reg.active?.postMessage({ type: "warm", urls });
      } catch {
        // SW not ready / unsupported — natural navigation caching still applies.
      }
    })();

    const onOnline = () => void syncNow();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
