import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PUBLIC_PATHS = ["/login"];

/**
 * First line of defense: a lightweight cookie-presence check that redirects
 * unauthenticated traffic to /login. The authoritative, DB-backed check lives
 * in the (protected) layout — this only avoids rendering protected routes for
 * requests that obviously have no session.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  // Only gate unauthenticated traffic. We can't validate the session here
  // (no DB on this layer), so a present-but-stale cookie must not be treated
  // as "logged in" — otherwise it would bounce against the login page's
  // authoritative redirect and create a loop. Redirecting an already-logged-in
  // user away from /login is handled by the login page itself.
  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and files with an extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
