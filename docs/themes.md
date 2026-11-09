# Foliyo themes

Themes live in `packages/themes/` (`@foliyo/themes`):

- `portfolio/` — classic **site** skins (`minimal`, `modern`, `creative`, `noir`, `atelier`, `editorial`)
- `portfolio/recipes/` — exotic **layout recipes** (`photo-hero`, `gallery-grid`, `glassmorphic`)
- `resume/` — **document** share / print pages (`classic`, `compact`, `academic`, `sidebar`)

Public HTML is built **server-side** in `apps/core/src/public/themes.ts`. Classic themes supply `style.css` (inlined) and `theme.json` metadata. Recipe CSS lives under `portfolio/recipes/{recipe}/style.css`. Stub `index.html` / `resume.html` files are notes only — they are not rendered.

## UI contracts

| | Portfolio (site) | Resume (document) |
|--|------------------|-------------------|
| Purpose | Browsable personal website | Job-facing printable snapshot |
| Chrome | Sticky `.site-nav` with section anchors (recipe chrome may vary) | No site nav; floating Print / Save as PDF |
| Sections | Stable `id`s (`#about`, `#projects`, …) | Flat document sections inside `.resume-sheet` |
| Links | Interactive Live / Repo / write-up | Plain `.doc-link` URLs (print-friendly) |
| Social | Pill buttons with icons | Compact text links |
| CSS pack | classic slug **or** recipe CSS + ThemeConfig tokens | `packages/themes/resume/{slug}/` |
| Renderer | `renderPortfolioHtml` | `renderResumeHtml` |

Both share the library data model (`PublicPortfolio` shape) and loaders in `pages.ts`. Content junctions differ (portfolio vs resume snapshots).

### Portfolio section anchors

When content exists, nav links target:

- `#about` — hero
- `#skills`, `#projects`, `#experience`, `#education`, `#certifications`, `#languages`

### Resume document frame

Resume bodies wrap content in `.resume-sheet` inside `<main class="page resume-page">`. Themes style a paper-on-desk look; shared `@media print` / `@page` rules live in the document shell CSS injected by `themes.ts`.

## ThemeConfig (exotic layouts + AI)

Portfolios may store a validated `theme_config` JSON blob (`portfolios.theme_config`). Schema:

- Zod: `apps/core/src/spec/theme-config.ts` (`@foliyo/core/spec/theme-config`)
- JSON Schema: `specs/theme/schema/v1.json`

```ts
{
  version: 1,
  recipe: "classic" | "photo-hero" | "gallery-grid" | "glassmorphic",
  skin: { theme_slug?, colors?, fonts?, radius?, density?, glass? },
  content: { brand?, hero?, stats?, features?, about?, gallery? },
  chrome: { show_nav?, nav_style? }
}
```

Rules:

- AI never invents freeform HTML/CSS — it fills ThemeConfig slots only.
- `theme_config = null` (or missing) → classic rendering via `theme_slug` (unchanged).
- Exotic recipes load recipe CSS and inject CSS variables from `skin`.
- Cloud Pro: `POST /api/ai/theme` returns a draft ThemeConfig (no auto-save). Dashboard reviews and applies via portfolio update.

### Layout recipes

| Recipe | Feel |
|--------|------|
| `classic` | Existing Foliyo skins (`theme_slug`) |
| `photo-hero` | Dark cinematic split hero, stats, feature strip, about |
| `gallery-grid` | Cream centered brand + image-first project grid |
| `glassmorphic` | Frosted glass panels over a vivid atmospheric background |

## Structure

```
packages/themes/portfolio/minimal/
├── theme.json
├── style.css
└── index.html   # documentation stub

packages/themes/portfolio/recipes/photo-hero/style.css
packages/themes/portfolio/recipes/gallery-grid/style.css
packages/themes/portfolio/recipes/glassmorphic/style.css
```

## theme.json

```json
{
  "name": "Minimal",
  "slug": "minimal",
  "description": "Clean, content-first layout",
  "colors": {
    "primary": "#0f766e",
    "background": "#fafaf9",
    "text": "#1c1917"
  }
}
```

Runtime classic rendering uses `style.css` by slug. `theme.json` is picker/docs metadata.

## Portfolio classic skins

| Slug | Audience / feel |
|------|-----------------|
| `minimal` | Clean, content-first |
| `modern` | Card grid, cool accent |
| `creative` | Bold display type, warm hero |
| `noir` | Dark, high-contrast |
| `atelier` | Gallery-like for photographers / visual creatives |
| `editorial` | Magazine type hierarchy for writers / founders |

## Resume themes

| Slug | Audience / feel |
|------|-----------------|
| `classic` | Traditional single column |
| `compact` | Dense, more content per page |
| `academic` | CV-style emphatic headings |
| `sidebar` | Two-column with left contact/skills rail |

## How rendering works

1. Core loads portfolio content, or a resume’s own content snapshot, from SQLite.
2. Portfolio: resolve `theme_config` (or default classic from `theme_slug`).
3. Classic → CSS from `packages/themes/portfolio/{slug}/style.css` + shared hero/sections HTML.
4. Exotic recipe → recipe CSS + `skin` CSS variables + recipe-specific HTML (`apps/core/src/public/recipes.ts`).
5. Resume: `theme_slug` selects CSS; TypeScript builds document sheet HTML.
6. Response is a full HTML document with theme CSS + shell CSS inlined.

## Adding a classic theme

1. Copy an existing theme folder under `portfolio/` or `resume/`.
2. Edit `theme.json` and `style.css` (body class is `theme-{slug}`). Portfolio themes should style `.site-nav`; resume themes should style `.resume-sheet` / `.resume-page`.
3. Add the slug to the allowlists in `apps/core/src/public/themes.ts`, `apps/core/src/routes/preview.ts`, and the dashboard theme pickers (`portfolios.ts` / `resumes.ts` / `settings.ts`).
4. Select the theme in the dashboard under **Portfolios** or **Resume**.

## Adding a layout recipe

1. Add CSS under `packages/themes/portfolio/recipes/{recipe}/style.css` (body class `theme-{recipe}`).
2. Extend `THEME_RECIPES` + Zod schema in `theme-config.ts` and `specs/theme/schema/v1.json`.
3. Add an HTML branch in `apps/core/src/public/recipes.ts` and wire it in `renderPortfolioHtml`.
4. Add the layout to the dashboard `portfolioLayouts` list and AI few-shots in `openrouter-theme.ts`.
