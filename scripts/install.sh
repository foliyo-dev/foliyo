#!/usr/bin/env bash
# Foliyo self-host installer — downloads release artifacts + Node 22 from nodejs.org.
# Host needs curl|wget + tar (xz). No system Node.js required.
set -euo pipefail

RELEASE_BASE="${FOLIYO_RELEASE_BASE:-https://github.com/foliyo-dev/foliyo/releases/latest/download}"
INSTALL_ROOT="${FOLIYO_HOME:-$HOME}"
CORE_DIR="${INSTALL_ROOT}/apps/foliyo"
DASHBOARD_DIR="${INSTALL_ROOT}/apps/dashboard"
DATA_DIR="${INSTALL_ROOT}/data"
LOG_DIR="${INSTALL_ROOT}/logs"
NGINX_OUT="${INSTALL_ROOT}/nginx-foliyo.conf"
# Pin major line for node:sqlite (22.5+). Override with FOLIYO_NODE_VERSION=22.x.y
NODE_MAJOR="${FOLIYO_NODE_MAJOR:-22}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

download() {
  local url="$1" dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$dest"
  else
    wget -q "$url" -O "$dest"
  fi
}

download_stdout() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url"
  else
    wget -q "$url" -O -
  fi
}

detect_node_arch() {
  local m
  m="$(uname -m)"
  case "$m" in
    x86_64|amd64) echo "linux-x64" ;;
    aarch64|arm64) echo "linux-arm64" ;;
    *)
      echo "Unsupported CPU arch: $m (need x86_64 or aarch64)" >&2
      exit 1
      ;;
  esac
}

# Latest Node ${NODE_MAJOR}.x from nodejs.org (prefer LTS flag when present).
resolve_node_version() {
  if [[ -n "${FOLIYO_NODE_VERSION:-}" ]]; then
    echo "$FOLIYO_NODE_VERSION"
    return 0
  fi
  local ver=""
  if command -v python3 >/dev/null 2>&1; then
    ver="$(
      download_stdout "https://nodejs.org/dist/index.json" | python3 -c "
import json, sys
major = int('${NODE_MAJOR}')
data = json.load(sys.stdin)
# Prefer LTS on this major, then any release on this major. node:sqlite needs >=22.5.
for prefer_lts in (True, False):
    for row in data:
        v = row.get('version', '').lstrip('v')
        parts = v.split('.')
        if len(parts) < 2:
            continue
        try:
            maj, minor = int(parts[0]), int(parts[1])
        except ValueError:
            continue
        if maj != major:
            continue
        if maj == 22 and minor < 5:
            continue
        lts = row.get('lts')
        is_lts = bool(lts) and lts is not False
        if prefer_lts and not is_lts:
            continue
        print(v)
        raise SystemExit
"
    )" || true
  fi
  if [[ -z "$ver" ]]; then
    ver="22.22.2"
    echo "Could not resolve Node ${NODE_MAJOR}.x from nodejs.org — using ${ver}" >&2
  fi
  echo "$ver"
}

node_ok() {
  local bin="$1"
  [[ -x "$bin" ]] && "$bin" -e "require('node:sqlite')" >/dev/null 2>&1
}

# Download official Node binary into CORE_DIR/bin/node when missing/incompatible.
ensure_node() {
  local node_bin="$CORE_DIR/bin/node"
  if node_ok "$node_bin"; then
    echo "Using Node $($node_bin -v) at $node_bin"
    return 0
  fi

  local ver arch tarball url tmp
  ver="$(resolve_node_version)"
  arch="$(detect_node_arch)"
  tarball="node-v${ver}-${arch}.tar.xz"
  url="https://nodejs.org/dist/v${ver}/${tarball}"
  echo "Downloading Node v${ver} (${arch}) from nodejs.org…"
  mkdir -p "$CORE_DIR/bin"
  tmp="$(mktemp -d)"
  if ! download "$url" "$tmp/$tarball"; then
    echo "Failed to download $url" >&2
    echo "Check network / set FOLIYO_NODE_VERSION=22.x.y" >&2
    rm -rf "$tmp"
    exit 1
  fi
  if ! tar -xJf "$tmp/$tarball" -C "$CORE_DIR/bin" --strip-components=2 "node-v${ver}-${arch}/bin/node" 2>/dev/null; then
    echo "Failed to extract Node binary (need tar with xz/lzma support)." >&2
    rm -rf "$tmp"
    exit 1
  fi
  chmod +x "$node_bin"
  rm -rf "$tmp"
  if ! node_ok "$node_bin"; then
    echo "Downloaded Node $($node_bin -v 2>/dev/null || echo '?') cannot load node:sqlite (need 22.5+)." >&2
    exit 1
  fi
  echo "Installed Node $($node_bin -v) → $node_bin"
}

echo "Installing Foliyo…"
if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  echo "Need curl or wget to download release artifacts." >&2
  exit 1
fi
need_cmd tar

mkdir -p "$CORE_DIR" "$DASHBOARD_DIR" "$DATA_DIR" "$LOG_DIR"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Keep previously installed Node across reinstalls when still valid.
SAVED_NODE=""
if node_ok "$CORE_DIR/bin/node"; then
  SAVED_NODE="$TMP/saved-node"
  cp -a "$CORE_DIR/bin/node" "$SAVED_NODE"
