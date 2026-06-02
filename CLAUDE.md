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

## Test user credentials

Login: kamil.check@gmail.com
Password: admin1234
