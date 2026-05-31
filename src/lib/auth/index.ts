import { cache } from "react";

import type { User } from "@/db/schema";

import { getSessionToken, validateSessionToken } from "./session";

/**
 * Returns the current session for the request, or null.
 * Wrapped in React.cache so multiple calls within one request
 * (e.g. layout + page) hit the database only once.
 */
export const getCurrentSession = cache(
  async (): Promise<{ user: User } | null> => {
    const token = await getSessionToken();
    if (!token) return null;
    return validateSessionToken(token);
  },
);
