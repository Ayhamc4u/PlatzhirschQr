#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

NODE_VERSION="$(tr -d '[:space:]' < .nvmrc)"
PNPM_VERSION="12.3.4"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

info() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf '\nERROR: %s\n' "$1" >&2
  return 1 2>/dev/null || exit 1
}

info "PlatzhirschQR lokale Entwicklungsumgebung"
printf 'Projekt: %s\nNode:    %s\npnpm:    %s\n' "$ROOT_DIR" "$NODE_VERSION" "$PNPM_VERSION"

if ! command -v git >/dev/null 2>&1; then
  fail "Git fehlt. Bitte Git installieren und setup.sh danach erneut ausführen."
fi

if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
elif command -v nvm >/dev/null 2>&1; then
  :
else
  fail "nvm wurde nicht gefunden. Installiere nvm zuerst unter https://github.com/nvm-sh/nvm und führe danach 'source ~/.bashrc' sowie 'source ./setup.sh' aus."
fi

BASHRC="$HOME/.bashrc"
NVM_MARKER="# PlatzhirschQR: load nvm"
if [ -f "$BASHRC" ] && ! grep -Fq "$NVM_MARKER" "$BASHRC"; then
  info "nvm wird dauerhaft für neue Bash-Terminals aktiviert"
  cat >> "$BASHRC" <<'EOF'

# PlatzhirschQR: load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
EOF
fi

DEFAULT_NODE_MARKER="# PlatzhirschQR: activate default node"
if [ -f "$BASHRC" ] && ! grep -Fq "$DEFAULT_NODE_MARKER" "$BASHRC"; then
  info "Standard-Node wird in neuen Bash-Terminals automatisch aktiviert"
  cat >> "$BASHRC" <<'EOF'

# PlatzhirschQR: activate default node
command -v nvm >/dev/null 2>&1 && nvm use default --silent >/dev/null 2>&1
EOF
fi

info "Node.js $NODE_VERSION aktivieren"
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION" >/dev/null
nvm use "$NODE_VERSION"

if ! command -v corepack >/dev/null 2>&1; then
  fail "Corepack fehlt in der aktiven Node-Installation. Erwartet wird Node $NODE_VERSION über nvm."
fi

info "pnpm $PNPM_VERSION über Corepack aktivieren"
corepack enable
corepack prepare "pnpm@$PNPM_VERSION" --activate
hash -r

ACTUAL_PNPM_VERSION="$(pnpm --version)"
if [ "$ACTUAL_PNPM_VERSION" != "$PNPM_VERSION" ]; then
  fail "Falsche pnpm-Version aktiv: $ACTUAL_PNPM_VERSION (erwartet: $PNPM_VERSION)."
fi

info "Projektabhängigkeiten installieren"
pnpm install --frozen-lockfile

if [ ! -f .env.local ]; then
  info ".env.local fehlt"
  cp .env.example .env.local
  printf '.env.local wurde aus .env.example erstellt. Bitte Secrets/Zugangsdaten eintragen.\n'
fi

REQUIRED_ENV_VARS=(
  MONGODB_URI
  RESTAURANT_ID
  PUBLIC_APP_URL
  READY2ORDER_API_BASE
  READY2ORDER_ACCOUNT_TOKEN
  READY2ORDER_TRAINING_MODE
  NEXTAUTH_URL
  NEXTAUTH_SECRET
  DINEIN_QR_SECRET
  DINEIN_ACCESS_MODE
)

info "Umgebungsvariablen prüfen"
ENV_OK=1
for var in "${REQUIRED_ENV_VARS[@]}"; do
  value="$(sed -nE "s|^${var}=(.*)$|\\1|p" .env.local | tail -n 1 | tr -d '\r')"
  if [ -z "$value" ] || printf '%s' "$value" | grep -Eq 'REPLACE_ME|USER:PASSWORD@HOST'; then
    printf '  [FEHLT] %s\n' "$var"
    ENV_OK=0
  else
    printf '  [OK]    %s\n' "$var"
  fi
done

info "Versionen"
printf 'node: %s\npnpm: %s\n' "$(node --version)" "$(pnpm --version)"

if [ "$ENV_OK" -eq 1 ]; then
  printf '\nSetup abgeschlossen. In neuen Terminals genügt künftig:\n\n  pnpm dev\n\n'
else
  printf '\nSetup technisch abgeschlossen. Trage zuerst die fehlenden Werte in .env.local ein und starte danach:\n\n  pnpm dev\n\n'
fi

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  printf "Hinweis: Wenn du dieses Script mit 'bash setup.sh' gestartet hast und pnpm im aktuellen Terminal danach nicht gefunden wird, einmal 'source ~/.bashrc' ausführen. Alternativ künftig direkt 'source ./setup.sh' verwenden.\n"
fi
