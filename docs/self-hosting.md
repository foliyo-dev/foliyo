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

### Optional: Google / GitHub login

Self-host OAuth is **off by default** until you set provider secrets. Leave them empty for email/password only.

```bash
# Master switch (default true). Set false to disable even if secrets are present.
# FOLIYO_OAUTH_ENABLED=true

# Public API origin used in OAuth redirect URIs (defaults to FOLIYO_SITE_URL)
# OAUTH_REDIRECT_BASE=https://yourdomain.com

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

Register callback URLs with each provider:

- `{OAUTH_REDIRECT_BASE}/api/auth/oauth/google/callback`
- `{OAUTH_REDIRECT_BASE}/api/auth/oauth/github/callback`

The dashboard shows “Continue with Google/GitHub” only when the matching secrets are set and `FOLIYO_OAUTH_ENABLED` is not false.

## Database (SQLite vs Postgres)

Default self-host uses **SQLite** (`FOLIYO_DB_DRIVER=sqlite`) — fine for most installs.

**JD / skill matching:**

- **SQLite** — alias-based matching only (Node.js ↔ NodeJS, K8s ↔ Kubernetes, etc.). Fully supported.
- **Postgres** — preferred when you want **better semantic matching** (embedding fallback for unresolved phrases in JDs and resume import). Set `FOLIYO_DB_DRIVER=postgres` and `FOLIYO_DB_URL`, and enable `pgvector` on the database.

See [JD skill matching approach](../../docs/JD_SKILL_MATCHING.md) for the full pipeline and why embeddings are Postgres-only in v1.

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
