#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Konfiguracja — przy kopiowaniu do innego projektu zmień te 5 linii.
APP_NAME="shopping-app"
SSH_HOST="mikrus"
REMOTE_DIR="/opt/apps/${APP_NAME}"
PORT="3000"
# ─────────────────────────────────────────────────────────────

cd "$(dirname "${BASH_SOURCE[0]}")/.."   # katalog projektu (skrypty leżą w ops/)

echo "▶ [1/4] Połączenie + katalogi na serwerze..."
ssh -o ConnectTimeout=10 "$SSH_HOST" "mkdir -p '${REMOTE_DIR}/data'"

echo "▶ [2/4] Wysyłka źródeł (rsync, bez nadpisywania data/ i .env)..."
rsync -az --delete --exclude-from="rsync-exclude.txt" ./ "${SSH_HOST}:${REMOTE_DIR}/"

echo "▶ [3/4] Build + start kontenera (migracje w entrypoincie)..."
ssh "$SSH_HOST" "cd '${REMOTE_DIR}' && docker compose up -d --build"

echo "▶ [4/4] Health-check (do 60s)..."
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
echo "✅ Gotowe"
