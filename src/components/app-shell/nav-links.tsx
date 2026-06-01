"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ListChecksIcon,
  LogOutIcon,
  ShoppingBasketIcon,
  StoreIcon,
} from "lucide-react";

import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const items = [
  { href: "/sets", label: "Zestawy", icon: ShoppingBasketIcon },
  { href: "/lists", label: "Aktywne listy zakupów", icon: ListChecksIcon },
  { href: "/stores", label: "Katalog sklepów", icon: StoreIcon },
];

const linkClass =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              linkClass,
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}

      <Separator className="my-2 bg-sidebar-border" />

      <form action={logout}>
        <button
          type="submit"
          className={cn(
            linkClass,
            "w-full text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          <LogOutIcon className="size-4 shrink-0" />
          Wyloguj
        </button>
      </form>
    </nav>
  );
}
