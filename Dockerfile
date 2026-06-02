# Next.js 16 + SQLite (libsql) na Mikrusa.
# Baza glibc (NIE Alpine) — natywne dodatki @node-rs/argon2 i libsql
# używają prebuiltów *-gnu i nie działają na musl.
# Node 22 (nie 20): pnpm 11 wymaga node:sqlite, dostępnego dopiero od Node 22.
FROM node:22-bookworm-slim

# pnpm przez corepack (wersja zgodna z lokalną: pnpm 11.1.3).
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate

WORKDIR /app

# 1) Zależności — osobna warstwa cache.
#    NIE ustawiamy tu NODE_ENV=production: potrzebujemy devDeps
#    (tsx do migracji, typescript/tailwind do builda).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts: pnpm 11 przerywa świeży install na niezatwierdzonych
# build-scriptach (esbuild). Pomijamy je bezpiecznie — wszystkie natywne
# moduły tu (argon2, libsql, esbuild, sharp) jadą na gotowych prebuiltach.
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2) Źródła + build produkcyjny.
COPY . .
RUN pnpm build

# 3) Runtime.
ENV NODE_ENV=production
EXPOSE 3000

RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]
