import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import type { FoliyoDb } from "../db.js";
import { loadLibraryPreview } from "../public/pages.js";
import { renderPortfolioHtml } from "../public/themes.js";

const THEME_SLUGS = new Set(["minimal", "modern", "creative"]);

/** Authenticated HTML preview of the full content library as a synthetic portfolio. */
export function previewRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();

  r.get("/library", (c) => {
    const userId = c.get("userId");
    const themeParam = (c.req.query("theme") ?? "").trim().toLowerCase();
    const themeOverride = THEME_SLUGS.has(themeParam) ? themeParam : undefined;

    const data = loadLibraryPreview(db, userId, themeOverride);
    if (!data) return c.json({ error: "not found" }, 404);

    const html = renderPortfolioHtml(data, config);
    return c.html(html);
  });

  return r;
}
