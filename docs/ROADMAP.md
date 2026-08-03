# Foliyo Engineering Roadmap

> **Updated:** August 2026 · **Target:** MVP launch (v1.0.0 hosted)  
> **GTM / pricing / MVP scope:** [FOLIYO_EXECUTION_PLAN.md](../../docs/FOLIYO_EXECUTION_PLAN.md) (wins on product scope)  
> **Architecture:** [FOLIYO_SCAFFOLD.md](../FOLIYO_SCAFFOLD.md) · **UX:** [FOLIYO_USER_JOURNEYS.md](../../docs/FOLIYO_USER_JOURNEYS.md)

This file is the **engineering build order**. When it conflicts with the execution plan on *what* ships for MVP, the execution plan wins.

---

## What's next (do this order)

MVP is not “feature complete” until a stranger can: **sign up → fill library → publish portfolio → create resume → hit PDF paywall → pay → unlock**.

| # | Workstream | Why now | Status |
|---|------------|---------|--------|
| 1 | **Polished public themes** | Demo pages are HTML stubs; themes package must render real data | Next |
| 2 | **Public resume page** (`/r/:token`) | Completes share loop without PDF | Next |
| 3 | **Content write-up links** | “View more” on projects/experience → Foliyo *or* external blogs | Soon (MVP-friendly) |
| 4 | **Plan gates + upgrade UX** | Portfolio limit exists; need PDF/custom gates + upgrade CTA that works | Next |
| 5 | **PDF export (Pro)** | Primary paid trigger per execution plan | Critical path |
| 6 | **Razorpay + webhooks** | Unlock Pro after payment | Critical path |
| 7 | **Email verification + onboarding emails** | Required for hosted trust / DPDP consent path | Parallel |
| 8 | **Landing pricing page** | Convert traffic; portfolio+resume message only | Parallel |
| 9 | **DPDP minimum** (consent, export, delete) | Before public launch | Before GA |
| 10 | **Self-host binary + install.sh smoke** | OSS differentiator | Before GA |

**Not next (Later / post-MVP):** full **user blog module** (editor + `/u/{handle}/blog`), multi-resume, guest trial, MeshQL client migration, password-protect, Hindi UI.

**Writing / blogs — split clearly:**

| Need | Ship when | Notes |
|------|-----------|--------|
| Link a project/job to a write-up (“View more”) | **Phase A / soon** | URL can be Medium, Dev.to, company blog, *or* a future Foliyo post |
| Foliyo-hosted blog CMS | **Phase E** | Editor, drafts, listing at `/u/{handle}/blog` — not required for MVP |

Do not block MVP on a blog CMS. Proof-of-work links on library items cover the resume use case.

---

## Current state (August 2026)

| Area | Status |
|------|--------|
| Two-repo layout (`foliyo` + `foliyo-cloud`) | Done |
| `@foliyo/brand` + `@foliyo/ui` | Done |
| Auth (login / logout / Bearer tokens) | Done |
| Content library CRUD (basics, skills, projects, experience, education, certifications, languages) | Done |
| Multi-portfolio (Free 1 / Pro unlimited) + headline/bio overrides | Done |
| Portfolio content junctions + public `/u/:handle` (+ slug) | Done (basic HTML renderer) |
| Resume CRUD + share token APIs | Done |
| Dashboard IA (My content / Portfolios / Resume) | Done |
| Demo seed (`make seed-demo`) | Done |
| Signup / handle claim (cloud + core paths) | Partial |
| Theme package rendering (minimal/modern/creative) | Stub / not wired |
| Content write-up / article links on projects & experience | Missing |
| Public resume HTML | Missing / incomplete |
| PDF export | Missing |
| Razorpay | Missing |
| Email verification | Missing |
| Plan middleware beyond portfolio create | Partial |
| File uploads | 501 stub |
| DPDP export/delete/consent UX | Schema only |
| Deno single-binary release | Untested |

**Local demo:** `make seed-demo ARGS=--force` → login `admin@localhost` / `changeme` → `/u/admin`, `/u/priya`, `/u/priya/opensource`, `/u/arjun`.

---

## Phase A — Publish loop polish (now → MVP core)

**Goal:** Public portfolio + resume look credible with 3 themes each; work items can deep-link to write-ups.

- [ ] Wire `packages/themes` into public render (replace inline HTML in `public/pages.ts` or keep thin wrapper)
- [ ] Portfolio themes: minimal, modern, creative — skills, projects, experience, education, certifications, languages, Gravatar/avatar
- [ ] Resume public page `GET /r/:token` with classic / compact / academic
- [ ] Self-host root `/` shows default public portfolio
- [ ] Empty states + “Made with Foliyo” badge on free public pages
- [ ] Verify demo seed pages look good on mobile

### Content write-up links (MVP — not a blog CMS)

Proof of work on resumes/portfolios without hosting posts yet.

