# Foliyo API

Base URL: `http://localhost:8080` (production: proxied at `/api` on the dashboard domain)

## Auth

Opaque Bearer tokens (stored in `sessions` table, revocable on logout).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Returns `{ "token": "...", "user": { ... } }` |
| POST | `/api/auth/logout` | `Authorization: Bearer <token>` — deletes token |
| GET | `/api/auth/me` | `Authorization: Bearer <token>` — current user |

## Resources (authenticated)

| Method | Path |
|--------|------|
| GET, PUT | `/api/profile` |
| GET, POST, PUT, DELETE | `/api/skills`, `/api/skills/:id` |
| GET, POST, PUT, DELETE | `/api/projects`, `/api/projects/:id` |
| GET, POST, PUT, DELETE | `/api/experience`, `/api/experience/:id` |
| GET, POST, PUT, DELETE | `/api/education`, `/api/education/:id` |
| GET | `/api/resume/themes`, `/api/resume/preview`, `/api/resume/export` |
| GET, PUT | `/api/settings` |
| CRUD | `/api/portfolios`, `/api/portfolios/:id` |
| CRUD | `/api/resumes`, `/api/resumes/:id` |

## Public (no auth)

| Method | Path |
|--------|------|
| GET | `/` — portfolio home |
| GET | `/projects` |
| GET | `/resume` |
| GET | `/r/:token` — shared resume link |

## Account (DPDP)

| Method | Path |
|--------|------|
| POST | `/api/auth/signup` |
| DELETE | `/api/account` |
| GET | `/api/account/export` |
| PUT | `/api/account/consent` |

Full request/response shapes: see `FOLIYO_SCAFFOLD.md` §17.

## Bruno collection

Import [`bruno/`](../bruno/) in [Bruno](https://www.usebruno.com/) — includes all endpoints, `local` / `production` environments, and login → token flow.
