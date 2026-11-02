#!/usr/bin/env bash
# Runs the whole site on this machine: the Worker (API, database, image bucket) and Vite with hot reload.
# Nothing here writes to the live site.
#
#   scripts/admin-sandbox.sh               empty sandbox in .admin-sandbox.local/   (npm run dev:admin)
#   scripts/admin-sandbox.sh --live-copy   copy of the live site in .live-copy.local/ (npm run dev:local)
#   add --refresh to throw the local copy away and start again (with --live-copy: copy the live site again)
#
# The live copy is made once, on the first run, from the live site's public pages, so it holds what visitors see:
# settings, home cards, page layouts, published projects and their pictures. Changes you make locally stay local.
set -euo pipefail
cd "$(dirname "$0")/.."

STATE=.admin-sandbox.local
LIVE_COPY=0
REFRESH=0
for arg in "$@"; do
  case "$arg" in
    --live-copy) LIVE_COPY=1; STATE=.live-copy.local ;;
    --refresh) REFRESH=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

API_PORT=8789
SITE_PORT=5181
SITE_URL="http://localhost:$SITE_PORT"

if [ ! -f .dev.vars ]; then
  echo "Missing .dev.vars. It needs ADMIN_USER, ADMIN_PASS and ADMIN_SESSION_SECRET." >&2
  exit 1
fi

for port in "$API_PORT" "$SITE_PORT"; do
  if ss -ltnH "sport = :$port" | grep -q .; then
    echo "Port $port is already in use. A local site may already be running: $SITE_URL" >&2
    exit 1
  fi
done

if [ "$REFRESH" = 1 ]; then
  rm -rf "$STATE"
fi

mkdir -p "$STATE"
if [ ! -d "$STATE/v3/d1" ]; then
  echo "Creating the local database..."
  if ! CI=1 ./node_modules/.bin/wrangler d1 migrations apply nbdevlab-db --local --persist-to "$STATE" >"$STATE/migrate.log" 2>&1; then
    echo "Creating the database failed. See $STATE/migrate.log" >&2
    rm -rf "$STATE/v3"
    exit 1
  fi
  if [ "$LIVE_COPY" = 1 ]; then
    echo "Copying the live site's public content..."
    if ! node scripts/copy-live-site.mjs "$STATE"; then
      echo "Copying failed, so the half-made copy was removed. Run it again to retry." >&2
      rm -rf "$STATE"
      exit 1
    fi
  fi
fi

./node_modules/.bin/wrangler dev --local --ip 127.0.0.1 --port "$API_PORT" --persist-to "$STATE" \
  --show-interactive-dev-session=false >"$STATE/worker.log" 2>&1 &
worker=$!
trap 'kill "$worker" 2>/dev/null || true' EXIT

echo
echo "Site:  $SITE_URL"
echo "Admin: $SITE_URL/admin  (sign in with ADMIN_USER and ADMIN_PASS from .dev.vars, not your real login)"
echo "Ctrl-C stops it."
LOCAL_API_ORIGIN="http://127.0.0.1:$API_PORT" ./node_modules/.bin/vite --port "$SITE_PORT" --strictPort
