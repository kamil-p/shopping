# PWA "Install app" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shopping app installable as a standalone home-screen web app (no browser address bar) on iPhone and Android, with an "Install" icon button in the top bar next to the theme toggle.

**Architecture:** Add the Web App Manifest (Next `app/manifest.ts`) + programmatically generated PNG icons (`next/og` route handler) + Apple/PWA meta tags in the root layout. A client-side `InstallButton` adapts per platform: real `beforeinstallprompt` on Android/Chromium, an instructions dialog on iOS, hidden once installed.

**Tech Stack:** Next.js 16 App Router, `next/og` (`ImageResponse`, built into Next — no new dependency), `@base-ui/react` Dialog, `lucide-react`, TypeScript.

**Testing note:** This repo has **no test runner** (see CLAUDE.md) and adding one is out of scope. Verification is therefore runtime/build-based: `pnpm lint`, `pnpm build`, `curl` against the public manifest/icon routes, and browser-preview checks (login with the test credentials in CLAUDE.md). All manifest/icon URLs contain a dot, so `proxy.ts` already serves them publicly — no proxy change is needed, and `curl` works without a session cookie.

**Working branch:** `feat/pwa-install` (already created; the spec is committed there).

---

### Task 1: Web App Manifest

**Files:**
- Create: `src/app/manifest.ts`

- [ ] **Step 1: Create the manifest route**

`src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Next auto-injects <link rel="manifest">.
// display: "standalone" is what makes the installed app open without the
// browser address bar. Icons point to the generated PNG routes in Task 2.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zakupy",
    short_name: "Zakupy",
    description: "Wewnętrzna aplikacja do zakupów",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "pl",
    dir: "ltr",
    background_color: "#f4f3ee",
    theme_color: "#1f8a52",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 2: Verify it type-checks and lints**

Run: `pnpm lint`
Expected: no errors for `src/app/manifest.ts`.

- [ ] **Step 3: Verify the route serves JSON**

Start the dev server if not running (`pnpm dev`), then:

Run: `curl -s http://localhost:3000/manifest.webmanifest`
Expected: JSON containing `"display":"standalone"` and the three icon entries. (No login needed — the `.webmanifest` URL is public via the proxy matcher.)

- [ ] **Step 4: Commit**

```bash
git add src/app/manifest.ts
git commit -m "$(printf 'feat(pwa): add web app manifest\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: Generated app icons

**Files:**
- Create: `src/app/icons/[name]/route.tsx`

- [ ] **Step 1: Create the icon route handler**

`src/app/icons/[name]/route.tsx`:

```tsx
import { ImageResponse } from "next/og";

// One handler renders every icon variant: green brand background (matching the
// .zk-brand-mark gradient) with a centered white shopping-cart glyph. The cart
// is embedded as a base64 SVG <img> — Satori renders that reliably and we need
// no text (so no font is required). All these URLs contain a dot, so the proxy
// matcher serves them publicly without a session.

type Spec = { size: number; maskable: boolean };

const SPECS: Record<string, Spec> = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "icon-512-maskable.png": { size: 512, maskable: true },
  "apple-icon.png": { size: 180, maskable: false },
};

