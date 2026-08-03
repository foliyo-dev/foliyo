# Foliyo themes

Themes live in `packages/themes/`:

- `portfolio/` — public portfolio pages (Go templates)
- `resume/` — resume HTML + PDF export

## Structure

```
packages/themes/portfolio/minimal/
├── theme.json
├── index.html
└── style.css
```

## theme.json

```json
{
  "name": "Minimal",
  "slug": "minimal",
  "description": "Clean, content-first layout",
  "colors": {
    "primary": "#000000",
    "background": "#ffffff",
    "text": "#333333"
  }
}
```

## Template variables

| Variable | Content |
|----------|---------|
| `{{.Profile}}` | Name, bio, avatar, social links |
| `{{.Skills}}` | Skill list |
| `{{.Projects}}` | Projects |
| `{{.Experience}}` | Work history |
| `{{.Education}}` | Education |
| `{{.Settings}}` | Site title, theme overrides |

## Adding a theme

1. Copy an existing theme folder under `portfolio/` or `resume/`.
2. Edit `theme.json`, `index.html` (or `resume.html`), and `style.css`.
3. Select the theme slug in the dashboard under **Themes** or **Resume**.
