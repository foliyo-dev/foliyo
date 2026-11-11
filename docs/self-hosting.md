# Self-hosting Foliyo

## Prerequisites

- VPS with Linux x86_64 or aarch64 (Ubuntu/Debian recommended)
- `curl` or `wget`, and `tar` with xz/lzma support
- [pqpm](https://github.com/pqpm/pqpm) for process management (recommended)
- nginx or Apache

**Host Node.js is not required.** `install.sh` downloads the latest Node **22.x** (LTS line, ≥22.5 for `node:sqlite`) from [nodejs.org](https://nodejs.org) into `~/apps/foliyo/bin/node`. Override with `FOLIYO_NODE_VERSION=22.x.y` if needed.

## Install (release artifacts)

```bash
# Optional process manager
curl -sSL https://raw.githubusercontent.com/pqpm/pqpm/main/install.sh | sudo bash

curl -sSL https://foliyo.dev/install.sh | bash
```

The installer downloads `foliyo-core.tar.gz` + `dashboard-build.tar.gz` from GitHub Releases, installs Node into `apps/foliyo/bin/`, writes `~/.pqpm.toml`, and emits `~/nginx-foliyo.conf`.

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

1. Edit `~/.pqpm.toml` (or copy [`infra/example.pqpm.toml`](../infra/example.pqpm.toml)) — set admin credentials and URLs (`FOLIYO_SITE_URL` = public site, `FOLIYO_DASHBOARD_URL` = `app.` host).
2. Install nginx from `~/nginx-foliyo.conf` or [`infra/example.nginx.conf`](../infra/example.nginx.conf) (replace domains). The dashboard is a static build that calls same-origin `/api` (proxied to Foliyo) and loads `GET /api/public-config` at runtime for your domain URLs — no rebuild per domain.
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

### Optional: AI features (bring your own OpenRouter key)

Self-host unlocks Pro entitlements (unlimited portfolios, PDF, blog, etc.) with **no upgrade path**. AI features (resume PDF/text import, rewrite, summary, theme generation, smarter JD parse) need your own OpenRouter key:

```bash
# https://openrouter.ai/keys — you pay the provider; Foliyo does not meter units on OSS
OPENROUTER_API_KEY=sk-or-…
# Optional (default google/gemini-2.5-flash)
# OPENROUTER_MODEL=google/gemini-2.5-flash
# AI_REWRITE_MAX_TOKENS=400
```

Without a key, `.fio` import and manual library editing still work. Never put a Foliyo-hosted API key in a public self-host install.

### Optional: S3-compatible uploads (R2 / MinIO / AWS)

Project images are always stored and served as **`/uploads/{32hex}.{ext}`** in the DB and HTML. The storage driver only changes where bytes live:

| `FOLIYO_STORAGE` | Behavior |
|---|---|
| `local` (default) | Files under `{dataDir}/uploads` — zero-config OSS |
| `s3` | Put/Get via S3 API (AWS, Cloudflare R2, MinIO) |

```bash
FOLIYO_STORAGE=s3
FOLIYO_S3_BUCKET=my-bucket
FOLIYO_S3_REGION=auto
# R2 / MinIO — set endpoint; AWS can leave empty
# FOLIYO_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
FOLIYO_S3_ACCESS_KEY_ID=…
FOLIYO_S3_SECRET_ACCESS_KEY=…
# FOLIYO_S3_PREFIX=uploads/
```

**Cutover from local disk** (no DB migration):

1. Configure `FOLIYO_S3_*` while still on `FOLIYO_STORAGE=local`
2. `pnpm --filter @foliyo/core storage:sync` (add `-- --dry-run` first)
3. Set `FOLIYO_STORAGE=s3` and restart core
4. Keep local `uploads/` as backup

Avatar upload (still 501) should use the same driver when implemented.

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
