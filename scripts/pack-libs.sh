#!/usr/bin/env bash
# Pack @foliyo/* libraries for GitHub Releases (npm publish later).
# Output: dist/packages/foliyo-{core,brand,ui,themes}-<version>.tgz
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/packages"
mkdir -p "$OUT"
rm -f "$OUT"/foliyo-*.tgz

pack_one() {
  local dir="$1"
  echo "Packing $dir ..."
  (cd "$ROOT/$dir" && pnpm pack --pack-destination "$OUT")
}

pack_one apps/core
pack_one packages/brand
pack_one packages/ui
pack_one packages/themes

echo ""
echo "Library packages in $OUT/"
ls -lh "$OUT"/foliyo-*.tgz
