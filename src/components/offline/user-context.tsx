"use client";

import { createContext, useContext } from "react";

/**
 * The current user's id, provided by the (protected) layout. Client screens mint
 * new rows (sets/stores/lists) offline and need to stamp `userId` locally so the
 * mirror is correct before the first sync. The server still forces `userId` on
 * push, so this is convenience, not a trust boundary.
 */
const UserIdContext = createContext<string | null>(null);

export function UserIdProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <UserIdContext.Provider value={userId}>{children}</UserIdContext.Provider>
  );
}

export function useUserId(): string {
  const id = useContext(UserIdContext);
  if (!id) throw new Error("useUserId must be used within UserIdProvider");
  return id;
}
