# Foliyo themes

Themes live in `packages/themes/` (`@foliyo/themes`):

- `portfolio/` — public **site** pages (`minimal`, `modern`, `creative`, `noir`, `atelier`, `editorial`)
- `resume/` — **document** share / print pages (`classic`, `compact`, `academic`, `sidebar`)

Public HTML is built **server-side** in `apps/core/src/public/themes.ts`. Each theme supplies `style.css` (inlined into the page) and `theme.json` metadata. Stub `index.html` / `resume.html` files are notes only — they are not rendered.

## UI contracts

| | Portfolio (site) | Resume (document) |
|--|------------------|-------------------|
| Purpose | Browsable personal website | Job-facing printable snapshot |
| Chrome | Sticky `.site-nav` with section anchors | No site nav; floating Print / Save as PDF |
| Sections | Stable `id`s (`#about`, `#projects`, …) | Flat document sections inside `.resume-sheet` |
| Links | Interactive Live / Repo / write-up | Plain `.doc-link` URLs (print-friendly) |
| Social | Pill buttons with icons | Compact text links |
| CSS pack | `packages/themes/portfolio/{slug}/` | `packages/themes/resume/{slug}/` |
| Renderer | `renderPortfolioHtml` | `renderResumeHtml` |

Both share the library data model (`PublicPortfolio` shape) and loaders in `pages.ts`. Content junctions differ (portfolio vs resume snapshots).

### Portfolio section anchors

When content exists, nav links target:

- `#about` — hero
- `#skills`, `#projects`, `#experience`, `#education`, `#certifications`, `#languages`

### Resume document frame

Resume bodies wrap content in `.resume-sheet` inside `<main class="page resume-page">`. Themes style a paper-on-desk look; shared `@media print` / `@page` rules live in the document shell CSS injected by `themes.ts`.

## Structure

```
packages/themes/portfolio/minimal/
├── theme.json
├── style.css
└── index.html   # documentation stub
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

## Portfolio themes

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
2. `theme_slug` selects CSS from `packages/themes/{portfolio|resume}/{slug}/style.css`.
3. TypeScript builds type-specific HTML (site nav vs document sheet).
4. Response is a full HTML document with theme CSS + shell CSS inlined (works for Node and Deno single-binary).
5. `sidebar` resume wraps hero/skills/languages/certs in a left rail; experience/education/projects go in the main column.

## Adding a theme

1. Copy an existing theme folder under `portfolio/` or `resume/`.
2. Edit `theme.json` and `style.css` (body class is `theme-{slug}`). Portfolio themes should style `.site-nav`; resume themes should style `.resume-sheet` / `.resume-page`.
3. Add the slug to the allowlists in `apps/core/src/public/themes.ts`, `apps/core/src/routes/preview.ts`, and the dashboard theme pickers (`portfolios.ts` / `resumes.ts` / `settings.ts`).
4. Select the theme in the dashboard under **Portfolios** or **Resume**.
