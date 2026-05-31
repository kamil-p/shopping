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
```

There is no test runner configured.

Package manager is **pnpm**. `better-sqlite3` is a native module; if `pnpm install`
fails with a node-gyp/Python error, it needs Python ≥ 3.8:
`npm_config_python=/usr/bin/python3 pnpm install`.

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

**Database** (`src/db/`): SQLite via `better-sqlite3` + Drizzle ORM. `index.ts` opens the
connection (WAL mode, foreign keys ON) and caches it on `globalThis` across dev hot-reloads.
Schema in `schema.ts` (two tables: `users`, `sessions`). DB path defaults to `data/app.db`,
override with `DATABASE_PATH`. The `.db` file is git-ignored; SQL migrations under
`drizzle/` are committed.

**Schema change workflow**: edit `src/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate`.

## Conventions

- `@/*` is aliased to `src/*` (tsconfig paths).
- UI is shadcn/ui (style `base-nova`, base color `neutral`) built on `@base-ui/react`;
  primitives live in `src/components/ui/`, icons from `lucide-react`. Toasts via `sonner`.
- `better-sqlite3` must never be bundled — it's listed in `serverExternalPackages` in
  `next.config.ts`. Keep DB/auth code server-only.
- Shared email/password validation lives in `src/lib/auth/credentials.ts` (Zod) and is used
  by both the login action and the create-user script; emails are normalized (trim +
  lowercase) before any DB lookup.
