import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getCurrentSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) redirect("/");

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
