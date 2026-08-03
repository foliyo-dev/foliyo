# Foliyo Dashboard

Admin UI for Foliyo — SvelteKit static app. Calls core API cross-origin with Bearer token auth.

## Scaffold

Created with [Svelte CLI](https://svelte.dev/docs/cli):

```sh
npx sv create dashboard \
  --template minimal \
  --types ts \
  --add sveltekit-adapter=adapter:static \
  --install npm
```

## Development

```sh
npm install
npm run dev
```

Open http://localhost:5173 (API at `http://localhost:8080/api` via Bearer token — see `.env.development`).

## Build

```sh
npm run build
```

Output: `build/` — served by nginx with SPA fallback (`index.html`).

## Environment (build time)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | Core API base URL |
| `VITE_BLOG_URL` | `http://localhost:8081` | Pressbin blog URL |