fi

echo "Downloading core bundle…"
if ! download "$RELEASE_BASE/foliyo-core.tar.gz" "$TMP/foliyo-core.tar.gz"; then
  echo "Release artifact not found: $RELEASE_BASE/foliyo-core.tar.gz" >&2
  echo "Build from source: git clone https://github.com/foliyo-dev/foliyo && make release" >&2
  exit 1
fi

echo "Downloading dashboard…"
if ! download "$RELEASE_BASE/dashboard-build.tar.gz" "$TMP/dashboard.tar.gz"; then
  echo "Release artifact not found: $RELEASE_BASE/dashboard-build.tar.gz" >&2
  exit 1
fi

rm -rf "${CORE_DIR:?}/"*
tar -xzf "$TMP/foliyo-core.tar.gz" -C "$CORE_DIR"
mkdir -p "$CORE_DIR/bin"
if [[ -n "$SAVED_NODE" ]]; then
  cp -a "$SAVED_NODE" "$CORE_DIR/bin/node"
  chmod +x "$CORE_DIR/bin/node"
fi
ensure_node

cat > "$CORE_DIR/foliyo" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export FOLIYO_ASSETS_DIR="${FOLIYO_ASSETS_DIR:-$DIR/assets}"
NODE="$DIR/bin/node"
if [[ ! -x "$NODE" ]]; then
  echo "Node missing at $NODE — re-run: curl -sSL https://foliyo.dev/install.sh | bash" >&2
  exit 1
fi
exec "$NODE" "$DIR/server.mjs" "$@"
EOF
chmod +x "$CORE_DIR/foliyo"

# dashboard-build.tar.gz may contain a top-level build/ or flat static files
rm -rf "${DASHBOARD_DIR:?}/"*
mkdir -p "$DASHBOARD_DIR/build"
if tar -tzf "$TMP/dashboard.tar.gz" | head -1 | grep -q '^build/'; then
  tar -xzf "$TMP/dashboard.tar.gz" -C "$DASHBOARD_DIR"
else
  tar -xzf "$TMP/dashboard.tar.gz" -C "$DASHBOARD_DIR/build"
fi

# pqpm config
if [[ ! -f "${INSTALL_ROOT}/.pqpm.toml" ]]; then
  cat > "${INSTALL_ROOT}/.pqpm.toml" <<EOF
# Generated by Foliyo install.sh — edit secrets before first start
[service.foliyo]
command = "${CORE_DIR}/foliyo"
restart = "always"
max_memory = "1GB"
cpu_limit = "40%"
working_dir = "${INSTALL_ROOT}"
log_file = "${LOG_DIR}/foliyo.log"
env = {
  FOLIYO_PORT = "8080",
  FOLIYO_DB_DRIVER = "sqlite",
  FOLIYO_DB_PATH = "${DATA_DIR}/foliyo.db",
  FOLIYO_DATA_DIR = "${DATA_DIR}",
  FOLIYO_ASSETS_DIR = "${CORE_DIR}/assets",
  FOLIYO_MODE = "single",
  FOLIYO_SITE_URL = "https://yourdomain.com",
  FOLIYO_DASHBOARD_URL = "https://app.yourdomain.com",
  FOLIYO_ADMIN_EMAIL = "you@example.com",
  FOLIYO_ADMIN_PASSWORD = "change-me",
  NODE_ENV = "production"
}
EOF
  echo "Created ${INSTALL_ROOT}/.pqpm.toml — set FOLIYO_ADMIN_* and domain URLs."
fi

# nginx example with this install's paths
cat > "$NGINX_OUT" <<EOF
# Generated by Foliyo install.sh — copy into sites-available / Virtualmin
# app.yourdomain.com → dashboard (static)
server {
    listen 80;
    server_name app.yourdomain.com;
    root ${DASHBOARD_DIR}/build;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }

    location ~ ^/(api|mesh)/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}

# yourdomain.com → public site (core)
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_valid 200 1h;
        add_header Cache-Control "public, max-age=3600";
    }
}
EOF

echo ""
echo "Foliyo installed (Node from nodejs.org — no system Node required)."
echo "  Core:      ${CORE_DIR}/foliyo"
echo "  Node:      ${CORE_DIR}/bin/node ($("$CORE_DIR/bin/node" -v))"
echo "  Dashboard: ${DASHBOARD_DIR}/build"
echo "  Data:      ${DATA_DIR}"
echo "  nginx:     ${NGINX_OUT}"
echo ""
echo "Next:"
echo "  1. Edit ${INSTALL_ROOT}/.pqpm.toml (admin email/password + site URLs)"
echo "  2. Install nginx config from ${NGINX_OUT} (replace yourdomain.com)"
echo "  3. pqpm start foliyo   # or: ${CORE_DIR}/foliyo"
echo ""
echo "Optional demo content (dev/marketing only):"
echo "  From a source checkout: make seed-demo"
echo "  Do not run seed-demo on a production self-host with real data."
