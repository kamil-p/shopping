# PWA "Install app" — Design

**Date:** 2026-06-02
**Status:** Approved

## Goal

Let the user add the shopping app to a phone home screen as a standalone web app —
a home-screen icon that opens the site full-screen, **without the browser address bar**.
Add an "Install" icon button in the top bar, right next to the dark/light theme toggle.

The button must "do something sensible" on **both** Android and iPhone, even though the
two platforms install PWAs very differently.

## Key platform constraint

iOS Safari does **not** support the `beforeinstallprompt` event — there is no way to trigger
installation programmatically. The only path on iPhone is the system **Share → "Add to Home
Screen"** flow. Android / Chromium browsers **do** fire `beforeinstallprompt`, which we can
capture and replay as a real native install prompt.

Therefore the install button is a small client-side state machine that adapts to the platform,
and the standalone/full-screen behavior comes entirely from PWA configuration (manifest +
icons + Apple meta tags), independent of the button.

## Components

### 1. Web App Manifest — `src/app/manifest.ts`

Next.js App Router metadata convention: exporting `MetadataRoute.Manifest` from `app/manifest.ts`
serves it at `/manifest.webmanifest` and Next auto-injects `<link rel="manifest">`. No manual
link tag needed.

Fields:
- `name: "Zakupy"`, `short_name: "Zakupy"`
- `description`: same as the app metadata
- `start_url: "/"`, `scope: "/"`, `id: "/"`
- `display: "standalone"` — this is what removes the browser address bar
- `lang: "pl"`, `dir: "ltr"`
- `background_color`: light app background `#f4f3ee` (splash screen)
- `theme_color`: `#1f8a52` (brand green)
- `icons`: array referencing the generated PNG routes below — 192×192, 512×512 (`purpose: "any"`)
  and a 512×512 `purpose: "maskable"` for Android adaptive icons.

The manifest is fetched by the browser **without credentials** by default. The route lives at
the app root (not under `(protected)`), and its URL contains a dot (`.webmanifest`), so the
existing `proxy.ts` matcher (`/((?!_next/static|_next/image|favicon.ico|.*\..*).*)`) already
excludes it — it is served publicly with **no proxy change required**.

### 2. App icons — generated programmatically

No binary image assets are committed. A single shared drawing helper renders the brand icon —
a **green background (brand `#1f8a52`, matching the `.zk-brand-mark` gradient) with a centered
white shopping-cart glyph** — and is reused by lightweight `next/og` `ImageResponse` route
handlers. `next/og` ships with Next.js 16 (no new dependency) and uses a WASM renderer, so it
also works in the glibc Docker build.

Routes (all contain a dot, so all are public via the existing matcher — no proxy change):
- `/icons/icon-192.png` — manifest icon (Android), `purpose: "any"`
- `/icons/icon-512.png` — manifest icon (Android), `purpose: "any"`
- `/icons/icon-512-maskable.png` — manifest icon, `purpose: "maskable"` (extra safe-zone padding,
  ~80% content area, so Android's adaptive mask doesn't clip the cart)
- `/icons/apple-icon.png` — 180×180 `apple-touch-icon` for iOS (iOS ignores the manifest icons
  and uses this link instead). iOS composites on an opaque background, so the icon must be fully
  opaque (the green fill covers the whole square; non-maskable variants need no transparent edge).

Implementation note: a single dynamic route handler `src/app/icons/[name]/route.tsx` may serve
all variants by switching on the requested filename (size + maskable padding), sharing the one
draw helper. The favicon stays as the existing `src/app/favicon.ico`.

### 3. Apple / PWA meta tags — `src/app/layout.tsx`

Extend the existing `metadata` export and add a `viewport` export:
- `metadata.appleWebApp: { capable: true, title: "Zakupy", statusBarStyle: "default" }`
  → Next emits `apple-mobile-web-app-capable` / `-title` / `-status-bar-style` (full-screen on iOS).
- `metadata.icons.apple: "/icons/apple-icon.png"` → emits `<link rel="apple-touch-icon">`.
- `export const viewport: Viewport` with:
  - `themeColor` as a light/dark media array (`#f4f3ee` light, `#0f110e` dark) so the mobile
    browser chrome blends with the page background.
  - `viewportFit: "cover"` so the standalone app draws under the iPhone notch / safe areas.

### 4. Install button — `src/components/install-button.tsx` (`"use client"`)

A pure client component (no DB/auth imports). An icon button (`lucide-react` `DownloadIcon`)
styled with the existing `zk-icon-btn` class, rendered in the top bar **immediately before
`<ThemeControls variant="icon" />`** in `src/components/app-shell/app-shell.tsx` (around line 96).

State machine (evaluated client-side after mount, to stay hydration-safe):

1. **Already installed** — `window.matchMedia('(display-mode: standalone)').matches` OR
   `navigator.standalone === true` (iOS) → render nothing (button hidden).
2. **Capturable native prompt available** — on mount, listen for `beforeinstallprompt`,
   call `preventDefault()`, and stash the event. When present, the button calls `prompt()` on it
   (real Android/Chromium install dialog). After the user resolves it, clear the stashed event
   (and hide on `appinstalled`).
3. **iPhone (Safari), no native prompt** — detect iOS via user agent
   (`/iphone|ipad|ipod/i`, not standalone) → the button opens an instructions `Dialog`
   (reuse `src/components/ui/dialog.tsx`): *"Udostępnij → Dodaj do ekranu początkowego"* with the
   Share glyph.
4. **Any other browser without a live prompt** → the same `Dialog`, with a generic instruction
   ("open the browser menu and choose Install / Add to Home Screen").

This guarantees a click always does something useful. A minimal `BeforeInstallPromptEvent`
TypeScript interface is declared locally (it is not in the standard DOM lib types).

The button text/labels are Polish (UI convention); the `aria-label` is "Zainstaluj aplikację".

## Out of scope (deliberately)

- **Service worker / offline cache** — the app is internal, network- and login-gated; offline
  caching adds complexity with no real benefit here.
- **Push notifications.**
- A separate desktop-install UX beyond the generic fallback dialog.
- Adding the button to the side drawer (top-bar placement satisfies the request; can be revisited).

## Testing / verification

No test runner is configured in this repo. Verify by running the app:
- `GET /manifest.webmanifest` returns valid JSON with `display: "standalone"` and icon entries.
- Icon routes render PNGs (`/icons/icon-512.png`, `/icons/apple-icon.png`).
- The install button appears in the top bar next to the theme toggle and opens the instructions
  dialog (desktop browsers won't fire `beforeinstallprompt` synchronously, so the fallback dialog
  is the observable path there).
- Chrome DevTools → Application → Manifest shows the app as installable with no errors.

Capture a screenshot of the top bar (button next to theme toggle) and the instructions dialog
as proof.
