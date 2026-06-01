"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { NavLinks } from "./nav-links";

function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 font-heading text-lg font-semibold tracking-tight whitespace-nowrap",
        className,
      )}
    >
      <span aria-hidden>🧺</span> Zakupy
    </span>
  );
}

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-svh w-full overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center border-b px-5">
          <Wordmark />
        </div>
        <NavLinks />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="h-14 justify-center border-b px-5">
            <SheetTitle>
              <Wordmark />
            </SheetTitle>
          </SheetHeader>
          <NavLinks onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Otwórz menu"
            onClick={() => setOpen(true)}
          >
            <MenuIcon />
          </Button>
          <Wordmark className="text-base md:hidden" />

          <div className="flex-1" />

          <ThemeToggle />
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarFallback>{email.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground sm:inline">
              {email}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
