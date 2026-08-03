# Foliyo — Full Monorepo Scaffold
> AI Coding Agent Reference Document  
> Version: 0.6.0 | Stack: Hono + MeshQL + SvelteKit + SQLite/PostgreSQL  
> Tagline: *Your folio. Your way.*  
> Primary Market: India (DPDP Act 2023 compliant)  
> Repo strategy: Two repositories — `foliyo-dev/foliyo` (public OSS) + `foliyo-dev/foliyo-cloud` (private business layer)  
> Language: TypeScript everywhere (backend + frontend)

---

## Doc hierarchy

This file owns **architecture**. MVP ship order and pricing live in **[FOLIYO_EXECUTION_PLAN.md](FOLIYO_EXECUTION_PLAN.md)**. UX flows (tagged MVP / Later) live in **[FOLIYO_USER_JOURNEYS.md](FOLIYO_USER_JOURNEYS.md)**.

### Repository layout

| Repo | Visibility | Contains |
|------|------------|----------|
| `foliyo-dev/foliyo` | Public | `apps/core`, `apps/dashboard`, `packages/brand`, `packages/ui`, `packages/themes` |
| `foliyo-dev/foliyo-cloud` | Private | `apps/api`, `apps/landing`, `apps/site-blog`, `infra/` |

(`foliyo-site` / PHP landing has been removed — marketing lives in `foliyo-cloud/apps/landing`.)

### Shared packages (public → private)

| Package | Purpose | Consumers |
|---------|---------|-----------|
| `@foliyo/core` | Product API engine | OSS + cloud-api |
| `@foliyo/brand` | Tokens + logo SVGs | dashboard, cloud landing, `@foliyo/ui` |
| `@foliyo/ui` | Shared Svelte Logo/Button | dashboard, cloud landing |
| `@foliyo/themes` | Portfolio/resume HTML themes | core public render |

Sync runtime static copies with `foliyo/scripts/sync-brand-assets.sh` (`make sync-brand`).

SaaS-only logic (Razorpay, DPDP hosted flows) stays in `foliyo-cloud`. Do not put it in public packages.

| Scope | In architecture? | Hosted MVP? |
|-------|------------------|-------------|
| Portfolio + resume | Yes | Yes |
| PDF export (Pro) | Yes | Yes |
| Pricing ₹99/mo + ₹2999 lifetime | Plan gates | Yes |
| Multi-portfolio data model | Yes | **Yes** — Free 1 / Pro unlimited |
| Multi-resume | Yes | **post-MVP** — ship one resume |
| User blog (`blog_posts`, `/blog` routes) | Yes (design) | **post-MVP** — do not expose in UI for launch |
| Guest / no-email trial | Optional later | **post-MVP** |
| Marketing site (`foliyo-cloud/apps/landing`) | Private | Yes (SvelteKit + `@foliyo/brand`) |

