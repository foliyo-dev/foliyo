# Foliyo browser extension

Popup-only Manifest V3 extension for signing in and tailoring resumes.

## What it does

- Sign in to Foliyo
- Paste a JD **or** pick skills
- Create a tailored resume via `POST /api/resumes/tailor`
- Download `.fio` (same Free/Pro gates as the web app)

## Develop

```bash
cd foliyo
pnpm install
pnpm --filter @foliyo/extension build
```

Load unpacked:

- **Chrome / Edge:** Extensions → Developer mode → Load unpacked → `apps/extension/dist`
- **Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on → pick `apps/extension/dist/manifest.json`

The background entry is dual-declared (`service_worker` + `scripts`) so Chromium and Firefox can both load it.

After code changes: `pnpm --filter @foliyo/extension build`, then reload the extension.

Default API base: `http://localhost:8080` (use the same host the API prints; `127.0.0.1` is also allowed).

API calls go through the background script (avoids popup CORS). Core also allows `chrome-extension://` / `moz-extension://` origins.
