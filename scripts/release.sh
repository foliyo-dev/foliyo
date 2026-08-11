#!/usr/bin/env bash
# Build OSS release artifacts locally (same as GitHub Release on v* tags).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-dev}"
DIST="$ROOT/dist"
mkdir -p "$DIST"

echo "Building release artifacts (version: $VERSION)..."

./scripts/sync-brand-assets.sh
pnpm --filter @foliyo/dashboard build
SKIP_PNPM_INSTALL="${SKIP_PNPM_INSTALL:-0}" ./scripts/build-core-bundle.sh
./scripts/pack-libs.sh

tar -czf "$DIST/dashboard-build.tar.gz" -C apps/dashboard build

echo ""
echo "Release bundle in $DIST/"
ls -lh "$DIST/foliyo-core.tar.gz" "$DIST/dashboard-build.tar.gz"
ls -lh "$DIST/packages"/foliyo-*.tgz 2>/dev/null || true
echo "Smoke: FOLIYO_ADMIN_EMAIL=admin@localhost FOLIYO_ADMIN_PASSWORD=changeme \\"
echo "         FOLIYO_DATA_DIR=$DIST/smoke-data $DIST/core/foliyo"
