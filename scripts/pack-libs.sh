#!/usr/bin/env bash
# Pack @foliyo/* libraries for GitHub Releases (npm publish later).
# Output: dist/packages/foliyo-{core,brand,ui,themes,jobs-client}-<version>.tgz
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

# pnpm pack rewrites workspace:* to bare semver; consumers install from GH Release
# tarballs, so rewrite @foliyo/* deps in the packed core manifest to matching URLs.
rewrite_core_foliyo_deps() {
  local ver tgz tmp dir
  ver="$(node -p "require('$ROOT/apps/core/package.json').version")"
  tgz="$OUT/foliyo-core-${ver}.tgz"
  [[ -f "$tgz" ]] || { echo "missing $tgz" >&2; return 1; }
  tmp="$(mktemp -d)"
  tar -xzf "$tgz" -C "$tmp"
  dir="$tmp/package"
  node --input-type=module -e "
    import { readFileSync, writeFileSync } from 'node:fs';
    const pkgPath = process.argv[1];
    const ver = process.argv[2];
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const base = \`https://github.com/foliyo-dev/foliyo/releases/download/v\${ver}\`;
    const map = {
      '@foliyo/jobs-client': \`\${base}/foliyo-jobs-client-\${ver}.tgz\`,
      '@foliyo/brand': \`\${base}/foliyo-brand-\${ver}.tgz\`,
      '@foliyo/ui': \`\${base}/foliyo-ui-\${ver}.tgz\`,
      '@foliyo/themes': \`\${base}/foliyo-themes-\${ver}.tgz\`,
    };
    for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      const deps = pkg[section];
      if (!deps) continue;
      for (const [name, url] of Object.entries(map)) {
        if (deps[name]) deps[name] = url;
      }
    }
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  " "$dir/package.json" "$ver"
  tar -czf "$tgz" -C "$tmp" package
  rm -rf "$tmp"
  echo "Rewrote @foliyo/* deps in foliyo-core-${ver}.tgz → GH Release URLs"
}

pack_one apps/core
pack_one packages/brand
pack_one packages/ui
pack_one packages/themes
pack_one packages/jobs-client
rewrite_core_foliyo_deps

echo ""
echo "Library packages in $OUT/"
ls -lh "$OUT"/foliyo-*.tgz
