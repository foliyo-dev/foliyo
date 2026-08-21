# Foliyo API

Base URL: `http://localhost:8080` (production: proxied at `/api` on the dashboard domain)

## Auth

Opaque Bearer tokens (stored in `sessions` table, revocable on logout).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Returns `{ "token": "...", "user": { ... } }` |
| POST | `/api/auth/forgot` | `{ email }` — always `{ ok: true }`; sends reset mail if the account exists |
| POST | `/api/auth/reset` | `{ token, password }` — set new password (min 8); revokes sessions |
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
| POST | `/api/resumes/tailor` — JD/skills tailor → resume content snapshot (portfolio unchanged) `{ resume, content, matched_skill_ids, analysis }`. Optional `approved: { skill_ids, project_ids?, experience_ids? }` applies a user-reviewed Library change-set (missing JD skills cannot be added). |
| POST | `/api/jobs/analyze` — paste JD → verdict, coverage, matches, proposed changes. **Saves the analysis** to the account (upsert by JD hash). Heuristic parse always; optional `enhance: true` uses hosted LLM (Pro, 1 AI unit) with heuristic fallback. Response includes `id`. |
| GET | `/api/jobs/analyses` — `{ items }` recent saved analyses (summaries; no JD text). |
| GET | `/api/jobs/analyses/:id` — full saved analysis + `jd_text` + `accepted` change ids. |
| PUT | `/api/jobs/analyses/:id` — `{ accepted: string[] }` persist Include/Skip choices. |
| DELETE | `/api/jobs/analyses/:id` — drop a saved analysis. |
| GET, PUT | `/api/resumes/:id/content` — resume content snapshot IDs |
| GET | `/api/preview/library` — auth HTML preview of full content library as a portfolio |
| GET | `/api/preview/resume/:id` — auth private resume HTML preview (all plans) |
| CRUD | `/api/applications` — manual application tracker |
| POST | `/api/import/resume` — **hosted Pro**: PDF/text → Foliyo Resume Spec draft (OpenRouter; no DB write) |
| POST | `/api/import/fio` — unzip + verify `.fio` → library draft (no identity / email_verified restore) |
| GET | `/api/plan` — plan, pricing, entitlements (`resume_limit`, `portfolio_limit`, …) |
| GET, PUT | `/api/settings` |
| POST | `/api/settings/clear-content` — wipe library/resumes/portfolios; keep account + `email_verified` |

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
| POST | `/api/auth/signup` | `{ email, consent_privacy_policy: true }` — always `{ ok: true }`; pending 60m; password set on verify |
| POST | `/api/auth/verify` | `{ token, password }` — creates the user, issues a session |
| POST | `/api/auth/resend-verification` | `{ email }` — always `{ ok: true }` |
| GET | `/api/account/consents` | Consent history (privacy policy) |
| GET | `/api/account/export` | Sync JSON download of user data |
| DELETE | `/api/account` | Body `{ "confirm": "DELETE" }` — 30-day grace, sessions revoked |
| POST | `/api/auth/cancel-delete` | Public — `{ email, password }` cancel pending deletion |
| GET | `/api/account/data-requests` | Export/delete request history |

Full request/response shapes: see `FOLIYO_SCAFFOLD.md` §17.

## Bruno collection

Import [`bruno/`](../bruno/) in [Bruno](https://www.usebruno.com/) — includes all endpoints, `local` / `production` environments, and login → token flow.
