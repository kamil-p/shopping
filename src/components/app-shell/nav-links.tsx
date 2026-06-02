"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGridIcon, ShoppingCartIcon, StoreIcon } from "lucide-react";

const items = [
  { href: "/sets", label: "Zestawy", icon: LayoutGridIcon },
  { href: "/lists", label: "Aktywne listy zakupów", icon: ShoppingCartIcon },
  { href: "/stores", label: "Katalog sklepów", icon: StoreIcon },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="zk-nav">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={"zk-nav-item" + (active ? " active" : "")}
          >
            <Icon className="size-[20px]" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
