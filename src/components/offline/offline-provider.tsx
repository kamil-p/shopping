"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { syncNow } from "@/lib/offline/sync";

/**
 * Boots the offline layer for logged-in users: registers the service worker
 * (production only — in dev it would cache Turbopack HMR chunks) and keeps the
 * IndexedDB mirror warm + the outbox drained on load, on reconnect, and on tab
 * focus. Mounted inside the (protected) layout so it never runs on /login and
 * the snapshot pull always has a session cookie.
 */
export function OfflineProvider() {
  const router = useRouter();

  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    }

    // Warm the offline shell's route chunks while we still have a network, so
    // the cache-first SW has them when the shell is served offline.
    router.prefetch("/offline");

    void syncNow();

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
    // Run once on mount; `router` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
