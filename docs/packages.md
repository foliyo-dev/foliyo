# @foliyo/* library packages

Public packages ship on **GitHub Releases** as `.tgz` assets (npm later; names stay `@foliyo/*`).

| Package | Artifact |
|---------|----------|
| `@foliyo/core` | `foliyo-core-<ver>.tgz` |
| `@foliyo/brand` | `foliyo-brand-<ver>.tgz` |
| `@foliyo/ui` | `foliyo-ui-<ver>.tgz` |
| `@foliyo/themes` | `foliyo-themes-<ver>.tgz` |
| `@foliyo/jobs-client` | `foliyo-jobs-client-<ver>.tgz` |

## Cut a lib release

1. Bump `version` in `apps/core` + `packages/{brand,ui,themes,jobs-client}` (and root) together.
2. Push to `main`, then tag: `git tag v0.5.0 && git push origin v0.5.0`
3. [Release workflow](../.github/workflows/release.yml) attaches self-host bundles **and** the library tarballs.

Local pack only:

```bash
./scripts/pack-libs.sh
# → dist/packages/foliyo-*-<ver>.tgz
```

## Consume from foliyo-cloud

```json
"@foliyo/core": "https://github.com/foliyo-dev/foliyo/releases/download/v0.5.0/foliyo-core-0.5.0.tgz"
```

Pin lives in `foliyo-cloud/foliyo.version` + matching URLs. For sibling-repo development: `FOLIYO_LOCAL=1 pnpm install`.
