# Self-hosting Foliyo

## Prerequisites

- VPS with Linux (Ubuntu/Debian recommended)
- [pqpm](https://github.com/pqpm/pqpm) for process management
- nginx or Apache
- Optional: PHP 8.1+ only if you run a separate landing site (not required for the OSS repo)

## Install

```bash
curl -sSL https://raw.githubusercontent.com/pqpm/pqpm/main/install.sh | sudo bash
curl -sSL https://foliyo.dev/install.sh | bash
```

Or build from source:

```bash
git clone https://github.com/foliyo-dev/foliyo.git
cd foliyo
./scripts/setup-dev.sh
make build
```

## Configure

1. Copy `infra/example.pqpm.toml` to `~/.pqpm.toml` and set paths.
2. Copy `infra/example.nginx.conf` into your web server (replace domains).
3. Set environment variables (see `FOLIYO_SCAFFOLD.md` §20).

```bash
export FOLIYO_ADMIN_EMAIL=you@example.com
export FOLIYO_ADMIN_PASSWORD=your-secure-password
export FOLIYO_DATA_DIR=~/data
```

## Start services

```bash
pqpm start foliyo
pqpm status
```

## First login

Visit `https://app.yourdomain.com`, log in with the admin credentials you set, and fill your portfolio.

## Privacy

When you self-host, your data never leaves your server. You control all personal data (DPDP Act 2023).
