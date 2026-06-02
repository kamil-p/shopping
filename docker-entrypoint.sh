#!/bin/sh
set -e

echo "▶ Migracje bazy danych (Drizzle)..."
pnpm db:migrate

echo "▶ Start Next.js na [::]:${PORT:-3000} ..."
exec pnpm exec next start -H :: -p "${PORT:-3000}"
