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

This package is the source of truth. App `static/images/` copies are for runtime/public serving until build pipelines import from here.
