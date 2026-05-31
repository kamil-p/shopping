# Shopping App

Internal app built with **Next.js 16** (App Router), **Tailwind CSS + shadcn/ui**,
**SQLite + Drizzle ORM**, and a custom email/password authentication layer.
The whole app is private — every route requires a logged-in user. There is no public
sign-up; users are provisioned with a script.

## Tech stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4 + shadcn/ui components
- SQLite via libsql (`@libsql/client`) + Drizzle ORM (migrations with `drizzle-kit`)
- Custom session auth: random opaque token in an HTTP-only cookie, session rows in SQLite,
  passwords hashed with Argon2id (`@node-rs/argon2`)

## Getting started

```bash
pnpm install          # install dependencies
pnpm db:migrate       # create data/app.db and apply migrations
pnpm create-user      # create your first user (interactive prompts)
pnpm dev              # start the dev server on http://localhost:3000
```

Visiting any page while logged out redirects to `/login`.

> The libsql driver ships prebuilt binaries via npm — there is no native compilation
> step (no node-gyp / Python toolchain required).

## Creating users

There is no registration page — create users from the command line:

```bash
# non-interactive (email + password as arguments)
pnpm create-user alice@example.com "a-strong-password"

# interactive (prompts for email, then a hidden password)
pnpm create-user
```

The script validates the email format and requires a password of at least 8 characters,
and rejects duplicate emails.

## Database

The SQLite file lives at `data/app.db` (override with `DATABASE_PATH`). The file is
git-ignored; the SQL migrations under `drizzle/` are committed.

```bash
pnpm db:generate   # generate a migration after editing src/db/schema.ts
pnpm db:migrate    # apply pending migrations
pnpm db:push       # push schema directly (local prototyping only)
pnpm db:studio     # open Drizzle Studio
```

## Project structure

```
src/
├─ proxy.ts                 # redirects logged-out traffic to /login (cookie-presence gate)
├─ app/
│  ├─ login/page.tsx        # public login page
│  └─ (protected)/          # everything here requires a valid session
│     ├─ layout.tsx         # authoritative DB-backed session check
│     └─ page.tsx           # placeholder home page (design TBD)
├─ components/login-form.tsx
├─ lib/auth/                # password hashing, sessions, cookies, server actions
└─ db/                      # Drizzle schema, client, migrate runner
scripts/create-user.ts      # user provisioning CLI
```

Auth is enforced in two layers: `proxy.ts` cheaply redirects requests with no session
cookie, and the `(protected)` layout authoritatively validates the session against the
database on every request (catching expired or revoked sessions).
