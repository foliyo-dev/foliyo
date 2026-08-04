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
| CRUD | `/api/portfolios`, `/api/portfolios/:id` |
| CRUD | `/api/resumes`, `/api/resumes/:id` |
| GET | `/api/resumes/:id/export` — Pro: printable HTML; Free: **402** + upgrade payload |
| GET | `/api/resumes/:id/export.fio` — Foliyo Resume Spec `.fio` ZIP (all plans) |
| CRUD | `/api/applications` — manual application tracker |
| POST | `/api/import/resume` — **hosted Pro**: PDF/text → Foliyo Resume Spec draft (OpenRouter; no DB write) |
| GET | `/api/plan` — plan, pricing, entitlements |
| GET, PUT | `/api/settings` |

## Public (no auth)

| Method | Path |
|--------|------|
| GET | `/` — default public portfolio |
| GET | `/u/:handle`, `/u/:handle/:slug` |
| GET | `/r/:token` — shared resume HTML |
| GET | `/welcome` |
| GET | `/spec` — Foliyo Resume Spec docs (local static) |
| GET | `/v1/verify/:share_token` — live Foliyo Resume Spec verify |
| POST | `/v1/verify` — offline verify `{ resume, signature }` |
| POST | `/v1/status/notify` — ATS status webhook (API key + HMAC) |

## Foliyo Resume Spec

See [`specs/resume/`](../specs/resume/) (schema, `.fio` format, Status API).

AI resume import (hosted **Pro** only): PDF/text is gated (magic bytes, size/pages, resume heuristics) before OpenRouter; free users get **402** and no upload UI.

## Account (DPDP — hosted / cloud-api)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Register + privacy consent |
| GET | `/api/account/consents` | Consent history (privacy policy) |
| GET | `/api/account/export` | Sync JSON download of user data |
| DELETE | `/api/account` | Body `{ "confirm": "DELETE" }` — 30-day grace, sessions revoked |
| POST | `/api/auth/cancel-delete` | Public — `{ email, password }` cancel pending deletion |
| GET | `/api/account/data-requests` | Export/delete request history |

Full request/response shapes: see `FOLIYO_SCAFFOLD.md` §17.

## Bruno collection

Import [`bruno/`](../bruno/) in [Bruno](https://www.usebruno.com/) — includes all endpoints, `local` / `production` environments, and login → token flow.
