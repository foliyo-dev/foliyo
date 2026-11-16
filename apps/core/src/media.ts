import { randomBytes } from "node:crypto";
import type { Config } from "./config.js";
import { queryAll, queryOne, run, type FoliyoDb } from "./db.js";
import { getStorage, parseUploadKey } from "./storage/index.js";

export type MediaAssetRow = {
  id: string;
  url: string;
  created_at: string;
};

function newId(): string {
  return randomBytes(16).toString("hex");
}

function isUploadUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/uploads/");
}

function collectThemeUploadUrls(themeConfig: unknown): string[] {
  if (themeConfig == null || themeConfig === "") return [];
  let parsed: unknown = themeConfig;
  if (typeof themeConfig === "string") {
    try {
      parsed = JSON.parse(themeConfig);
    } catch {
      return [];
    }
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const content = (parsed as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return [];
  const c = content as {
    hero?: { image_url?: unknown };
    about?: { image_url?: unknown };
    brand?: { logo_url?: unknown };
  };
  const urls: string[] = [];
  if (isUploadUrl(c.hero?.image_url)) urls.push(c.hero.image_url);
  if (isUploadUrl(c.about?.image_url)) urls.push(c.about.image_url);
  if (isUploadUrl(c.brand?.logo_url)) urls.push(c.brand.logo_url);
  return urls;
}

/** Insert a media_assets row; duplicate (user_id, url) is ignored. */
export async function insertMediaAsset(
  db: FoliyoDb,
  userId: string,
  url: string,
): Promise<void> {
  if (!isUploadUrl(url)) return;
  await run(
    db,
    `INSERT INTO media_assets (id, user_id, url) VALUES (?,?,?) ON CONFLICT DO NOTHING`,
    [newId(), userId, url],
  );
}

/**
 * Collect distinct /uploads/… URLs from the user's projects, blog posts, and
 * portfolio theme_config, then upsert any missing media_assets rows.
 */
export async function backfillMediaAssets(
  db: FoliyoDb,
  userId: string,
): Promise<void> {
  const urls = new Set<string>();

  const projectRows = await queryAll<{ image_url: string }>(
    db,
    `SELECT image_url FROM projects WHERE user_id = ? AND image_url LIKE '/uploads/%'`,
    [userId],
  );
  for (const row of projectRows) {
    if (isUploadUrl(row.image_url)) urls.add(row.image_url);
  }

  const blogRows = await queryAll<{ cover_image: string }>(
    db,
    `SELECT cover_image FROM blog_posts WHERE user_id = ? AND cover_image LIKE '/uploads/%'`,
    [userId],
  );
  for (const row of blogRows) {
    if (isUploadUrl(row.cover_image)) urls.add(row.cover_image);
  }

  const portfolioRows = await queryAll<{ theme_config: string | null }>(
    db,
    `SELECT theme_config FROM portfolios WHERE user_id = ? AND theme_config IS NOT NULL`,
    [userId],
  );
  for (const row of portfolioRows) {
    for (const url of collectThemeUploadUrls(row.theme_config)) {
      urls.add(url);
    }
  }

  for (const url of urls) {
    await insertMediaAsset(db, userId, url);
  }
}

/** List media assets for a user, newest first. Backfills from content first. */
export async function listMediaAssets(
  db: FoliyoDb,
  userId: string,
): Promise<MediaAssetRow[]> {
  await backfillMediaAssets(db, userId);
  return queryAll<MediaAssetRow>(
    db,
    `SELECT id, url, created_at FROM media_assets WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    [userId],
  );
}

function stripUrlFromThemeConfig(themeConfig: string | null, url: string): string | null {
  if (!themeConfig) return themeConfig;
  let parsed: unknown;
  try {
    parsed = JSON.parse(themeConfig);
  } catch {
    return themeConfig;
  }
  if (typeof parsed !== "object" || parsed === null) return themeConfig;
  const root = parsed as { content?: Record<string, unknown> };
  if (!root.content || typeof root.content !== "object") return themeConfig;
  const content = { ...root.content };
  let changed = false;

  const scrub = (key: "hero" | "about" | "brand", field: "image_url" | "logo_url") => {
    const block = content[key];
    if (!block || typeof block !== "object") return;
    const next = { ...(block as Record<string, unknown>) };
    if (next[field] === url) {
      delete next[field];
      content[key] = next;
      changed = true;
    }
  };
  scrub("hero", "image_url");
  scrub("about", "image_url");
  scrub("brand", "logo_url");

  if (!changed) return themeConfig;
  return JSON.stringify({ ...root, content });
}

/** Clear content references that point at this upload URL. */
export async function clearMediaReferences(
  db: FoliyoDb,
  userId: string,
  url: string,
): Promise<void> {
  await run(
    db,
    `UPDATE projects SET image_url = '' WHERE user_id = ? AND image_url = ?`,
    [userId, url],
  );
  await run(
    db,
    `UPDATE blog_posts SET cover_image = '' WHERE user_id = ? AND cover_image = ?`,
    [userId, url],
  );

  const portfolios = await queryAll<{ id: string; theme_config: string | null }>(
    db,
    `SELECT id, theme_config FROM portfolios WHERE user_id = ? AND theme_config IS NOT NULL`,
    [userId],
  );
  for (const row of portfolios) {
    const next = stripUrlFromThemeConfig(row.theme_config, url);
    if (next !== row.theme_config) {
      await run(db, `UPDATE portfolios SET theme_config = ? WHERE id = ? AND user_id = ?`, [
        next,
        row.id,
        userId,
      ]);
    }
  }
}

/**
 * Delete a media asset for the user: clear references, remove DB row, delete blob.
 * Returns false if the asset was not found / not owned.
 */
export async function deleteMediaAsset(
  db: FoliyoDb,
  config: Config,
  userId: string,
  id: string,
): Promise<boolean> {
  const row = await queryOne<MediaAssetRow>(
    db,
    `SELECT id, url, created_at FROM media_assets WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
  if (!row) return false;

  await clearMediaReferences(db, userId, row.url);
  await run(db, `DELETE FROM media_assets WHERE id = ? AND user_id = ?`, [id, userId]);

  const key = parseUploadKey(row.url);
  if (key) {
    try {
      await getStorage(config).delete(key);
    } catch {
      // Blob may already be missing; DB row is already gone.
    }
  }
  return true;
}
