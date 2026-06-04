"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { isOnline } from "@/lib/offline/offline-mode";

/**
 * A Next <Link> that falls back to a hard navigation when offline. Client-side
 * navigation would RSC-fetch the destination from the server and fail with no
 * network; a full navigation instead hits the service worker, which boots the
 * detail page from a cached shell (the page reads its id from the URL). Online
 * it behaves like a normal <Link>.
 */
export function OfflineLink({
  href,
  onClick,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !isOnline() && typeof href === "string") {
          e.preventDefault();
          window.location.assign(href);
        }
      }}
      {...props}
    />
  );
}
