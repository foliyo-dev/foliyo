#!/usr/bin/env bash
# Build browser extension zips for GitHub Releases.
# Output:
#   dist/foliyo-extension-chrome-<version>.zip
#   dist/foliyo-extension-firefox-<version>.zip
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION="$(node -p "require('./apps/core/package.json').version")"
fi
# Strip leading v if a tag was passed.
VERSION="${VERSION#v}"

EXT="$ROOT/apps/extension"
DIST="$ROOT/dist"
mkdir -p "$DIST"
rm -f "$DIST"/foliyo-extension-chrome-*.zip "$DIST"/foliyo-extension-firefox-*.zip

stamp_manifest_version() {
  node -e '
    const fs = require("node:fs");
    const path = process.argv[1];
    const ver = process.argv[2];
    const m = JSON.parse(fs.readFileSync(path, "utf8"));
    m.version = ver;
    fs.writeFileSync(path, JSON.stringify(m, null, 2) + "\n");
  ' "$1" "$VERSION"
}

zip_dist() {
  local out="$1"
  rm -f "$out"
  (
    cd "$EXT/dist"
    # Store paths relative to dist/ so Chrome/Firefox load the zip root as the extension.
    zip -qr "$out" . -x "*.map" -x ".*" -x "*/.*"
  )
  echo "  → $out ($(du -h "$out" | cut -f1))"
}

echo "Building Chrome / Edge extension (v$VERSION)..."
pnpm --filter @foliyo/extension build:prod
stamp_manifest_version "$EXT/dist/manifest.json"
zip_dist "$DIST/foliyo-extension-chrome-${VERSION}.zip"

echo "Building Firefox extension (v$VERSION)..."
pnpm --filter @foliyo/extension build:firefox
stamp_manifest_version "$EXT/dist/manifest.json"
zip_dist "$DIST/foliyo-extension-firefox-${VERSION}.zip"

echo ""
echo "Extension packages in $DIST/"
ls -lh "$DIST"/foliyo-extension-*.zip
