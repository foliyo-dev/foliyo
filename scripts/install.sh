#!/bin/bash
set -euo pipefail

RELEASE_BASE="https://github.com/foliyo-dev/foliyo/releases/latest/download"
BIN_DIR="${HOME}/bin"
DATA_DIR="${HOME}/data"
DASHBOARD_DIR="${HOME}/apps/dashboard"

echo "Installing Foliyo..."

mkdir -p "$BIN_DIR" "$DATA_DIR" "$DASHBOARD_DIR/build" "${HOME}/logs"

wget -q "$RELEASE_BASE/foliyo-linux-amd64" -O "$BIN_DIR/foliyo" || {
  echo "Release not found. Build from source: https://github.com/foliyo-dev/foliyo"
  exit 1
}
wget -q "$RELEASE_BASE/dashboard-build.tar.gz" -O /tmp/dashboard.tar.gz
chmod +x "$BIN_DIR/foliyo"
tar -xzf /tmp/dashboard.tar.gz -C "$DASHBOARD_DIR"

if [ ! -f "${HOME}/.pqpm.toml" ]; then
  cp "$(dirname "$0")/../infra/example.pqpm.toml" "${HOME}/.pqpm.toml"
  echo "Created ~/.pqpm.toml — edit paths and env vars, then: pqpm start foliyo"
fi

echo ""
echo "Foliyo installed to $BIN_DIR/foliyo"
echo "Copy infra/example.nginx.conf into your web server."
echo "Set FOLIYO_ADMIN_EMAIL and FOLIYO_ADMIN_PASSWORD before first start."
