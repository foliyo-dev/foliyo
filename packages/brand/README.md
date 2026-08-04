# `@foliyo/brand`

Shared Foliyo design tokens and logo SVGs. Used by the OSS dashboard and private cloud landing/apps.

## Usage

```css
@import '@foliyo/brand/tokens.css';
```

```ts
import logoUrl from '@foliyo/brand/assets/foliyo-logo.svg?url';
```

## Assets

| File | Use |
|------|-----|
| `foliyo-logo.svg` | Header / sidebar (light backgrounds) |
| `foliyo-logo-dark.svg` | Dark backgrounds |
| `foliyo-logo-tagline.svg` | Hero, login |
| `foliyo-icon.svg` | Favicon, app icon |
| `foliyo-icon-outlined.svg` | Light UI accents |

## Colors

| Token | Value | Role |
|-------|-------|------|
| `--color-primary` | `#534AB7` | Brand purple |
| `--color-primary-muted` | `#7F77DD` | Lighter purple |
| `--color-primary-deep` | `#2A2760` | Deep purple |
| `--color-accent` | `#E8C547` | Gold highlight |
| `--color-text` / `--color-text-inverse` | `#1A1A2E` / `#F0EDE8` | Light / dark UI text |

This package is the source of truth. App `static/images/` copies are for runtime/public serving — run `foliyo/scripts/sync-brand-assets.sh` after changing assets.
