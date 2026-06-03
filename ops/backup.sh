#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Konfiguracja — przy kopiowaniu do innego projektu zmień te linie.
APP_NAME="shopping-app"
SSH_HOST="mikrus"
REMOTE_DIR="/opt/apps/${APP_NAME}"
DB_FILE="data/app.db"     # lokalnie ./data/app.db, na serwerze ${REMOTE_DIR}/data/app.db
BACKUP_DIR="backups"      # lokalny katalog na kopie (poza gitem i poza deployem)
# ─────────────────────────────────────────────────────────────

usage() {
  echo "Użycie: $(basename "$0") <local|server>"
  echo "  local  — spójna migawka lokalnej bazy ${DB_FILE}"
  echo "  server — spójna migawka produkcyjnej bazy z ${SSH_HOST} (${REMOTE_DIR}/${DB_FILE})"
  echo ""
  echo "Kopia ląduje w ./${BACKUP_DIR}/${APP_NAME}-<local|server>-<data>.db.gz"
}

TARGET="${1:-}"
if [ "$TARGET" != "local" ] && [ "$TARGET" != "server" ]; then
  usage
  exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."   # katalog projektu (skrypty leżą w ops/)
mkdir -p "$BACKUP_DIR"

TS=$(date +%Y%m%d-%H%M%S)
OUT="${BACKUP_DIR}/${APP_NAME}-${TARGET}-${TS}.db.gz"

# `sqlite3 .backup` używa online backup API → spójna kopia nawet przy aktywnych
# zapisach/WAL. Pliki libsql to zwykły format SQLite3, więc standardowy sqlite3 je czyta.

if [ "$TARGET" = "local" ]; then
  echo "▶ [1/2] Migawka lokalnej bazy (${DB_FILE})..."
  command -v sqlite3 >/dev/null 2>&1 || { echo "❌ brak sqlite3 — zainstaluj: brew install sqlite3"; exit 1; }
  [ -f "$DB_FILE" ] || { echo "❌ nie znaleziono lokalnej bazy: ${DB_FILE}"; exit 1; }
  sqlite3 "$DB_FILE" ".backup '${OUT%.gz}'"
  echo "▶ [2/2] Kompresja..."
  gzip -f "${OUT%.gz}"
else
  echo "▶ [1/2] Migawka produkcyjnej bazy na ${SSH_HOST}..."
  ssh "$SSH_HOST" "DB='${REMOTE_DIR}/${DB_FILE}' OUT='/tmp/${APP_NAME}-${TS}.db' bash -s" <<'REMOTE'
set -e
command -v sqlite3 >/dev/null 2>&1 || { echo "▶ instaluję sqlite3..."; apt-get update -qq && apt-get install -y -qq sqlite3; }
[ -f "$DB" ] || { echo "❌ nie znaleziono bazy na serwerze: $DB"; exit 1; }
sqlite3 "$DB" ".backup '$OUT'"
gzip -f "$OUT"
REMOTE
  echo "▶ [2/2] Pobranie i sprzątanie serwera..."
  scp "${SSH_HOST}:/tmp/${APP_NAME}-${TS}.db.gz" "$OUT"
  ssh "$SSH_HOST" "rm -f '/tmp/${APP_NAME}-${TS}.db.gz'"
fi

# Weryfikacja integralności + raport rozmiaru.
gzip -t "$OUT"
SIZE=$(du -h "$OUT" | cut -f1)

echo ""
echo "✅ Backup gotowy: ${OUT} (${SIZE})"
