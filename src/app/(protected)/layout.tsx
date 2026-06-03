import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell/app-shell";
import { OfflineProvider } from "@/components/offline/offline-provider";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return (
    <AppShell email={session.user.email}>
      <OfflineProvider />
      {children}
    </AppShell>
  );
}