When this scaffold describes blog or multi-resume entities, treat them as **supported architecture for Later**, not launch requirements. Multi-portfolio is **MVP** (Free 1 / Pro unlimited).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Strategy — Public vs Private](#2-repository-strategy--public-vs-private)
3. [Ecosystem & Dependencies](#3-ecosystem--dependencies)
4. [Public Repo: foliyo-dev/foliyo](#4-public-repo-foliyo-devfoliyo)
5. [Private Repo: foliyo-dev/foliyo-cloud](#5-private-repo-foliyo-devfoliyo-cloud)
6. [App: Core (Hono + MeshQL)](#6-app-core-hono--meshql)
7. [App: Dashboard (SvelteKit)](#7-app-dashboard-sveltekit)
8. [App: Landing (SvelteKit)](#8-app-landing-sveltekit-in-foliyo-cloud)
9. [Shared: Themes](#9-shared-themes)
10. [MeshQL Schema Design](#10-meshql-schema-design)
11. [Infrastructure](#11-infrastructure)
12. [MCP Servers for Development](#12-mcp-servers-for-development)
13. [Libraries Reference](#13-libraries-reference)
14. [Database Schema](#14-database-schema)
15. [Content library, public profile & resume](#15-content-library-public-profile--resume)
16. [Privacy, Encryption & DPDP Compliance](#16-privacy-encryption--dpdp-compliance)
17. [API Contract](#17-api-contract)
18. [Deployment Guide (VPS + Virtualmin + pqpm)](#18-deployment-guide-vps--virtualmin--pqpm)
19. [Single Binary Distribution](#19-single-binary-distribution)
20. [Docker Support (Future)](#20-docker-support-future)
21. [Environment Variables](#21-environment-variables)
22. [Makefile / Scripts](#22-makefile--scripts)
23. [Build & Release Pipeline](#23-build--release-pipeline)
24. [Coding Conventions](#24-coding-conventions)

---

## 1. Project Overview

**Foliyo** is an open-source portfolio + resume platform (user blog is **post-MVP**). Anyone can self-host it on their own VPS or use the hosted service at `foliyo.dev`. It is built entirely in TypeScript — Hono on the backend, SvelteKit on the frontend — powered by MeshQL for the data layer.

**Why MeshQL as the core data layer:**
MeshQL (github.com/meshql/meshql) is a TypeScript library that gives clients GraphQL-style field selection over REST with normal SQL. It is built by the same author as Foliyo and fits the portfolio/resume model — and later multi-portfolio and blog entities — so each public page asks for exactly the fields it needs. No over-fetching. No N+1. No resolvers. MeshQL's `@meshql/sqlite` uses Node 22.5+'s built-in `node:sqlite` — zero native deps, zero Docker required for self-hosters.

**Why Hono:**
Hono is a fast, lightweight TypeScript web framework that runs on Node.js, Deno, and Bun. It is the backend framework of choice for MeshQL's HTTP adapters (`@meshql/http/hono`). Minimal, idiomatic, excellent TypeScript support.

**Why pressbin was dropped:**
pressbin was a standalone Go blog engine. When user blogging ships (**post-MVP**), blog content is a MeshQL entity in the core service — same DB, same process, same binary. No separate blog service. Do not mention pressbin in marketing copy.

---

**Two repositories:**

| Repo | Visibility | Purpose |
|------|-----------|---------|
| `github.com/foliyo-dev/foliyo` | Public (MIT) | Product engine — what self-hosters download and run |
| `github.com/foliyo-dev/foliyo-cloud` | Private | SaaS API, marketing landing, company blog, deploy |

**Public repo apps:**

| App | Purpose | Tech |
|-----|---------|------|
| `core` | API — portfolio, resume, auth, PDF export (+ blog **post-MVP**) | Hono + MeshQL + SQLite/PostgreSQL |
| `dashboard` | Admin UI | SvelteKit + @meshql/client |

**Private repo apps (`foliyo-cloud`):**

| App | Purpose | Tech |
|-----|---------|------|
| `api` | SaaS extensions (signup, billing, DPDP) | Hono + `@foliyo/core` |
| `landing` | foliyo.dev marketing site | SvelteKit + `@foliyo/brand` / `@foliyo/ui` |
| `site-blog` | foliyo.dev company blog (your content) | Markdown |
| `infra` | Real server configs, deploy scripts | nginx, bash |

**Key principles:**
- TypeScript everywhere — one language across backend and frontend
- MeshQL as the data layer — field selection, access control, integrity
- Self-hostable as a single compiled binary (Deno compile)
- Single-command install via `install.sh`
- Process management via `pqpm` (github.com/pqpm/pqpm)
- User blog (when shipped) is a MeshQL entity — no separate blog service
- Open source product (MIT), private business layer
- DPDP Act 2023 compliant for Indian users
- Hosted MVP pricing: **₹99/mo** Pro + **₹2999** lifetime launch offer

---

## 2. Repository Strategy — Public vs Private

### The rule

> **If a self-hoster needs it to run Foliyo → public repo.**  
> **If it only matters for foliyo.dev → private repo.**

### What goes where

```
Public: github.com/foliyo-dev/foliyo
├── apps/core/              ← Hono + MeshQL API (compiled to single binary)
├── apps/dashboard/         ← SvelteKit static build
├── packages/
│   ├── brand/              ← tokens + logos (@foliyo/brand)
│   ├── ui/                 ← Logo, Button (@foliyo/ui)
│   └── themes/             ← portfolio + resume themes (HTML/CSS)
├── scripts/
│   ├── install.sh          ← one-liner VPS installer
│   ├── setup-dev.sh        ← local dev setup
│   └── sync-brand-assets.sh
├── infra/
│   ├── example.pqpm.toml   ← pqpm config template for self-hosters
│   └── example.nginx.conf  ← nginx vhost template (no real domains)
├── docs/
│   ├── self-hosting.md
│   ├── api.md
│   └── themes.md
└── .github/workflows/
    ├── ci.yml
    └── release.yml

Private: github.com/foliyo-dev/foliyo-cloud
├── apps/api/               ← SaaS API (extends @foliyo/core)
├── apps/landing/           ← SvelteKit marketing site (foliyo.dev)
├── apps/site-blog/         ← company markdown blog posts
├── infra/
│   ├── nginx/              ← real nginx configs with actual domains
│   ├── pqpm.toml           ← real pqpm config for foliyo.dev server
│   └── deploy.sh           ← pulls release artifacts, restarts services
├── .env                    ← GITIGNORED — real secrets
└── .env.example            ← committed, no real values
```

### GitHub release flow

```
Push tag v0.x.x to public repo
    ↓ GitHub Actions CI passes
    ↓ release.yml builds:
        foliyo-linux-amd64    ← Deno compiled single binary
        foliyo-linux-arm64
        dashboard-build.tar.gz ← SvelteKit static files
    ↓ uploaded to GitHub Releases

Private repo deploy.sh:
    wget latest release artifacts
    replace binary on server
    pqpm restart foliyo
    extract dashboard build to nginx root
```

---

## 3. Ecosystem & Dependencies

### MeshQL (github.com/meshql/meshql)

MeshQL is the data layer for Foliyo's entire API. Built by the same author.

```
@meshql/core       ← parser, planner, shaper, createMesh(), buildSelectSql()
@meshql/http       ← Hono adapter (meshHonoRouter)
@meshql/client     ← typed client SDK (used in SvelteKit dashboard)
@meshql/sqlite     ← SQLite driver via node:sqlite (zero native deps)
@meshql/postgres   ← PostgreSQL driver (optional, for foliyo.dev scale)
@meshql/integrity  ← request signing + resume verification tokens
@meshql/access     ← entity, row, and field access control
@meshql/upload     ← file uploads (avatars, project images)
```

**Key MeshQL facts for self-hosters:**
- `@meshql/sqlite` uses Node 22.5+ built-in `node:sqlite` — no native modules, no build step
- SQLite is first-class — default for self-hosters
- PostgreSQL is optional — switch via env var for foliyo.dev scale
- No codegen, no resolvers, no dataloader dance

### pqpm (github.com/pqpm/pqpm)

Process manager for VPS deployment. Language-agnostic — manages the Foliyo binary exactly the same as it would manage a Go binary. No changes needed.

```bash
pqpm start foliyo    # starts the compiled binary
pqpm restart foliyo  # zero-downtime restart on deploy
pqpm status          # check all services
```

---

## 4. Public Repo: foliyo-dev/foliyo

```
foliyo/
├── apps/
│   ├── core/                        # Hono + MeshQL API
│   │   ├── src/
│   │   │   ├── index.ts             # entrypoint: creates app, runs migrations, starts server
│   │   │   ├── config.ts            # loads env vars + config.yml
│   │   │   ├── db.ts                # opens SQLite or PostgreSQL connection
│   │   │   ├── migrate.ts           # runs migrations on startup
│   │   │   │
│   │   │   ├── schema/              # MeshQL entity + join definitions
│   │   │   │   ├── index.ts         # exports combined mesh
│   │   │   │   ├── profile.ts
│   │   │   │   ├── skills.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── experience.ts
│   │   │   │   ├── education.ts
│   │   │   │   ├── portfolios.ts
│   │   │   │   ├── resumes.ts
│   │   │   │   └── blog.ts          # post-MVP user blogging
│   │   │   │
│   │   │   ├── routes/              # Hono route handlers
│   │   │   │   ├── auth.ts          # POST /api/auth/login, /logout, /me
│   │   │   │   ├── profile.ts       # GET/PUT /api/profile
│   │   │   │   ├── skills.ts        # CRUD /api/skills
│   │   │   │   ├── projects.ts      # CRUD /api/projects
│   │   │   │   ├── experience.ts    # CRUD /api/experience
│   │   │   │   ├── education.ts     # CRUD /api/education
│   │   │   │   ├── portfolios.ts    # CRUD /api/portfolios
│   │   │   │   ├── resumes.ts       # CRUD + export /api/resumes
│   │   │   │   ├── blog.ts          # post-MVP CRUD /api/blog/posts
│   │   │   │   ├── upload.ts        # POST /api/upload
│   │   │   │   ├── settings.ts      # GET/PUT /api/settings
│   │   │   │   └── public.ts        # GET / /u/:handle /r/:token (+ blog post-MVP)
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts          # opaque token validation
│   │   │   │   ├── plan.ts          # Pro plan gate middleware
│   │   │   │   └── ratelimit.ts     # rate limiting
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── tokens.ts        # generate/validate opaque tokens
│   │   │   │   └── password.ts      # bcrypt helpers
│   │   │   │
│   │   │   ├── pdf/
│   │   │   │   ├── export.ts        # Chromium headless PDF generation
│   │   │   │   └── cache.ts         # PDF file cache management
│   │   │   │
│   │   │   ├── crypto/
│   │   │   │   ├── dek.ts           # envelope encryption — DEK management
│   │   │   │   └── field.ts         # AES-256-GCM field encrypt/decrypt
│   │   │   │
│   │   │   ├── email/
│   │   │   │   └── send.ts          # SMTP / Resend email sender
│   │   │   │
│   │   │   ├── templates/           # Go-style HTML templates for public pages
│   │   │   │   ├── base.html
│   │   │   │   ├── portfolio.html   # public portfolio page
│   │   │   │   ├── blog-list.html   # /u/:handle/blog
│   │   │   │   ├── blog-post.html   # /u/:handle/blog/:slug
│   │   │   │   └── resume.html      # /r/:token
│   │   │   │
│   │   │   └── migrations/
│   │   │       ├── 001_users.sql
│   │   │       ├── 002_profile.sql
│   │   │       ├── 003_skills.sql
│   │   │       ├── 004_projects.sql
│   │   │       ├── 005_experience.sql
│   │   │       ├── 006_education.sql
│   │   │       ├── 007_settings.sql
│   │   │       ├── 008_tokens.sql
│   │   │       ├── 009_portfolios.sql
│   │   │       ├── 010_resumes.sql
│   │   │       ├── 011_blog.sql         # post-MVP
│   │   │       ├── 012_consents.sql
│   │   │       └── 013_data_requests.sql
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── deno.json                # for Deno compile (single binary build)
│   │
│   └── dashboard/                   # SvelteKit
│       ├── src/
│       │   ├── lib/api/             # REST (+ MeshQL later)
│       │   └── routes/(app)/
│       │       ├── basics/          # global library: name/bio/links
│       │       ├── skills|projects|experience|education|certifications|languages/
│       │       ├── portfolio/       → redirect to /portfolios
│       │       ├── portfolios/      # list + [id] editor
│       │       ├── resume/
│       │       └── settings/
│       ├── svelte.config.js
│       └── package.json
│
├── packages/
│   └── themes/
│       ├── portfolio/
│       │   ├── minimal/
│       │   ├── modern/
│       │   └── creative/
│       └── resume/
│           ├── classic/
│           ├── compact/
│           └── academic/
│
├── infra/
│   ├── example.pqpm.toml
│   └── example.nginx.conf
│
├── scripts/
│   ├── install.sh
│   └── setup-dev.sh
│
├── docs/
├── .github/workflows/
├── package.json                     # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json                       # Turborepo (same pattern as MeshQL monorepo)
└── FOLIYO_SCAFFOLD.md
```

---

## 5. Private Repo: foliyo-dev/foliyo-cloud

```
foliyo-cloud/                        # PRIVATE
├── apps/
│   ├── api/                         # SaaS Hono API (@foliyo/core + cloud routes)
│   ├── landing/                     # SvelteKit marketing (foliyo.dev)
│   ├── site-blog/                   # markdown posts for company blog
│   └── web/                         # legacy SaaS shell (optional)
│
├── infra/
│   ├── nginx/
│   │   ├── foliyo.dev.conf          # static landing build
│   │   ├── app.foliyo.dev.conf
│   │   ├── api.foliyo.dev.conf
│   │   └── blog.foliyo.dev.conf
│   ├── pqpm.toml
│   └── deploy.sh                    # dashboard + landing tarballs
│
├── scripts/
│   ├── build-saas-dashboard.sh
│   └── build-release.sh
├── .env
├── .env.example
└── README.md
```

### deploy.sh

Production deploy lives at `foliyo-cloud/infra/deploy.sh`. It extracts:

- `saas-dashboard-build.tar.gz` → `/home/foliyo/apps/dashboard`
- `landing-build.tar.gz` → `/home/foliyo/apps/landing`

Build locally with `make build-release` in `foliyo-cloud`.

---

## 6. App: Core (Hono + MeshQL)

**Path:** `apps/core/`  
**Binary name:** `foliyo` (single compiled binary via Deno compile)  
**Default port:** `8080`  
**Language:** TypeScript (Node 22.5+ or Deno)  
**Database:** SQLite via `@meshql/sqlite` (default) or PostgreSQL via `@meshql/postgres`

### package.json

```json
{
  "name": "@foliyo/core",
  "version": "0.4.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "compile": "deno compile --allow-net --allow-read --allow-write --allow-env --output ../../dist/foliyo src/index.ts",
    "migrate": "tsx src/migrate.ts",
    "test": "node --experimental-vm-modules node_modules/.bin/jest"
  },
  "dependencies": {
    "hono": "^4.4.0",
    "@hono/node-server": "^1.12.0",
    "meshql-core": "^0.1.4",
    "meshql-http": "^0.1.4",
    "meshql-client": "^0.1.4",
    "meshql-integrity": "^0.1.4",
    "meshql-access": "^0.1.4",
    "meshql-upload": "^0.1.4",
    "bcryptjs": "^2.4.3",
    "nanoid": "^5.0.7",
    "yaml": "^2.4.5",
    "zod": "^3.23.8",
    "nodemailer": "^6.9.14"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "tsx": "^4.11.0",
    "@types/node": "^22.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/nodemailer": "^6.4.15",
    "jest": "^29.7.0"
  }
}
```

### src/index.ts

```typescript
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { loadConfig } from "./config.js"
import { openDatabase } from "./db.js"
import { runMigrations } from "./migrate.js"
import { createMeshRouter } from "./schema/index.js"
import { authRoutes } from "./routes/auth.js"
import { profileRoutes } from "./routes/profile.js"
import { skillsRoutes } from "./routes/skills.js"
import { projectsRoutes } from "./routes/projects.js"
import { experienceRoutes } from "./routes/experience.js"
import { educationRoutes } from "./routes/education.js"
import { portfoliosRoutes } from "./routes/portfolios.js"
import { resumesRoutes } from "./routes/resumes.js"
import { blogRoutes } from "./routes/blog.js"
import { uploadRoutes } from "./routes/upload.js"
import { settingsRoutes } from "./routes/settings.js"
import { publicRoutes } from "./routes/public.js"
import { authMiddleware } from "./middleware/auth.js"

const config = loadConfig()
const db = openDatabase(config)
await runMigrations(db)

const app = new Hono()

app.use("*", logger())
app.use("*", cors({
  origin: config.corsOrigins,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}))

// MeshQL router — field-selected queries (public + authenticated)
app.route("/mesh", createMeshRouter(db))

// Auth (no middleware)
app.route("/api/auth", authRoutes(db))

// Public portfolio pages (HTML rendered)
app.route("/", publicRoutes(db))

// Protected API routes
const api = new Hono()
api.use("*", authMiddleware(db))
api.route("/profile", profileRoutes(db))
api.route("/skills", skillsRoutes(db))
api.route("/projects", projectsRoutes(db))
api.route("/experience", experienceRoutes(db))
api.route("/education", educationRoutes(db))
api.route("/portfolios", portfoliosRoutes(db))
api.route("/resumes", resumesRoutes(db))
api.route("/blog", blogRoutes(db))
api.route("/upload", uploadRoutes(db))
api.route("/settings", settingsRoutes(db))
app.route("/api", api)

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`Foliyo running on port ${config.port}`)
})
```

### Key design decisions for Core

- **Hono** — lightweight, fast, TypeScript-native, has `@meshql/http/hono` adapter built-in
- **MeshQL** for all read queries — dashboard and public pages use `@meshql/client` for field-selected fetching
- **Standard Hono routes** for all write operations (POST/PUT/DELETE) — MeshQL handles reads
- **Auth** — opaque token (Bearer header) stored in `tokens` table. No cookies. No JWT. Solves dev proxy problem — SvelteKit dev server calls API directly cross-origin.
- **Migrations** — run automatically on startup from `src/migrations/*.sql` read via `fs.readdir`
- **PDF export** — Chromium headless subprocess. Queued via simple `pdf_jobs` table to limit concurrent spawns.
- **Config priority** — ENV vars > `config.yml` > defaults
- **SQLite default** — `@meshql/sqlite` uses `node:sqlite` (Node 22.5+, zero native deps). Switch to `@meshql/postgres` via `FOLIYO_DB_DRIVER=postgres`.

---

## 7. App: Dashboard (SvelteKit)

**Path:** `apps/dashboard/`

**MVP IA:** global content library + multi-portfolio (Free 1 / Pro unlimited) + one resume.

| Nav group | Routes |
|-----------|--------|
| Overview | `/` |
| My content | `/basics`, `/skills`, `/projects`, `/experience`, `/education`, `/certifications`, `/languages` |
| Publish | `/portfolios`, `/portfolios/[id]`, `/resume` |
| Account | `/settings` |

`/profile` redirects to `/basics`; `/portfolio` redirects to `/portfolios`. Blog and Themes pages may exist in the tree but are **not** MVP sidebar items.

### Auth store

```typescript
// src/lib/stores/auth.ts
import { writable } from "svelte/store"

interface AuthState {
  token: string | null
  user: { id: string; email: string; plan: string } | null
}

export const auth = writable<AuthState>({ token: null, user: null })

// On login success:
auth.set({ token: response.token, user: response.user })

// On every API call:
// Authorization: Bearer <token>
// Browser sends it cross-origin — no proxy config needed
```

### MeshQL client usage in dashboard

```typescript
// src/lib/api/portfolios.ts
import { createClient } from "meshql-client"
import { get } from "svelte/store"
import { auth } from "../stores/auth.js"

const client = createClient({
  url: import.meta.env.VITE_API_URL + "/mesh",
  getHeaders: () => ({
    Authorization: `Bearer ${get(auth).token}`
  })
})

// Fetch portfolio with exactly the fields the dashboard needs
export async function getPortfolio(portfolioId: string) {
  return client.query({
    portfolio: {
      id: true,
      name: true,
      slug: true,
      theme_slug: true,
      is_public: true,
      is_default: true,
      skills: { id: true, name: true, level: true, category: true },
      projects: { id: true, title: true, featured: true, tags: true },
      experience: { id: true, company: true, role: true },
      education: { id: true, institution: true, degree: true }
    }
  }, { portfolioId })
}
```

### vite.config.ts — no proxy needed

```typescript
// With opaque token Bearer auth, no proxy config needed.
// SvelteKit dev server calls API directly cross-origin.
// CORS on Hono allows it.
import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [sveltekit()]
  // No server.proxy needed
})
```

---

## 8. App: Landing (SvelteKit in foliyo-cloud)

**Repo:** `foliyo-dev/foliyo-cloud` (PRIVATE)  
**Path:** `apps/landing/`  
**Stack:** SvelteKit + `@foliyo/brand` + `@foliyo/ui` (adapter-static). Serves **foliyo.dev**.

Local: `pnpm --filter @foliyo/cloud-landing dev` → http://localhost:5175  
Prod root: `/home/foliyo/apps/landing/build` (see `infra/nginx/foliyo.dev.conf`).

---

## 9. Shared: Themes

**Path:** `packages/themes/`  
**Unchanged** — HTML/CSS templates for portfolio pages and resume export.  
Theme variables available: `{{.Profile}}`, `{{.Skills}}`, `{{.Projects}}`, `{{.Experience}}`, `{{.Education}}`, `{{.Settings}}`

Now rendered via Hono's HTML response instead of Go templates — same variable names, different template engine (use a simple TypeScript template renderer or `eta`).

---

## 10. MeshQL Schema Design

This is the heart of Foliyo's data layer. All read queries — from the dashboard, public pages, and resume exports — go through MeshQL.

### src/schema/index.ts

```typescript
import { createMesh, type MeshSchema } from "meshql-core"
import { meshHonoRouter } from "meshql-http/hono"
import { sqliteDriver } from "meshql-sqlite"
import { accessPlugin } from "meshql-access"
import { integrityPlugin } from "meshql-integrity"
import type { Database } from "node:sqlite"

export function createMeshRouter(db: Database) {
  const schema: MeshSchema = {
    entities: {
      profile: {
        fields: ["id", "user_id", "name", "headline", "bio",
                 "avatar_url", "location", "website",
                 "github", "linkedin", "twitter"],
        table: "profile"
      },
      skill: {
        fields: ["id", "user_id", "name", "level", "category", "sort_order"],
        table: "skills"
      },
      project: {
        fields: ["id", "user_id", "title", "description", "url",
                 "repo_url", "image_url", "tags", "featured", "sort_order"],
        table: "projects"
      },
      experience: {
        fields: ["id", "user_id", "company", "role", "location",
                 "start_date", "end_date", "description", "sort_order"],
        table: "experience"
      },
      education: {
        fields: ["id", "user_id", "institution", "degree",
                 "field", "start_date", "end_date", "description"],
        table: "education"
      },
      portfolio: {
        fields: ["id", "user_id", "name", "slug", "description",
                 "theme_slug", "is_public", "is_default", "sort_order"],
        table: "portfolios"
      },
      resume: {
        fields: ["id", "portfolio_id", "user_id", "name",
                 "theme_slug", "is_public", "share_token", "view_count"],
        table: "resumes"
      },
      post: {
        fields: ["id", "user_id", "title", "slug", "content",
                 "excerpt", "cover_image", "tags",
                 "published_at", "status"],
        table: "blog_posts"
      }
    },

    joins: {
      // Portfolio → its selected content (via junction tables)
      "portfolio.skills": {
        entity: "skill",
        on: "portfolio_skills.portfolio_id = portfolios.id AND portfolio_skills.skill_id = skills.id",
        type: "many",
        through: "portfolio_skills"
      },
      "portfolio.projects": {
        entity: "project",
        on: "portfolio_projects.portfolio_id = portfolios.id AND portfolio_projects.project_id = projects.id",
        type: "many",
        through: "portfolio_projects"
      },
      "portfolio.experience": {
        entity: "experience",
        on: "portfolio_experience.portfolio_id = portfolios.id AND portfolio_experience.experience_id = experience.id",
        type: "many",
        through: "portfolio_experience"
      },
      "portfolio.education": {
        entity: "education",
        on: "portfolio_education.portfolio_id = portfolios.id AND portfolio_education.education_id = education.id",
        type: "many",
        through: "portfolio_education"
      },
      // Portfolio → its resumes
      "portfolio.resumes": {
        entity: "resume",
        on: "resumes.portfolio_id = portfolios.id",
        type: "many"
      },
      // Basics (profile) → public profiles (portfolios)
      "profile.portfolios": {
        entity: "portfolio",
        on: "portfolios.user_id = profile.user_id",
        type: "many"
      }
    }
  }

  const driver = sqliteDriver(db)

  const mesh = createMesh(schema, {
    plugins: [
      accessPlugin({
        // Public entities — no auth needed
        public: ["portfolio", "profile", "skill", "project",
                 "experience", "education", "resume", "post"],
        // Row-level: user can only read their own data when authenticated
        rowFilter: (entity, context) => {
          if (context.user) {
            return { user_id: context.user.id }
          }
          // Public — only return public portfolios
          if (entity === "portfolio") {
            return { is_public: 1 }
          }
          return {}
        }
      }),
      integrityPlugin({
        // Used for resume share token signing + verification
        secret: process.env.FOLIYO_INTEGRITY_SECRET!
      })
    ]
  })

  // Resolvers — each entity uses buildSelectSql to hit the DB
  mesh.resolve("profile", async (plan) => {
    const { sql, params } = buildSelectSql(plan, schema)
    return driver.query(sql, params)
  })

  // ... same pattern for all entities

  return meshHonoRouter(mesh, "/mesh")
}
```

### How dashboard uses MeshQL vs how public pages use it

```typescript
// Dashboard — authenticated, gets all user's data
// Authorization: Bearer <token>
// rowFilter returns { user_id: currentUser.id }
client.query({
  portfolio: {
    id: true, name: true, slug: true,
    skills: { id: true, name: true, level: true },
    projects: { id: true, title: true, featured: true }
  }
})

// Public portfolio page — no auth
// rowFilter returns { is_public: 1 }
// Renders only public portfolios
client.query({
  portfolio: {
    name: true, theme_slug: true,
    skills: { name: true, level: true, category: true },
    projects: { title: true, description: true, url: true, featured: true }
  }
}, { slug: "nodejs" })

// Resume export — uses share_token
// No auth needed — token IS the auth
client.query({
  resume: {
    name: true, theme_slug: true,
    portfolio: {
      experience: { company: true, role: true, start_date: true, end_date: true },
      education: { institution: true, degree: true, field: true },
      skills: { name: true, level: true }
    }
  }
}, { share_token: "abc123" })
```

### @meshql/integrity for resume verification

```typescript
// When generating a resume PDF:
import { signToken } from "meshql-integrity"

const verificationToken = signToken({
  resumeId: resume.id,
  userId: resume.user_id,
  generatedAt: new Date().toISOString()
}, process.env.FOLIYO_INTEGRITY_SECRET)

// Embed in PDF metadata
// Employer visits: foliyo.dev/verify/{verificationToken}
// → "✅ Authentic Foliyo resume. Generated 12 June 2026."
```

---

## 11. Infrastructure

**Split across both repos — same as before.**

Public repo: templates only (example.pqpm.toml, example.nginx.conf)  
Private repo: real configs with actual domains and paths

### infra/example.pqpm.toml (public repo)

```toml
# Foliyo process config for pqpm
# Copy this file, fill in real paths, run: pqpm start foliyo

[service.foliyo]
command = "/home/foliyo/bin/foliyo"
restart = "always"
max_memory = "1GB"
cpu_limit = "40%"
working_dir = "/home/foliyo"
log_file = "/home/foliyo/logs/foliyo.log"
env = {
  FOLIYO_PORT = "8080",
  FOLIYO_DB_DRIVER = "sqlite",
  FOLIYO_DB_PATH = "/home/foliyo/data/foliyo.db",
  FOLIYO_DATA_DIR = "/home/foliyo/data",
  FOLIYO_MODE = "single",
  NODE_ENV = "production"
}
```

### infra/example.nginx.conf (public repo)

```nginx
# app.yourdomain.com → SvelteKit dashboard (static)
server {
    listen 80;
    server_name app.yourdomain.com;
    root /home/foliyo/apps/dashboard/build;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }

    # Proxy /api and /mesh to Foliyo binary
    location ~ ^/(api|mesh)/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# yourdomain.com → public portfolio pages (served by Foliyo binary)
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Cache public pages
        proxy_cache_valid 200 1h;
        add_header Cache-Control "public, max-age=3600";
    }
}
```

---

## 12. MCP Servers for Development

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/foliyo"],
      "description": "Read/write monorepo files"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "your_token" },
      "description": "Create PRs, read meshql/meshql source"
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "./data/foliyo.db"],
      "description": "Inspect SQLite DB during development"
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"],
      "description": "Fetch MeshQL docs, JSR packages, pqpm README"
    }
  }
}
```

### MCP usage during development

| Task | MCP | Example prompt |
|------|-----|---------------|
| Read MeshQL source to understand schema API | `fetch` | "Fetch https://github.com/meshql/meshql and read the schema docs" |
| Inspect current DB schema | `sqlite` | "Show all tables and columns in the SQLite DB" |
| Generate new migration | `sqlite` + `filesystem` | "Show schema and generate 014_plan_gates.sql" |
| Create GitHub issue | `github` | "Create issue in foliyo-dev/foliyo: Add @meshql/access row filter for handles" |
| Read/write source files | `filesystem` | "Read src/schema/portfolios.ts and add show_* section toggle fields" |

---

## 13. Libraries Reference

### Core (apps/core)

| Library | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.4.0 | HTTP framework |
| `@hono/node-server` | ^1.12.0 | Node.js adapter for Hono |
| `meshql-core` | ^0.1.4 | MeshQL parser, planner, shaper |
| `meshql-http` | ^0.1.4 | Hono adapter (`meshHonoRouter`) |
| `meshql-client` | ^0.1.4 | Typed client (also used in dashboard) |
| `meshql-sqlite` | ^0.1.4 | SQLite driver via `node:sqlite` |
| `meshql-postgres` | ^0.1.4 | PostgreSQL driver (optional) |
| `meshql-integrity` | ^0.1.4 | Resume signing + verification tokens |
| `meshql-access` | ^0.1.4 | Row/field access control |
| `meshql-upload` | ^0.1.4 | File upload handling |
| `bcryptjs` | ^2.4.3 | Password hashing (pure JS, no native) |
| `nanoid` | ^5.0.7 | Opaque token + share token generation |
| `zod` | ^3.23.8 | Request validation |
| `yaml` | ^2.4.5 | Config file parsing |
| `nodemailer` | ^6.9.14 | Email sending (SMTP) |
| `eta` | ^3.4.0 | HTML template engine for public pages |

### Dashboard (apps/dashboard)

| Library | Version | Purpose |
|---------|---------|---------|
| `@sveltejs/kit` | ^2.5.7 | Framework |
| `@sveltejs/adapter-static` | ^3.0.1 | Static build output |
| `meshql-client` | ^0.1.4 | Typed API client (field-selected queries) |
| `@lucide/svelte` | ^0.381.0 | Icons |
| `bits-ui` | ^0.21.9 | Headless UI components |

### Dev tooling

| Tool | Purpose |
|------|---------|
| `tsx` | TypeScript live reload in development |
| `deno compile` | Produce single binary for distribution |
| `turbo` | Monorepo task runner (same as MeshQL repo) |
| `pnpm` | Package manager (same as MeshQL repo) |
| `pqpm` | Process manager for VPS deployment |

---

## 14. Database Schema

All migrations in `apps/core/src/migrations/`. Run automatically on startup.
SQLite syntax used (PostgreSQL compatible with minor type adjustments).

### 001_users.sql
```sql
CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email        TEXT NOT NULL UNIQUE,
    email_enc    TEXT,                       -- AES-256-GCM encrypted email (backup)
    password     TEXT NOT NULL,              -- bcrypt hash
    handle       TEXT UNIQUE,               -- claimed handle e.g. "john"
    plan         TEXT NOT NULL DEFAULT 'free', -- 'free' | 'pro' (hosted: ₹99/mo Pro; lifetime via far-future plan_expires)
    plan_expires DATETIME,                   -- NULL = lifetime or free
    mode         TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended'
    dek_encrypted TEXT,                      -- encrypted Data Encryption Key
    dek_nonce    TEXT,
    onboarding_complete INTEGER DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 002_profile.sql
```sql
CREATE TABLE IF NOT EXISTS profile (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL DEFAULT '',
    headline     TEXT NOT NULL DEFAULT '',
    bio          TEXT NOT NULL DEFAULT '',
    avatar_url   TEXT NOT NULL DEFAULT '',
    location     TEXT NOT NULL DEFAULT '',
    email        TEXT NOT NULL DEFAULT '',   -- public-facing email (not login)
    website      TEXT NOT NULL DEFAULT '',
    github       TEXT NOT NULL DEFAULT '',
    linkedin     TEXT NOT NULL DEFAULT '',
    twitter      TEXT NOT NULL DEFAULT '',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 003_skills.sql
```sql
CREATE TABLE IF NOT EXISTS skills (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    level      TEXT NOT NULL DEFAULT 'intermediate',
    category   TEXT NOT NULL DEFAULT 'general',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 004_projects.sql
```sql
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    url         TEXT NOT NULL DEFAULT '',
    repo_url    TEXT NOT NULL DEFAULT '',
    image_url   TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',  -- JSON array
    featured    INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 005_experience.sql
```sql
CREATE TABLE IF NOT EXISTS experience (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company     TEXT NOT NULL,
    role        TEXT NOT NULL,
    location    TEXT NOT NULL DEFAULT '',
    start_date  TEXT NOT NULL,
    end_date    TEXT,                        -- NULL = present
    description TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 006_education.sql
```sql
CREATE TABLE IF NOT EXISTS education (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution TEXT NOT NULL,
    degree      TEXT NOT NULL DEFAULT '',
    field       TEXT NOT NULL DEFAULT '',
    start_date  TEXT NOT NULL,
    end_date    TEXT,
    description TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 007_settings.sql
```sql
CREATE TABLE IF NOT EXISTS settings (
    id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_title       TEXT NOT NULL DEFAULT 'My Portfolio',
    site_description TEXT NOT NULL DEFAULT '',
    theme_slug       TEXT NOT NULL DEFAULT 'minimal',
    resume_theme     TEXT NOT NULL DEFAULT 'classic',
    custom_domain    TEXT NOT NULL DEFAULT '',
    seo_keywords     TEXT NOT NULL DEFAULT '',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 008_tokens.sql
```sql
CREATE TABLE IF NOT EXISTS tokens (
    id         TEXT PRIMARY KEY,             -- nanoid(32)
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL,            -- 30 days from creation
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Opaque Bearer tokens — replaces cookie sessions
-- Clean up: DELETE FROM tokens WHERE expires_at < CURRENT_TIMESTAMP
```

### 009_portfolios.sql
```sql
CREATE TABLE IF NOT EXISTS portfolios (
    id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    slug           TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    theme_slug     TEXT NOT NULL DEFAULT 'minimal',
    is_public      INTEGER NOT NULL DEFAULT 0,
    is_default     INTEGER NOT NULL DEFAULT 0,
    show_skills    INTEGER NOT NULL DEFAULT 1,
    show_projects  INTEGER NOT NULL DEFAULT 1,
    show_experience INTEGER NOT NULL DEFAULT 1,
    show_education INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, slug)
);

-- Only one default portfolio per user
CREATE UNIQUE INDEX idx_portfolios_default
ON portfolios(user_id) WHERE is_default = 1;

-- Junction tables for portfolio content selection
CREATE TABLE IF NOT EXISTS portfolio_skills (
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    skill_id     TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, skill_id)
);
CREATE TABLE IF NOT EXISTS portfolio_projects (
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, project_id)
);
CREATE TABLE IF NOT EXISTS portfolio_experience (
    portfolio_id  TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    experience_id TEXT NOT NULL REFERENCES experience(id) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, experience_id)
);
CREATE TABLE IF NOT EXISTS portfolio_education (
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    education_id TEXT NOT NULL REFERENCES education(id) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, education_id)
);
```

### 010_resumes.sql
```sql
CREATE TABLE IF NOT EXISTS resumes (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    theme_slug   TEXT NOT NULL DEFAULT 'classic',
    is_public    INTEGER NOT NULL DEFAULT 0,
    share_token  TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(8)))),
    view_count   INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Resume view analytics (DPDP compliant — no IP stored)
CREATE TABLE IF NOT EXISTS resume_views (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    resume_id  TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    country    TEXT,                         -- from IP geolocation, IP not stored
    city       TEXT,
    referrer   TEXT,
    device     TEXT,                         -- 'mobile' | 'desktop' | 'tablet'
    viewed_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 011_blog.sql — **post-MVP**

Schema may exist for future user blogging. Do not expose CRUD or public blog routes in the hosted MVP UI. Prefer shipping migrations only when the feature is greenlit by the execution plan.

```sql
CREATE TABLE IF NOT EXISTS blog_posts (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    slug         TEXT NOT NULL,
    content      TEXT NOT NULL DEFAULT '',   -- markdown
    excerpt      TEXT NOT NULL DEFAULT '',
    cover_image  TEXT NOT NULL DEFAULT '',
    tags         TEXT NOT NULL DEFAULT '[]', -- JSON array
    status       TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
    published_at DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, slug)
);
```

### 012_consents.sql
```sql
CREATE TABLE IF NOT EXISTS consents (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,               -- 'privacy_policy' | 'marketing_email'
    granted    INTEGER NOT NULL,            -- 1 = granted, 0 = withdrawn
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 013_data_requests.sql
```sql
CREATE TABLE IF NOT EXISTS data_requests (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         TEXT NOT NULL,             -- 'export' | 'delete'
    status       TEXT NOT NULL DEFAULT 'pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);
```

---

## 15. Content library, public profile & resume

**Product IA (MVP):** users edit a **global content library** (basics, skills, projects, experience, education, certifications, languages). There is no separate Profile nav item — basics are part of the library. **Portfolios** are curated public views that select library items, optional headline/bio overrides, theme, and publish. Free = 1 portfolio; Pro = unlimited. Default at `foliyo.dev/u/{handle}`; others at `foliyo.dev/u/{handle}/{slug}`. **Resume** (one in MVP) links to a portfolio's selection.

```
User
├── Global library (basics/profile row + skills/projects/experience/education/certifications/languages)
└── Portfolios (filtered views via junction tables)
    ├── is_default = 1 → foliyo.dev/u/{handle}
    ├── is_public = 1  → accessible publicly
    ├── headline/bio   → override Basics when set
    └── Resumes (linked to this portfolio's filtered content)
        ├── share_token → foliyo.dev/r/{token}
        └── PDF export  → Pro feature (₹99/mo)
```

Dashboard nav (MVP): Overview → My content (Basics…Languages) → Publish (Portfolios, Resume) → Settings. Blog and multi-resume are **post-MVP**.

Public URLs (MVP):
```
foliyo.dev/u/{handle}            → default portfolio
foliyo.dev/u/{handle}/{slug}     → specific portfolio
foliyo.dev/r/{share_token}       → public resume
foliyo.dev/verify/{token}        → resume integrity verification
```

Public URLs (**post-MVP**):
```
foliyo.dev/u/{handle}/blog       → blog listing
foliyo.dev/u/{handle}/blog/{slug} → blog post
```

---

## 16. Privacy, Encryption & DPDP Compliance

**Unchanged from previous scaffold** — all requirements, phases, and DB tables remain identical. Key points:

- **Encryption:** AES-256-GCM via Web Crypto API (`crypto.subtle`) — no native deps needed, built into Node 22+
- **`@meshql/integrity`** now handles resume signing — no separate crypto implementation needed for that use case
- **DPDP Act 2023** compliance checklist unchanged — Phase 1 before launch, Phase 2 within 3 months
- **Self-hosters** own their data entirely — strongest privacy guarantee

### Updated crypto implementation (Web Crypto API)

```typescript
// src/crypto/field.ts
// Uses Web Crypto API (built into Node 22+) — zero dependencies

export async function encrypt(plaintext: string, dek: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, dek, encoded)
  const combined = new Uint8Array([...iv, ...new Uint8Array(ct)])
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(encoded: string, dek: CryptoKey): Promise<string> {
  const combined = new Uint8Array(atob(encoded).split("").map(c => c.charCodeAt(0)))
  const iv = combined.slice(0, 12)
  const ct = combined.slice(12)
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, dek, ct)
  return new TextDecoder().decode(plain)
}
```

---

## 17. API Contract

Base URL: `http://localhost:8080`

### MeshQL query endpoint (reads)
```
GET/POST /mesh/{entity}/{id?}
Headers:
  X-Mesh-Query: base64(JSON field selection)
  Authorization: Bearer <token>  (for private data)

Examples:
GET /mesh/portfolio/nodejs-id
GET /mesh/skill
GET /mesh/post/my-slug
```

### Auth
```
POST /api/auth/signup     { email, password, consent_privacy_policy: true }
POST /api/auth/login      { email, password } → { token, user }
POST /api/auth/logout     → 200
GET  /api/auth/me         → { user } | 401
```

### Write endpoints (standard REST)
```
Profile (basics): GET/PUT  /api/profile
Skills:     GET/POST/PUT/:id/DELETE/:id  /api/skills
Projects:   GET/POST/PUT/:id/DELETE/:id  /api/projects
Experience: GET/POST/PUT/:id/DELETE/:id  /api/experience
Education:  GET/POST/PUT/:id/DELETE/:id  /api/education
Certifications: GET/POST/PUT/:id/DELETE/:id  /api/certifications
Languages:  GET/POST/PUT/:id/DELETE/:id  /api/languages
Public profile (portfolios): GET/POST/PUT/:id/DELETE/:id  /api/portfolios
            PUT /api/portfolios/:id/default
            PUT /api/portfolios/:id/content  (set junction tables)
Resumes:    GET/POST/PUT/:id/DELETE/:id  /api/resumes
            GET /api/resumes/:id/export  → PDF (Pro only)
            POST /api/resumes/:id/regenerate-token
Blog:       GET/POST/PUT/:id/DELETE/:id  /api/blog/posts  # post-MVP
Upload:     POST /api/upload/avatar
            POST /api/upload/project-image
Settings:   GET/PUT /api/settings
Handle:     GET /api/handle/check?handle=john
            POST /api/handle/claim { handle }
Plan:       GET /api/plan
            POST /api/plan/upgrade (Razorpay order)  # ₹99/mo or ₹2999 lifetime
Account:    GET /api/account/export (DPDP)
            DELETE /api/account    (DPDP)
```

### Public routes (no auth)
```
GET /                         → default portfolio HTML
GET /u/:handle                → handle's default portfolio HTML
GET /u/:handle/:slug          → specific portfolio HTML (post-MVP multi)
GET /u/:handle/blog           → blog listing HTML (post-MVP)
GET /u/:handle/blog/:slug     → blog post HTML (post-MVP)
GET /r/:token                 → public resume HTML
GET /verify/:token            → resume integrity check HTML
GET /resume/preview?id=&theme= → resume HTML for PDF generation
```

### Plan-gated endpoints (402 if not Pro)
```
GET /api/resumes/:id/export
PUT /api/settings { custom_domain: "..." }
```

---

## 18. Deployment Guide (VPS + Virtualmin + pqpm)

### Self-hoster flow (public repo)

```bash
# 1. Install pqpm
curl -sSL https://raw.githubusercontent.com/pqpm/pqpm/main/install.sh | sudo bash
sudo systemctl enable --now pqpmd

# 2. Install Foliyo (requires Node 22.5+)
node --version  # must be 22.5+
# If not: nvm install 22 && nvm use 22

# 3. Run installer
curl -sSL https://foliyo.dev/install.sh | bash
# Prompts: admin email, password, data dir, port
# Downloads foliyo binary from GitHub Releases
# Creates ~/.pqpm.toml
# Outputs nginx config

# 4. Start
pqpm start foliyo
pqpm status

# 5. Configure nginx in Virtualmin
# Copy config printed by installer
```

### foliyo.dev deploy (private repo)

```bash
cd ~/foliyo-cloud
git pull
./infra/deploy.sh
# Extracts SaaS dashboard + marketing landing builds
# pqpm restart foliyo
```

### Node version requirement

Self-hosters need Node 22.5+ for `node:sqlite`. The installer checks this and installs via nvm if missing.

```bash
# install.sh snippet
if ! node -e "require('node:sqlite')" 2>/dev/null; then
  echo "Installing Node 22.5+ via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  source ~/.nvm/nvm.sh
  nvm install 22 && nvm use 22 && nvm alias default 22
fi
```

---

## 19. Single Binary Distribution

Self-hosters get a single executable — no Node.js installation required after compilation.

### Option A — Deno compile (recommended)

```bash
# In CI (GitHub Actions):
deno compile \
  --allow-net \
  --allow-read \
  --allow-write \
  --allow-env \
  --include src/migrations/ \
  --include src/templates/ \
  --output dist/foliyo \
  apps/core/src/index.ts

# Produces: foliyo (single executable, ~60–80MB)
# Bundles Deno runtime + all deps + migration files + templates
# Zero Node.js required on self-hoster's server
```

### Option B — pkg (Node.js)

```bash
pkg apps/core/src/index.ts \
  --targets node22-linux-x64,node22-linux-arm64 \
  --assets "src/migrations/**,src/templates/**" \
  --output dist/foliyo
```

### Option C — Run with Node directly (advanced users)

```bash
# For users who already have Node 22.5+
npm install -g @foliyo/core
foliyo start
```

### pqpm manages the binary regardless of option

```toml
[service.foliyo]
command = "/home/foliyo/bin/foliyo"
# Works identically whether foliyo is a Deno binary,
# a pkg binary, or a Node.js script via tsx
```

---

## 20. Docker Support (Future)

```yaml
# infra/docker-compose.yml (future)
services:
  core:
    build: ./apps/core
    ports: ["8080:8080"]
    volumes: ["./data:/data"]
    environment:
      - NODE_ENV=production
      - FOLIYO_DB_PATH=/data/foliyo.db
    # Node 22.5+ base image for node:sqlite
    # FROM node:22.5-alpine

  dashboard:
    build: ./apps/dashboard
    ports: ["3000:80"]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    depends_on: [core, dashboard]
```

---

## 21. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FOLIYO_PORT` | `8080` | HTTP listen port |
| `FOLIYO_HOST` | `0.0.0.0` | Bind address |
| `FOLIYO_DB_DRIVER` | `sqlite` | `sqlite` or `postgres` |
| `FOLIYO_DB_PATH` | `./data/foliyo.db` | SQLite file path |
| `FOLIYO_DB_URL` | — | PostgreSQL connection string |
| `FOLIYO_DATA_DIR` | `./data` | Uploads + PDF cache directory |
| `FOLIYO_ADMIN_EMAIL` | — | Initial admin email (first run) |
| `FOLIYO_ADMIN_PASSWORD` | — | Initial admin password (first run) |
| `FOLIYO_TOKEN_SECRET` | — | Token signing secret (nanoid base) |
| `FOLIYO_INTEGRITY_SECRET` | — | @meshql/integrity signing secret |
| `FOLIYO_MASTER_SECRET` | — | Envelope encryption master secret |
| `FOLIYO_MODE` | `single` | `single` (one user) or `multi` |
| `FOLIYO_SITE_URL` | — | Public URL (for CORS, email links) |
| `FOLIYO_CORS_ORIGINS` | `*` | Allowed CORS origins |
| `FOLIYO_LOG_LEVEL` | `info` | `debug\|info\|warn\|error` |
| `FOLIYO_SMTP_HOST` | — | SMTP server for emails |
| `FOLIYO_SMTP_PORT` | `587` | SMTP port |
| `FOLIYO_SMTP_USER` | — | SMTP username |
| `FOLIYO_SMTP_PASS` | — | SMTP password |
| `FOLIYO_FROM_EMAIL` | — | From address for emails |
| `RAZORPAY_KEY_ID` | — | Razorpay API key (foliyo.dev only) |
| `RAZORPAY_KEY_SECRET` | — | Razorpay secret (foliyo.dev only) |
| `NODE_ENV` | `development` | `development\|production` |

---

## 22. Makefile / Scripts

### Root package.json scripts (pnpm workspace)

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "compile": "turbo run compile",
    "clean": "turbo run clean"
  }
}
```

### turbo.json

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", "build/**"] },
    "dev": { "persistent": true, "cache": false },
    "compile": { "dependsOn": ["build"], "outputs": ["../../dist/**"] },
    "test": { "dependsOn": ["build"] },
    "clean": { "cache": false }
  }
}
```

### apps/core/package.json scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --noEmit",
    "compile:amd64": "deno compile --target x86_64-unknown-linux-gnu --output ../../dist/foliyo-linux-amd64 src/index.ts",
    "compile:arm64": "deno compile --target aarch64-unknown-linux-gnu --output ../../dist/foliyo-linux-arm64 src/index.ts",
    "migrate": "tsx src/migrate.ts",
    "test": "node --experimental-vm-modules node_modules/.bin/jest"
  }
}
```

---

## 23. Build & Release Pipeline

### .github/workflows/ci.yml

```yaml
name: CI
on: [push, pull_request]
jobs:
  core:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22.5' }
      - uses: pnpm/action-setup@v4
        with: { version: '9' }
      - run: pnpm install
      - run: pnpm --filter @foliyo/core test
      - run: pnpm --filter @foliyo/core build

  dashboard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - uses: pnpm/action-setup@v4
        with: { version: '9' }
      - run: pnpm install
      - run: pnpm --filter @foliyo/dashboard check
      - run: pnpm --filter @foliyo/dashboard build
```

### .github/workflows/release.yml

```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22.5' }
      - uses: pnpm/action-setup@v4
        with: { version: '9' }
      - uses: denoland/setup-deno@v2
        with: { deno-version: 'v2.x' }
      - run: pnpm install
      - name: Build dashboard
        run: pnpm --filter @foliyo/dashboard build
      - name: Compile binaries
        run: |
          pnpm --filter @foliyo/core compile:amd64
          pnpm --filter @foliyo/core compile:arm64
      - name: Package dashboard
        run: tar -czf dist/dashboard-build.tar.gz -C apps/dashboard build/
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/foliyo-linux-amd64
            dist/foliyo-linux-arm64
            dist/dashboard-build.tar.gz
```

---

## 24. Coding Conventions

### TypeScript (apps/core)

- ESM throughout — `"type": "module"` in package.json
- No `any` — use Zod for validation at boundaries, infer types from schemas
- All DB queries go through MeshQL resolvers (reads) or explicit parameterised statements (writes) — never string interpolation
- Every write route validates request body with Zod before touching DB
- Auth middleware injects `user` into Hono context — never read user from request body
- Errors: use Hono's built-in `HTTPException` with appropriate status codes
- Logging: `console.log` in dev, structured JSON in production (check `NODE_ENV`)

### SvelteKit (apps/dashboard + cloud landing)

- TypeScript everywhere
- Shared chrome via `@foliyo/brand` and `@foliyo/ui`
- Dashboard: API calls via `@meshql/client` or `lib/api/*.ts` wrappers — never raw fetch in components
- Token stored in Svelte store — never in localStorage
- `+layout.ts` auth guard on every protected route
- Forms use native Svelte event handlers

### Git

- Branch: `feat/meshql-join-portfolio`, `fix/resume-export`, `chore/update-deps`
- Commits: `feat(core): add portfolio section toggle`, `fix(dashboard): token not persisted on refresh`
- PRs require CI passing
- Releases: `v0.4.0`, `v0.5.0` — follow semver

### MeshQL-specific

- Define all entities in `src/schema/` — one file per entity group
- Always use `buildSelectSql` in resolvers — never write raw SELECT for read queries
- Write operations (POST/PUT/DELETE) use direct parameterised SQL — MeshQL is for reads only
- Row-level access always enforced via `@meshql/access` plugin — never trust user_id from request body

---

*This document is the single source of truth for the Foliyo monorepo. AI coding agents should read this file in full before scaffolding, modifying, or extending any part of the system. Stack: Hono + MeshQL + SvelteKit. Language: TypeScript everywhere.*
