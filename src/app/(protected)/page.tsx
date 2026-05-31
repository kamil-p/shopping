import { getCurrentSession } from "@/lib/auth";
import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function HomePage() {
  const session = await getCurrentSession();

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome 👋</CardTitle>
          <CardDescription>
            You are signed in as{" "}
            <span className="font-medium text-foreground">
              {session?.user.email}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-sm text-muted-foreground">
            This is a placeholder home page. The real design will replace it
            later.
          </p>
          <form action={logout}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
