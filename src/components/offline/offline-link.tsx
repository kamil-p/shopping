"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * A Next <Link> that falls back to a hard navigation when offline. Client-side
 * navigation would RSC-fetch the destination from the server and fail with no
 * network; a full navigation instead hits the service worker, which serves the
 * offline shell (/offline). Online it behaves like a normal <Link>.
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
        if (
          !e.defaultPrevented &&
          typeof navigator !== "undefined" &&
          !navigator.onLine &&
          typeof href === "string"
        ) {
          e.preventDefault();
          window.location.assign(href);
        }
      }}
      {...props}
    />
  );
}