- [ ] Projects: optional **write-up / article URL** (alongside existing demo `url` + `repo_url`) — label e.g. “View write-up”
- [ ] Experience: optional **case study / article URL** (same pattern)
- [ ] Optional stretch: small `links[{label,url}]` JSON for multiple links (Demo, Repo, Article)
- [ ] Public portfolio + resume themes render those links when set
- [ ] Seed demo data with at least one external write-up URL (e.g. Dev.to / docs)
- [ ] Docs: clarify Foliyo *or* any external blog is valid; full Foliyo blog is Phase E

**Exit:** `/u/priya` and `/u/priya/opensource` look like real product; a project can show “View write-up →” to Foliyo or an external URL.

---

## Phase B — Monetization path (MVP paywall)

**Goal:** PDF click → upgrade → pay → unlock.

- [ ] Plan middleware helper (`free` | `pro` | `lifetime`) shared by portfolio, PDF, branding
- [ ] `GET /api/resumes/:id/export` → 402 for free with upgrade payload
- [ ] Dashboard upgrade prompts (portfolio #2, PDF export, remove branding)
- [ ] Razorpay checkout + webhook → set `users.plan`
- [ ] Lifetime ₹2999 offer flag for launch window
- [ ] Pricing section on `foliyo-cloud/apps/landing`

**Exit:** Test payment upgrades a free user; PDF works immediately after.

---

## Phase C — Hosted account quality

**Goal:** Trustworthy signup for India-hosted users.

- [ ] Email verification flow (signup already partially in cloud-api)
- [ ] Onboarding: handle claim + first portfolio nudge
- [ ] Transactional emails (verify, welcome)
- [ ] Consent capture on signup (privacy policy)
- [ ] Account export + delete request (`data_requests`)

**Exit:** New user can verify email and reach a published portfolio without staff help.

---

## Phase D — Self-host & release

**Goal:** OSS install path is real.

- [ ] Deno compile amd64/arm64 smoke on Ubuntu VPS
- [ ] `install.sh` + nginx example end-to-end
- [ ] GitHub Release on `v*`
- [ ] Sync brand/assets in release artifacts
- [ ] Document demo seed as optional for self-hosters

**Exit:** Fresh VPS install serves a public portfolio.

---

## Phase E — Post-MVP (execution plan Phases 2–3)

Only after activation metrics exist:

- Custom domains (Pro)
- Multi-resume
- Guest / no-email trial (evidence-gated)
- **User blog module** (Foliyo-hosted CMS)
  - Markdown editor, drafts/publish, tags
  - Public `/u/{handle}/blog` and `/u/{handle}/blog/{slug}`
  - Select posts onto a portfolio (like other library items)
  - Attach a Foliyo post URL into project/experience write-up fields (same link UI as external blogs)
- Resume analytics
- Hindi pilot
- GitHub import / ATS checker
- MeshQL `@meshql/client` + access plugin hardening
- Avatar upload (Gravatar remains fallback)

---

## Suggested near-term sprints

```
Sprint N     Phase A — Theme wiring + public resume page
Sprint N+0.5 Phase A — Project/experience write-up links (external or future Foliyo URLs)
Sprint N+1   Phase B — PDF stub + plan gates + upgrade CTAs
Sprint N+2   Phase B — Razorpay + pricing page
Sprint N+3   Phase C — Email verify + onboarding polish
Sprint N+4   Phase D — Binary + install smoke + DPDP minimum
Launch       Hosted MVP + self-host v1 tag
Post-MVP     Phase E — Foliyo blog CMS (optional; links already work to any host)
```

---

## Version map (engineering)

| Version | Theme |
|---------|--------|
| v0.5.x | Library + multi-portfolio + demo seed (current engineering baseline) |
| v0.6.0 | Polished public themes + resume share pages + write-up links |
| v0.7.0 | PDF + plan gates + Razorpay |
| v0.8.0 | Email verify + DPDP minimum |
| v1.0.0 | Hosted MVP GA + self-host release |

---

## Doc map

| Doc | Role |
|-----|------|
| [docs/FOLIYO_EXECUTION_PLAN.md](../../docs/FOLIYO_EXECUTION_PLAN.md) | MVP scope, pricing, GTM |
| [docs/FOLIYO_USER_JOURNEYS.md](../../docs/FOLIYO_USER_JOURNEYS.md) | UX flows (MVP / Later) |
| [docs/FOLIYO_SCAFFOLD.md](../../docs/FOLIYO_SCAFFOLD.md) / [FOLIYO_SCAFFOLD.md](../FOLIYO_SCAFFOLD.md) | Architecture |
| [ROADMAP.md](ROADMAP.md) (this file) | Engineering build order |

---

## How to use

1. Do **What's next** in order — do not jump to MeshQL or a full blog CMS (write-up *links* are fine in Phase A).
2. Check off Phase A–D items as PRs merge.
3. Update the **Current state** table when a row flips to Done.
4. Keep execution plan as source of truth for Free/Pro limits and deferred features.