function cartDataUri(px: number): string {
  // lucide "shopping-cart", white stroke.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.7" ` +
    `stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="8" cy="21" r="1"/>` +
    `<circle cx="19" cy="21" r="1"/>` +
    `<path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const spec = SPECS[name];
  if (!spec) {
    return new Response("Not found", { status: 404 });
  }

  const { size, maskable } = spec;
  // Maskable icons must keep content inside the ~80% safe circle, so the glyph
  // is smaller; "any"/apple icons can use more of the canvas.
  const glyph = Math.round(size * (maskable ? 0.5 : 0.62));

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "linear-gradient(150deg, #1f8a52, #19713f)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={glyph} height={glyph} src={cartDataUri(glyph)} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
```

- [ ] **Step 2: Verify it lints and type-checks**

Run: `pnpm lint`
Expected: no errors for the new route. (The inline eslint-disable suppresses the `no-img-element` rule, which does not apply inside `ImageResponse`.)

- [ ] **Step 3: Verify each icon renders a real PNG of the right size**

With the dev server running:

```bash
for n in icon-192.png icon-512.png icon-512-maskable.png apple-icon.png; do
  curl -s -o "/tmp/$n" -w "$n -> %{content_type}\n" "http://localhost:3000/icons/$n"
  file "/tmp/$n"
done
```

Expected: each line shows `image/png`, and `file` reports `PNG image data, 192 x 192` / `512 x 512` / `512 x 512` / `180 x 180` respectively.
Expected for an unknown name: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/icons/nope.png` → `404`.

> **If an icon comes back empty/broken:** Satori failed to rasterize the SVG `<img>`. Fallback: render the cart as inline JSX `<svg>` children (camelCase props: `strokeWidth`, `strokeLinecap`, `strokeLinejoin`) inside the same flex `<div>` instead of the `<img>`, keeping the same `glyph` width/height and `viewBox="0 0 24 24"`.

- [ ] **Step 4: Commit**

```bash
git add src/app/icons/[name]/route.tsx
git commit -m "$(printf 'feat(pwa): generate brand app icons via next/og\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: Apple / PWA meta tags in the root layout

**Files:**
- Modify: `src/app/layout.tsx` (the `import` line at the top, the `metadata` export, add a `viewport` export)

- [ ] **Step 1: Widen the type import**

In `src/app/layout.tsx`, change the first import line:

```ts
import type { Metadata } from "next";
```

to:

```ts
import type { Metadata, Viewport } from "next";
```

- [ ] **Step 2: Extend `metadata` and add `viewport`**

Replace the existing `metadata` export:

```ts
export const metadata: Metadata = {
  title: "Zakupy",
  description: "Wewnętrzna aplikacja do zakupów",
};
```

with:

```ts
export const metadata: Metadata = {
  title: "Zakupy",
  description: "Wewnętrzna aplikacja do zakupów",
  applicationName: "Zakupy",
  // Full-screen standalone behavior on iOS (emits apple-mobile-web-app-* tags).
  appleWebApp: {
    capable: true,
    title: "Zakupy",
    statusBarStyle: "default",
  },
  // iOS uses apple-touch-icon, not the manifest icons.
  icons: {
    apple: "/icons/apple-icon.png",
  },
};

export const viewport: Viewport = {
  // Blend the mobile browser chrome with the page background per theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0f110e" },
  ],
  // Draw under the iPhone notch / safe areas when running standalone.
  viewportFit: "cover",
};
```

(The `<link rel="manifest">` tag is injected automatically by Next because `app/manifest.ts` exists — no manual tag needed.)

- [ ] **Step 3: Verify lint/type-check**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Verify the tags render on the public /login page**

`/login` uses the same root layout and is public, so its HTML carries the tags:

```bash
curl -s http://localhost:3000/login | grep -oiE '<link[^>]*rel="(manifest|apple-touch-icon)"[^>]*>|<meta[^>]*name="(theme-color|apple-mobile-web-app-capable|apple-mobile-web-app-title)"[^>]*>'
```

Expected: lines for `rel="manifest"`, `rel="apple-touch-icon"` (href `/icons/apple-icon.png`), `name="theme-color"` (two, light/dark), `name="apple-mobile-web-app-capable"`, and `name="apple-mobile-web-app-title"`.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "$(printf 'feat(pwa): add apple/standalone meta tags and themeColor viewport\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: InstallButton component

**Files:**
- Create: `src/components/install-button.tsx`

- [ ] **Step 1: Create the component**

`src/components/install-button.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, PlusSquareIcon, Share2Icon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Not yet in the standard DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallButton() {
  // Everything is decided client-side after mount, so render nothing on the
  // server to stay hydration-safe.
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()));

    const onPrompt = (event: Event) => {
      event.preventDefault(); // stop Chrome's mini-infobar; we trigger it ourselves
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mounted || installed) return null;

  async function handleClick() {
    if (promptEvent) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }
    setDialogOpen(true);
  }

  return (
    <>
      <button
        className="zk-icon-btn"
        onClick={handleClick}
        aria-label="Zainstaluj aplikację"
        type="button"
      >
        <DownloadIcon className="size-[22px]" />
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zainstaluj aplikację</DialogTitle>
            <DialogDescription>
              {isIOS
                ? "Dodaj „Zakupy” do ekranu początkowego, aby otwierać aplikację bez paska adresu."
                : "Zainstaluj „Zakupy”, aby otwierać aplikację jak zwykłą apkę na telefonie."}
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li className="flex flex-wrap items-center gap-1.5">
                Stuknij
                <Share2Icon className="inline size-4 align-text-bottom" aria-hidden />
                (Udostępnij) na dole ekranu.
              </li>
              <li className="flex flex-wrap items-center gap-1.5">
                Wybierz
                <PlusSquareIcon className="inline size-4 align-text-bottom" aria-hidden />
                „Do ekranu początkowego”.
              </li>
              <li>Potwierdź przyciskiem „Dodaj”.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Otwórz menu przeglądarki (⋮).</li>
              <li>Wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.</li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verify lint/type-check**

Run: `pnpm lint`
Expected: no errors. (Confirms the imported `Dialog*` names and `lucide-react` icons resolve.)

- [ ] **Step 3: Commit**

```bash
git add src/components/install-button.tsx
git commit -m "$(printf 'feat(pwa): add platform-aware InstallButton\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: Wire the button into the top bar

**Files:**
- Modify: `src/components/app-shell/app-shell.tsx` (add import; insert `<InstallButton />` before `<ThemeControls variant="icon" />` at ~line 96)

- [ ] **Step 1: Import the component**

In `src/components/app-shell/app-shell.tsx`, add below the existing `import { NavLinks } from "./nav-links";` line:

```tsx
import { InstallButton } from "@/components/install-button";
```

- [ ] **Step 2: Place the button next to the theme toggle**

Find this block in the `<header className="zk-topbar">`:

```tsx
        <span className="zk-spacer" />
        <ThemeControls variant="icon" />
```

and change it to:

```tsx
        <span className="zk-spacer" />
        <InstallButton />
        <ThemeControls variant="icon" />
```

- [ ] **Step 3: Verify lint/type-check and a clean production build**

Run: `pnpm lint && pnpm build`
Expected: lint passes; build completes with no type errors and lists `/manifest.webmanifest` and the `/icons/[name]` route in the route table.

- [ ] **Step 4: Verify in the browser preview**

Start the dev server. In the preview: go to `/login`, sign in with the CLAUDE.md test credentials (`kamil.check@gmail.com` / `admin1234`). On any protected page:
- Confirm the download icon appears in the top bar immediately left of the theme toggle.
- Click it. On a desktop Chromium preview (no `beforeinstallprompt` fires synchronously), the instructions dialog opens with the title "Zainstaluj aplikację".
- Capture a screenshot of (a) the top bar showing the new button next to the theme toggle and (b) the open dialog.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell/app-shell.tsx
git commit -m "$(printf 'feat(pwa): show InstallButton in the top bar\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 6: Final verification & docs

**Files:**
- Modify: `CLAUDE.md` (add a short PWA note under Architecture)

- [ ] **Step 1: Confirm installability in DevTools**

With the dev server running and logged in, open Chrome DevTools → Application → Manifest. Confirm: name "Zakupy", `display: standalone`, all three icons load without errors, and there is no "not installable" warning. (Document the result; this is the authoritative installability check.)

- [ ] **Step 2: Document the feature in CLAUDE.md**

In `CLAUDE.md`, add a short paragraph at the end of the **Architecture** section (after the "Shopping domain" paragraph):

```markdown
**PWA / install**: the app is installable as a standalone home-screen web app via
`src/app/manifest.ts` (`display: "standalone"`), brand icons generated on the fly by the
`next/og` route `src/app/icons/[name]/route.tsx` (192/512/512-maskable + a 180px
apple-touch-icon), and Apple/PWA meta tags in `src/app/layout.tsx`. The `InstallButton`
(`src/components/install-button.tsx`, in the `AppShell` top bar next to the theme toggle) fires
the real `beforeinstallprompt` on Android/Chromium, shows an "Add to Home Screen" instructions
dialog on iOS, and hides itself once running standalone. All manifest/icon URLs contain a dot,
so `proxy.ts` already serves them publicly — no auth change needed.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(printf 'docs: note PWA install support in CLAUDE.md\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:**
- Manifest (`app/manifest.ts`, standalone, icons) → Task 1. ✓
- Generated icons (192/512/512-maskable/apple-180, programmatic, public) → Task 2. ✓
- Apple/PWA meta tags + viewport `themeColor`/`viewportFit` → Task 3. ✓
- Platform-aware InstallButton (native prompt / iOS dialog / generic fallback / hide when installed) → Task 4. ✓
- Placement in top bar next to theme toggle → Task 5. ✓
- Runtime verification (manifest JSON, icon PNGs, head tags, DevTools installability, screenshots) → Tasks 1–6. ✓
- "No proxy change needed" assertion → verified implicitly by `curl` succeeding without a cookie (Tasks 1–2). ✓
- Out-of-scope items (service worker, push) → not present in any task. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every verification step shows an exact command and expected output. ✓

**Type consistency:** `BeforeInstallPromptEvent` defined and used only in Task 4. Icon route key names in `SPECS` (Task 2) exactly match the manifest `src` paths (Task 1: `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-512-maskable.png`) and the `apple` icon href (Task 3: `/icons/apple-icon.png`). `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription` match the real exports in `src/components/ui/dialog.tsx`. `zk-icon-btn` matches the existing top-bar button class. ✓
