import { redirect } from "next/navigation";

import type { User } from "@/db/schema";

import { getCurrentSession } from "./index";

/**
 * Returns the authenticated user or redirects to /login.
 * Use at the top of every Server Action / data query so all reads and writes
 * are scoped to the current user.
 */
export async function requireUser(): Promise<User> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session.user;
}
