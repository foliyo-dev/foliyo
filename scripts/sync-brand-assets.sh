#!/usr/bin/env bash
# Sync @foliyo/brand SVG assets into app static dirs (runtime / favicon serving).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRAND="$ROOT/packages/brand/assets"

copy_into() {
  local dest="$1"
  mkdir -p "$dest"
  cp "$BRAND"/*.svg "$dest/"
  echo "Synced brand assets → $dest"
}

copy_into "$ROOT/apps/dashboard/static/images"
cp "$BRAND/foliyo-icon.svg" "$ROOT/apps/dashboard/static/favicon.svg"
echo "Synced favicon → apps/dashboard/static/favicon.svg"

mkdir -p "$ROOT/apps/core/public/static/images"
cp "$BRAND/foliyo-icon.svg" "$ROOT/apps/core/public/static/images/"
cp "$BRAND/foliyo-logo-tagline.svg" "$ROOT/apps/core/public/static/images/"
echo "Synced core public images"

# Convenience mirrors at stack root (optional)
if [[ -d "$ROOT/../logos" ]]; then
  cp "$BRAND"/*.svg "$ROOT/../logos/"
  echo "Synced stack logos/ mirror"
fi
if [[ -d "$ROOT/../brand/logo" ]]; then
  cp "$BRAND"/*.svg "$ROOT/../brand/logo/"
  echo "Synced stack brand/logo mirror"
fi
