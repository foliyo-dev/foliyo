# Self-hosting Foliyo

## Prerequisites

- VPS with Linux (Ubuntu/Debian recommended)
- **Node.js 22.5+** (for built-in `node:sqlite`)
- [pqpm](https://github.com/pqpm/pqpm) for process management (recommended)
- nginx or Apache

## Install (release artifacts)

```bash
# Optional process manager
curl -sSL https://raw.githubusercontent.com/pqpm/pqpm/main/install.sh | sudo bash

curl -sSL https://foliyo.dev/install.sh | bash
```

The installer downloads `foliyo-core.tar.gz` and `dashboard-build.tar.gz` from GitHub Releases, writes `~/.pqpm.toml`, and emits `~/nginx-foliyo.conf`.

Or build from source:

```bash
git clone https://github.com/foliyo-dev/foliyo.git
cd foliyo
./scripts/setup-dev.sh
make release          # sync brand → dashboard → Node core bundle
# Artifacts: dist/foliyo-core.tar.gz, dist/dashboard-build.tar.gz
./dist/core/foliyo    # smoke locally
```

## Configure

1. Edit `~/.pqpm.toml` (or copy [`infra/example.pqpm.toml`](../infra/example.pqpm.toml)) — set admin credentials and URLs.
2. Install nginx from `~/nginx-foliyo.conf` or [`infra/example.nginx.conf`](../infra/example.nginx.conf) (replace domains).
3. Ensure `FOLIYO_ASSETS_DIR` points at the extracted `assets/` next to `server.mjs` (the `./foliyo` wrapper sets this by default).

```bash
export FOLIYO_ADMIN_EMAIL=you@example.com
export FOLIYO_ADMIN_PASSWORD=your-secure-password
export FOLIYO_DATA_DIR=~/data
```

## Start services

```bash
pqpm start foliyo
pqpm status
# or: ~/apps/foliyo/foliyo
```

## First login

Visit `https://app.yourdomain.com`, log in with the admin credentials you set, and fill your portfolio. Publish at `https://yourdomain.com` (or `/u/{handle}`).

## Demo seed (optional)

`make seed-demo` fills sample users (priya, arjun, etc.) for local development and marketing screenshots.

**Do not run `seed-demo` on a production self-host** that already has real data unless you intentionally want demo accounts (`ARGS=--force` wipes/resets demo content).

```bash
# From a source checkout only (needs pnpm + apps/core)
make seed-demo
make seed-demo ARGS=--force   # reset demo users
```

Self-host production path: empty library after first admin login — no seed required.

## Privacy

When you self-host, your data never leaves your server. You control all personal data (DPDP Act 2023).
