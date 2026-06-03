#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Konfiguracja — przy kopiowaniu do innego projektu zmień te linie.
APP_NAME="shopping-app"
SSH_HOST="mikrus"
REMOTE_DIR="/opt/apps/${APP_NAME}"
DB_FILE="data/app.db"     # lokalnie ./data/app.db, na serwerze ${REMOTE_DIR}/data/app.db
BACKUP_DIR="backups"      # lokalny katalog z kopiami
PORT="3000"               # do health-checku po restore na serwer
# ─────────────────────────────────────────────────────────────

usage() {
  echo "Użycie: $(basename "$0") <local|server> [plik.db.gz]"
  echo "  local  — przywróć backup do lokalnej bazy ${DB_FILE}"
  echo "  server — przywróć backup na ${SSH_HOST} (${REMOTE_DIR}/${DB_FILE})"
  echo ""
  echo "Bez podania pliku bierze najnowszy z ./${BACKUP_DIR}/. Można restore'ować"
  echo "dowolny plik niezależnie od pochodzenia (np. backup serwera do local)."
}

TARGET="${1:-}"
if [ "$TARGET" != "local" ] && [ "$TARGET" != "server" ]; then
  usage
  exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."   # katalog projektu (skrypty leżą w ops/)

# Wybór pliku: argument albo najnowszy w katalogu backups/.
FILE="${2:-}"
if [ -z "$FILE" ]; then
  FILE=$(ls -t "${BACKUP_DIR}"/*.db.gz 2>/dev/null | head -1 || true)
  [ -n "$FILE" ] || { echo "❌ brak backupów w ./${BACKUP_DIR}/ — podaj plik jawnie."; exit 1; }
fi
[ -f "$FILE" ] || { echo "❌ nie znaleziono pliku: ${FILE}"; exit 1; }

gzip -t "$FILE" || { echo "❌ uszkodzony plik gzip: ${FILE}"; exit 1; }

TS=$(date +%Y%m%d-%H%M%S)

# Restore jest destrukcyjny — jawne potwierdzenie.
if [ "$TARGET" = "local" ]; then
  echo "⚠ Zatrzymaj dev server (pnpm dev) zanim potwierdzisz."
fi
read -r -p "Nadpisać bazę (${TARGET}) plikiem ${FILE}? Wpisz 'tak': " ans
[ "$ans" = "tak" ] || { echo "Anulowano."; exit 0; }

if [ "$TARGET" = "local" ]; then
  echo "▶ Przywracanie do lokalnej bazy (${DB_FILE})..."
  mkdir -p "$(dirname "$DB_FILE")"
  # Kopia bezpieczeństwa + usunięcie starych WAL/SHM (rozjazd z nową bazą).
  [ -f "$DB_FILE" ] && cp "$DB_FILE" "${DB_FILE}.pre-restore-${TS}"
  rm -f "${DB_FILE}-wal" "${DB_FILE}-shm"
  gunzip -c "$FILE" > "$DB_FILE"
  echo ""
  echo "✅ Przywrócono. Kopia poprzedniej: ${DB_FILE}.pre-restore-${TS}"
  echo "   Uruchom ponownie: pnpm dev"
else
  echo "▶ [1/3] Wysyłka backupu na ${SSH_HOST}..."
  scp "$FILE" "${SSH_HOST}:/tmp/restore-${TS}.db.gz"

  echo "▶ [2/3] Stop kontenera → podmiana bazy → start (migracje w entrypoincie)..."
  ssh "$SSH_HOST" "DIR='${REMOTE_DIR}' DB='${DB_FILE}' TS='${TS}' bash -s" <<'REMOTE'
set -e
cd "$DIR"
docker compose stop
[ -f "$DB" ] && cp "$DB" "${DB}.pre-restore-${TS}"
rm -f "${DB}-wal" "${DB}-shm"
gunzip -c "/tmp/restore-${TS}.db.gz" > "$DB"
docker compose up -d
rm -f "/tmp/restore-${TS}.db.gz"
REMOTE

  echo "▶ [3/3] Health-check (do 60s)..."
  ssh "$SSH_HOST" "PORT='${PORT}' REMOTE_DIR='${REMOTE_DIR}' bash -s" <<'REMOTE'
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null --max-time 5 "http://[::1]:${PORT}/login"; then
    echo "✅ Apka odpowiada (próba ${i})."
    exit 0
  fi
  sleep 2
done
echo "❌ Brak odpowiedzi po 60s. Ostatnie logi:"
cd "${REMOTE_DIR}" && docker compose logs --tail=80
exit 1
REMOTE

  echo ""
  echo "✅ Przywrócono na serwer. Kopia poprzedniej: ${REMOTE_DIR}/${DB_FILE}.pre-restore-${TS}"
fi
