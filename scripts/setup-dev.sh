#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Setting up Foliyo development environment..."

mkdir -p data

if ! command -v node &>/dev/null; then
  echo "Node.js 22.5+ is required: https://nodejs.org/"
  exit 1
fi

if ! node -e "require('node:sqlite')" 2>/dev/null; then
  echo "Node 22.5+ with node:sqlite is required."
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi

echo "→ pnpm install (workspace)"
pnpm install

if [ ! -f apps/core/config.yml ]; then
  cp apps/core/config.yml.example apps/core/config.yml
  echo "Created apps/core/config.yml from example"
fi

echo ""
echo "Done. Start everything:"
echo "  make dev"
echo ""
