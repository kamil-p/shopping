"use client";

import { usePathname } from "next/navigation";

/**
 * The detail id taken from the *real* browser URL (last path segment).
 *
 * Why not `useParams()`: in the App Router that reads the param baked into the
 * served HTML document, not the address bar. Offline, the service worker boots
 * an un-warmed `/lists/<new-id>` from another id's cached shell, so `useParams()`
 * would return the *shell's* id and the page would show the wrong record.
 * `window.location.pathname` is always the navigated URL, so it's correct
 * regardless of which shell rendered the page.
 *
 * `usePathname()` is the reactive trigger (re-renders on soft navigations); we
 * read `window.location` for the actual value. The id is only consumed in the
 * page's data-loading effect (the page renders `null` until then), so the
 * server/client value can differ without a hydration mismatch.
 */
export function useRouteId(): string {
  const pathname = usePathname();
  return typeof window === "undefined"
    ? lastSegment(pathname)
    : lastSegment(window.location.pathname);
}

function lastSegment(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? "";
}
