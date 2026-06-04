# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Internal Next.js 16 (App Router) shopping app. Every route is private — there is no
public sign-up. Users are provisioned with a CLI script and authenticate with
email/password against a local SQLite database.

## Commands

```bash
pnpm dev              # dev server (Turbopack) on http://localhost:3000
pnpm build            # production build
pnpm start            # serve the production build
pnpm lint             # eslint (eslint-config-next: core-web-vitals + typescript)

pnpm db:generate      # generate a migration after editing src/db/schema.ts
pnpm db:migrate       # apply pending migrations (creates data/app.db if missing)
pnpm db:push          # push schema directly — local prototyping only
pnpm db:studio        # open Drizzle Studio

pnpm create-user <email> <password>   # provision a user (no args → interactive prompts)
pnpm db:seed <email>                  # insert demo data (a 🥦 Warzywa set + stores) for a user
```

There is no test runner configured.

Package manager is **pnpm**. The DB driver is `@libsql/client` (a prebuilt native addon),
so there is no node-gyp/Python build step on install.

## Architecture

**Auth is enforced in two layers** — this is the most important thing to understand:

1. `src/proxy.ts` — In Next.js 16, middleware was renamed "proxy"; this file is the
   middleware equivalent (exports `proxy` + a `config.matcher`). It runs on the edge with
   **no database access**, so it only does a cheap cookie-*presence* check and redirects
   requests with no session cookie to `/login`. A present-but-stale cookie passes through
   here deliberately — validating it is the layout's job.
2. `src/app/(protected)/layout.tsx` — the authoritative gate. Calls `getCurrentSession()`,
   which validates the token against the DB on every request, catching expired/revoked
   sessions. Everything under the `(protected)` route group is behind this.

**Sessions** (`src/lib/auth/session.ts`): a random opaque token is generated, stored in an
HTTP-only cookie, and the DB stores only its **SHA-256 hash** (`sessions.id`) — never the
raw token. Passwords are hashed with Argon2id (`src/lib/auth/password.ts`). 30-day expiry.
`getCurrentSession` (`src/lib/auth/index.ts`) is wrapped in `React.cache` so layout + page
in one request hit the DB once.

**Login/logout** are React Server Actions in `src/lib/auth/actions.ts`. Login uses
`useActionState` in the client `LoginForm`. The login action runs a dummy hash on
unknown emails to avoid leaking which accounts exist.

**Database** (`src/db/`): SQLite via `@libsql/client` + `drizzle-orm/libsql` (drizzle-kit
dialect `turso`, local `file:` URL). `index.ts` opens the client and caches it on
`globalThis` across dev hot-reloads. Queries are async — terminate with `.get()` (one row),
`.all()` (rows), `.returning().get()` (insert), `.run()` (update/delete). Schema in
`schema.ts`: auth (`users`, `sessions`) plus the shopping domain (`stores`, `sets`,
`set_items`, `lists`, `list_items`). DB path defaults to `data/app.db`, override with
`DATABASE_PATH`. The `.db` file is git-ignored; SQL migrations under `drizzle/` are committed.

**Schema change workflow**: edit `src/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate`.

**Shopping domain**: a **set** (zestaw) is a reusable product template (name, emoji, optional
default store, ordered `set_items`). A `set_item` may carry an `@store` override; otherwise it
inherits the set's default store. **Stores** are a per-user catalog. A **list** (lista) is a
*snapshot* generated from a set via "Zrób listę" — `list_items` copy the resolved store name as
plain text (no FK) and `lists.setId` is `set null`, so editing the set or store catalog later
never mutates an existing list. Data access lives in `src/lib/{stores,sets,lists}/` split into
`queries.ts` (plain async, for Server Components) and `actions.ts` (`"use server"` mutations,
Zod-validated, ownership-scoped via `requireUser()` in `src/lib/auth/require-user.ts`).

**UI structure**: the `(protected)` layout wraps every page in `AppShell`
(`src/components/app-shell/`) — a responsive sidebar that collapses into a hamburger `Sheet`
on mobile, showing the user's email and a `ThemeToggle`. Route paths are English, the UI is
Polish: `/sets` (list) → `/sets/[id]` (the `SetEditor`, the main interactive screen),
`/lists` + `/lists/[id]`, `/stores`.

**Theme**: dark/light via `next-themes` (`attribute="class"`, matching the `.dark` OKLch tokens
in `globals.css`). `ThemeProvider` wraps the root layout (which sets `suppressHydrationWarning`).

**PWA / install**: the app is installable as a standalone home-screen web app via
`src/app/manifest.ts` (`display: "standalone"`), brand icons generated on the fly by the
`next/og` route `src/app/icons/[name]/route.tsx` (192/512/512-maskable + a 180px
apple-touch-icon), and Apple/PWA meta tags in `src/app/layout.tsx`. `InstallButton`
(`src/components/install-button.tsx`, in the `AppShell` top bar next to the `ThemeToggle`) fires
the real `beforeinstallprompt` on Android/Chromium, shows an "add to Home Screen" instructions
dialog on iOS, and hides itself once running standalone (`useSyncExternalStore` on
`display-mode: standalone`). All manifest/icon URLs contain a dot, so `proxy.ts` serves them
publicly with no auth change.

