"use client";

import { useEffect, useState } from "react";
import { LogOutIcon, MenuIcon, MoonIcon, ShoppingCartIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { logout } from "@/lib/auth/actions";

import { NavLinks } from "./nav-links";

function BrandMark() {
  return (
    <span className="zk-brand-mark" aria-hidden>
      <ShoppingCartIcon className="size-[18px]" />
    </span>
  );
}

function ThemeControls({ variant }: { variant: "icon" | "row" }) {
  const { resolvedTheme, setTheme } = useTheme();
  // Icon/label visibility is CSS-driven via the `.dark` class so it stays
  // hydration-safe; the click reads the resolved theme at call time.
  const toggle = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  if (variant === "icon") {
    return (
      <button className="zk-icon-btn" onClick={toggle} aria-label="Przełącz motyw" type="button">
        <MoonIcon className="size-[22px] dark:hidden" />
        <SunIcon className="hidden size-[22px] dark:block" />
      </button>
    );
  }

  return (
    <div className="zk-theme-row">
      <SunIcon className="size-[19px] dark:hidden" />
      <MoonIcon className="hidden size-[19px] dark:block" />
      <span className="dark:hidden">Tryb jasny</span>
      <span className="hidden dark:inline">Tryb ciemny</span>
      <button
        className="zk-theme-switch"
        onClick={toggle}
        aria-label="Przełącz motyw"
        type="button"
      >
        <span className="knob">
          <SunIcon className="size-[14px] dark:hidden" />
          <MoonIcon className="hidden size-[14px] dark:block" />
        </span>
      </button>
    </div>
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
  const initial = email.charAt(0).toUpperCase();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="zk-app">
      <header className="zk-topbar">
        <button
          className="zk-icon-btn"
          onClick={() => setOpen(true)}
          aria-label="Otwórz menu"
          type="button"
        >
          <MenuIcon className="size-[22px]" />
        </button>
        <div className="zk-brand">
          <BrandMark />
          <span className="zk-brand-name">Zakupy</span>
        </div>
        <span className="zk-spacer" />
        <ThemeControls variant="icon" />
        <div className="zk-user-pill">
          <span className="zk-avatar">{initial}</span>
          <span className="zk-user-mail">{email}</span>
        </div>
      </header>

      {/* Drawer */}
      <div
        className={"zk-scrim" + (open ? " open" : "")}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside className={"zk-drawer" + (open ? " open" : "")} aria-hidden={!open}>
        <div className="zk-drawer-head">
          <div className="zk-drawer-brand">
            <BrandMark />
            <span className="zk-brand-name">Zakupy</span>
          </div>
          <div className="zk-drawer-user">
            <span className="zk-avatar-lg">{initial}</span>
            <div style={{ minWidth: 0 }}>
              <div className="label">zalogowano jako</div>
              <div className="mail">{email}</div>
            </div>
          </div>
        </div>

        <NavLinks onNavigate={() => setOpen(false)} />

        <div className="zk-nav-foot">
          <ThemeControls variant="row" />
          <form action={logout}>
            <button className="zk-nav-item" type="submit">
              <LogOutIcon className="size-[20px]" />
              <span>Wyloguj</span>
            </button>
          </form>
        </div>
      </aside>

      {children}
    </div>
  );
}
