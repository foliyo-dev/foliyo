# `@foliyo/ui`

Shared Svelte UI primitives for Foliyo apps. Depends on `@foliyo/brand`.

## Components

- `Logo` — brand mark (`default` | `dark` | `tagline`)
- `Button` — primary / secondary / ghost (optional `href` for links)

## Usage

```svelte
<script>
  import { Logo, Button } from '@foliyo/ui';
</script>

<Logo variant="tagline" width="220" height="53" />
<Button href="https://app.foliyo.dev/signup">Start free</Button>
```

Consuming apps should set Vite `ssr.noExternal: ['@foliyo/ui', '@foliyo/brand']`.