## Conventions

- `@/*` is aliased to `src/*` (tsconfig paths).
- UI is shadcn/ui (style `base-nova`, base color `neutral`) built on `@base-ui/react`;
  primitives live in `src/components/ui/`, icons from `lucide-react`. Toasts via `sonner`.
- `@libsql/client` must never be bundled — it's listed in `serverExternalPackages` in
  `next.config.ts`. Keep DB/auth code server-only (never import `@/db` into a `"use client"`
  file — pass plain serializable props down instead).
- shadcn/ui components here wrap `@base-ui/react` (not Radix). When adding more, use the
  configured `base-nova` style; verify generated files import `@base-ui/react/*`.
- Shared email/password validation lives in `src/lib/auth/credentials.ts` (Zod) and is used
  by both the login action and the create-user script; emails are normalized (trim +
  lowercase) before any DB lookup.

## Versioning

The app version is shown in smaller, muted type next to the "Zakupy" brand name (both the
top bar and the mobile drawer) in `src/components/app-shell/app-shell.tsx`. The single source
of truth is `APP_VERSION` in `src/lib/version.ts` (currently `0.0.0`), kept in sync with the
`"version"` field in `package.json`.

**Bump the version with every commit.** Increment `APP_VERSION` in `src/lib/version.ts` (and
the matching `package.json` `"version"`) as part of each commit — patch by default
(0.0.0 → 0.0.1), minor/major at your discretion for larger changes.

## Deployment

Deployed via Docker to a **Mikrus** VPS. Local-only ops scripts (deploy/backup/restore) live in
`ops/` — they run from your machine and are kept out of rsync. (The `.ts` provisioning tooling in
`scripts/`, e.g. `create-user`/`seed`, still ships — it's needed in the image.) One command does
everything:

```bash
./ops/deploy.sh   # rsync sources → SSH → docker compose up -d --build → health-check /login
```

The 5 config vars (host, remote dir, port) live at the top of `ops/deploy.sh`; the SSH host
`mikrus` is a `~/.ssh/config` alias. `rsync` uses `--exclude-from rsync-exclude.txt`, which
excludes `data/`, `backups/`, `ops/` and `.env` — **a deploy never overwrites the production
DB or env file, and the local-only ops scripts aren't shipped.**

Non-obvious choices baked into the Docker files (don't "fix" these):

- **`node:22-bookworm-slim` (glibc), not Alpine** — `@node-rs/argon2` and libsql ship
  `*-gnu` prebuilt binaries that don't run on musl.
- **Node 22, not 20** — pnpm 11 needs `node:sqlite` (Node ≥ 22).
- **`pnpm install --frozen-lockfile --ignore-scripts`** — pnpm 11 aborts a fresh install on
  unapproved build scripts; skipping is safe because every native module (argon2, libsql,
  esbuild, sharp) uses prebuilts. devDeps are installed (no `NODE_ENV=production` at install
  time) because the build needs `tsx`/`typescript`/`tailwind`.
- **`network_mode: host`** (docker-compose) — the app binds `[::]:3000` so it lands directly
  on the VPS's public IPv6; Docker's default port publish is IPv4-only.
- **`./data:/app/data` volume** — keeps the SQLite DB on the host, surviving container rebuilds.
- **`docker-entrypoint.sh` runs `pnpm db:migrate` then `next start -H :: -p $PORT`** —
  migrations apply automatically on every container start.

### Backups

Two self-contained scripts in `ops/` (same config/style as `deploy.sh`), each taking a
`local`/`server` target. Backups land in `backups/` — git-ignored, so they never reach the repo
(and `backups/` is in `rsync-exclude.txt`, so they're never pushed to the VPS).

```bash
./ops/backup.sh local    # snapshot of the local data/app.db → backups/shopping-app-local-<ts>.db.gz
./ops/backup.sh server   # snapshot of the prod DB on the VPS, pulled down to backups/
./ops/restore.sh local   # restore newest backup into local data/app.db (pass a file to pick one)
./ops/restore.sh server  # restore a backup onto the VPS
```

Non-obvious choices:

- **`sqlite3 .backup`, not a file copy** — uses SQLite's online backup API, so the snapshot is
  consistent even while the app writes (captures committed WAL content). libsql files are plain
  SQLite3, so the stock `sqlite3` reads them; it's auto-installed via `apt` on the VPS if missing.
- **No retention** — every backup is kept; prune `backups/` by hand.
- **Backups are origin-tagged but interchangeable** — any `.db.gz` restores to either target
  (e.g. restore a `server` backup into `local` to debug prod data).
- **`restore.sh` is destructive** — it prompts for a literal `tak`, saves a `*.pre-restore-<ts>`
  copy of the current DB first, and clears stale `-wal`/`-shm` files. `server` restore stops the
  container, swaps the DB, `up -d`, then health-checks `/login`; `local` restore expects `pnpm dev`
  stopped.

## Test user credentials

Login: kamil.check@gmail.com
Password: admin1234
