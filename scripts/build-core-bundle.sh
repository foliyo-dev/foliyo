#!/usr/bin/env bash
# Bundle @foliyo/core into a Node-runnable tree (no node_modules on the VPS).
# Host Node is not required at install time — install.sh downloads Node 22 from nodejs.org
# into apps/foliyo/bin/. Local/CI can use PATH node via the wrapper fallback.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/core"
ASSETS="$OUT/assets"

cd "$ROOT"

if ! command -v pnpm >/dev/null; then
  echo "pnpm is required" >&2
  exit 1
fi

if [[ "${SKIP_PNPM_INSTALL:-}" != "1" ]]; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
fi

rm -rf "$OUT"
mkdir -p "$ASSETS/core" "$ASSETS/themes" "$OUT/bin"

echo "Bundling core → $OUT/server.mjs"
pnpm exec esbuild "$ROOT/apps/core/src/index.ts" \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --packages=bundle \
  --banner:js="import { createRequire as __foliyoCreateRequire } from 'node:module'; import { fileURLToPath as __foliyoFileURLToPath } from 'node:url'; import { dirname as __foliyoDirname } from 'node:path'; const require = __foliyoCreateRequire(import.meta.url); const __filename = __foliyoFileURLToPath(import.meta.url); const __dirname = __foliyoDirname(__filename);" \
  --outfile="$OUT/server.mjs"

echo "Copying runtime assets"
cp -a "$ROOT/apps/core/src/migrations" "$ASSETS/core/migrations"
cp -a "$ROOT/apps/core/src/templates" "$ASSETS/core/templates"
cp -a "$ROOT/apps/core/public" "$ASSETS/core/public"
# Ontology seed CSVs — loadSeedPacks resolves next to server.mjs (dist/core/seed)
cp -a "$ROOT/packages/jobs-client/seed" "$OUT/seed"
mkdir -p "$ASSETS/themes"
cp -a "$ROOT/packages/themes/portfolio" "$ASSETS/themes/portfolio"
cp -a "$ROOT/packages/themes/resume" "$ASSETS/themes/resume"
if [[ -f "$ROOT/packages/themes/package.json" ]]; then
  cp "$ROOT/packages/themes/package.json" "$ASSETS/themes/package.json"
fi

# Wrapper: prefer install.sh-managed bin/node; fall back to PATH for local/CI smoke.
cat > "$OUT/foliyo" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export FOLIYO_ASSETS_DIR="${FOLIYO_ASSETS_DIR:-$DIR/assets}"
if [[ -x "$DIR/bin/node" ]]; then
  exec "$DIR/bin/node" "$DIR/server.mjs" "$@"
fi
if command -v node >/dev/null 2>&1; then
  exec node "$DIR/server.mjs" "$@"
fi
echo "Node.js not found. Re-run: curl -sSL https://foliyo.dev/install.sh | bash" >&2
echo "(or install Node 22.5+ on PATH for local smoke)" >&2
exit 1
EOF
chmod +x "$OUT/foliyo"

mkdir -p "$ROOT/dist"
tar -czf "$ROOT/dist/foliyo-core.tar.gz" -C "$OUT" .
echo "Created $ROOT/dist/foliyo-core.tar.gz"
echo "Run:  $OUT/foliyo"
echo "  (install.sh places Node at bin/node; PATH node works for local/CI)"
