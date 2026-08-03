# Foliyo themes

Themes live in `packages/themes/` (`@foliyo/themes`):

- `portfolio/` — public portfolio pages (`minimal`, `modern`, `creative`)
- `resume/` — resume share pages (`classic`, `compact`, `academic`)

Public HTML is built **server-side** in `apps/core/src/public/themes.ts`. Each theme supplies `style.css` (inlined into the page) and `theme.json` metadata. Stub `index.html` / `resume.html` files are notes only — they are not rendered.

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

## How rendering works

1. Core loads portfolio (or resume → portfolio) content from SQLite.
2. `theme_slug` selects CSS from `packages/themes/{portfolio|resume}/{slug}/style.css`.
3. TypeScript builds section HTML (skills, projects with Live/Repo/Write-up links, experience, education, certifications, languages).
4. Response is a full HTML document with CSS inlined (works for Node and Deno single-binary).

## Adding a theme

1. Copy an existing theme folder under `portfolio/` or `resume/`.
2. Edit `theme.json` and `style.css` (body class is `theme-{slug}`).
3. Add the slug to the allowlists in `apps/core/src/public/themes.ts` and the dashboard theme pickers.
4. Select the theme in the dashboard under **Portfolios** or **Resume**.
