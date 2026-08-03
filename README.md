# Foliyo

**Your folio. Your way.**

Open-source multi-portfolio + resume platform (user blog is post-MVP). Self-host on your VPS or use the hosted service at [foliyo.dev](https://foliyo.dev).

## Stack

| App | Purpose | Tech |
|-----|---------|------|
| `apps/core` | API + public portfolio pages | Hono + MeshQL + SQLite |
| `apps/dashboard` | Admin UI — content library, portfolios, resume | SvelteKit (static) |

TypeScript everywhere. Content is a global library; portfolios and resumes select from it. Free = 1 portfolio; Pro = unlimited.

## Quick start (development)

Requires **Node.js 22.5+** and **pnpm**.

```bash
make setup    # once: pnpm install + config
make dev      # tmux: core + dashboard
```

| Service | URL |
|---------|-----|
| Core API + public site | http://localhost:8080 |
| MeshQL reads | http://localhost:8080/mesh |
| Dashboard | http://localhost:5173 |

Default login: `admin@localhost` / `changeme` (override with `FOLIYO_ADMIN_EMAIL` / `FOLIYO_ADMIN_PASSWORD`).

```bash
make seed-demo            # fill admin + sample users (priya, arjun)
make seed-demo ARGS=--force
```

Public demos after seed: `/u/admin`, `/u/priya`, `/u/priya/opensource`, `/u/arjun`.

```bash
make dev-stop-tmux    # stop all
make dev-attach-tmux  # re-attach
make help             # all commands
```

## Self-hosting

See [docs/self-hosting.md](docs/self-hosting.md).

```bash
curl -sSL https://foliyo.dev/install.sh | bash
```

When you self-host Foliyo, your data never leaves your server. You are the Data Fiduciary.

## License

MIT — see LICENSE

## Docs

- [docs/ROADMAP.md](docs/ROADMAP.md) — engineering build order (start here for “what’s next”)
- [FOLIYO_SCAFFOLD.md](FOLIYO_SCAFFOLD.md) — full architecture reference
- [docs/api.md](docs/api.md) — API contract
- [bruno/](bruno/) — Bruno API collection (local testing)
- [docs/themes.md](docs/themes.md) — theme development
- Stack docs: [FOLIYO_EXECUTION_PLAN.md](../docs/FOLIYO_EXECUTION_PLAN.md) (MVP/GTM)
