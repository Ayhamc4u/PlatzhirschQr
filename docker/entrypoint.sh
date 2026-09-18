#!/bin/sh
set -eu

if [ "${SYNC_READY2ORDER_ON_STARTUP:-true}" = "true" ]; then
  echo "[startup] Synchronisiere ready2order Produkte, Menüs und Tische ..."
  node scripts/sync-ready2order-products.js
  node scripts/sync-ready2order-menu.js
  node scripts/sync-ready2order-tables.js
  echo "[startup] ready2order Synchronisation abgeschlossen."
else
  echo "[startup] ready2order Synchronisation übersprungen (SYNC_READY2ORDER_ON_STARTUP=${SYNC_READY2ORDER_ON_STARTUP:-unset})."
fi

exec "$@"
