import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Release bundle layout (next to server.mjs):
 *   assets/core/migrations|templates|public
 *   assets/cloud/migrations
 *   assets/themes
 *
 * Set FOLIYO_ASSETS_DIR to override. When absent, callers fall back to source paths.
 */
export function resolveAssetsRoot(metaUrl: string = import.meta.url): string | null {
  const fromEnv = process.env.FOLIYO_ASSETS_DIR?.trim();
  if (fromEnv) {
    const abs = resolve(fromEnv);
    if (existsSync(abs)) return abs;
  }

  const here = dirname(fileURLToPath(metaUrl));
  const sibling = join(here, "assets");
  if (
    existsSync(join(sibling, "core", "migrations")) ||
    existsSync(join(sibling, "themes"))
  ) {
    return sibling;
  }

  return null;
}

export function resolveCoreMigrationsDir(metaUrl: string = import.meta.url): string {
  const root = resolveAssetsRoot(metaUrl);
  if (root) return join(root, "core", "migrations");
  return join(dirname(fileURLToPath(metaUrl)), "migrations");
}

export function resolveCloudMigrationsDir(metaUrl: string = import.meta.url): string {
  const root = resolveAssetsRoot(metaUrl);
  if (root) return join(root, "cloud", "migrations");
  return join(dirname(fileURLToPath(metaUrl)), "migrations");
}

export function resolveCoreTemplatesDir(metaUrl: string = import.meta.url): string {
  const root = resolveAssetsRoot(metaUrl);
  if (root) return join(root, "core", "templates");
  return join(dirname(fileURLToPath(metaUrl)), "../templates");
}

export function resolveCorePublicDir(metaUrl: string = import.meta.url): string {
  const root = resolveAssetsRoot(metaUrl);
  if (root) return join(root, "core", "public");
  // Dev: apps/core/public when cwd is apps/core, or relative to src/
  const fromSrc = join(dirname(fileURLToPath(metaUrl)), "../public");
  if (existsSync(fromSrc)) return fromSrc;
  return join(process.cwd(), "public");
}

export function resolveThemesDir(metaUrl: string = import.meta.url): string | null {
  const root = resolveAssetsRoot(metaUrl);
  if (root) {
    const themes = join(root, "themes");
    if (existsSync(join(themes, "portfolio", "minimal", "style.css"))) return themes;
  }
  return null;
}
