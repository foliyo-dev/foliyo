#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-dev}"
DIST="$ROOT/dist"
mkdir -p "$DIST"

echo "Building release artifacts (version: $VERSION)..."

pnpm build
pnpm --filter @foliyo/core compile:amd64 2>/dev/null || echo "Skip compile (deno not installed)"

if [ -d apps/dashboard/build ]; then
  tar -czf "$DIST/dashboard-build.tar.gz" -C apps/dashboard build
fi

echo "Release bundle in $DIST/"
