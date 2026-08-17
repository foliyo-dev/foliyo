# Foliyo browser extension

Popup-only Manifest V3 extension for signing in, analyzing a pasted JD against your Library, tailoring resumes, and browsing recent resumes.

## What it does

- Sign in with compile-time API / app URLs (no manual API base field)
- **Tailor** tab: paste JD → analysis → Create tailored resume (sheet: folio, name, theme, visibility)
- **History** tab: saved JD analyses — open one to continue on Tailor (no extra AI units)
- **Resumes** tab: browse recent resumes, download `.fio`, open in Foliyo
- **Create** tab: pick skills + optional library items → create resume manually
- Suggests existing resumes when JD was tailored before (local cache + skill overlap)
- Missing skills link to Foliyo `/skills` page
- Plan badge and Pro enhance-parse option

## Develop

```bash
cd foliyo
pnpm install
pnpm --filter @foliyo/extension dev
```

Load unpacked:

- **Chrome / Edge:** Extensions → Developer mode → Load unpacked → `apps/extension/dist`
- **Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on → pick `apps/extension/dist/manifest.json`

Toolbar / store icons are the Foliyo tile mark (`public/icons/`, from `@foliyo/brand` outlined icon). After code changes, rebuild and reload the extension.

### Build-time URLs

| Variable | Dev default | Prod (`build:prod`) |
|----------|-------------|---------------------|
| `VITE_API_BASE` | `http://localhost:8080` | `https://api.foliyo.dev` |
| `VITE_APP_BASE` | `http://localhost:5173` | `https://app.foliyo.dev` |

```bash
pnpm --filter @foliyo/extension build          # local dev URLs
pnpm --filter @foliyo/extension build:prod     # production URLs
```

API calls go through the background script (avoids popup CORS). Core also allows `chrome-extension://` / `moz-extension://` origins.

The background entry is dual-declared (`service_worker` + `scripts`) so Chromium and Firefox can both load it.
