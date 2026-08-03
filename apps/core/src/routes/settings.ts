import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import { queryOne, run, type FoliyoDb } from "../db.js";
import type { Config } from "../config.js";

const settingsSchema = z.object({
  site_title: z.string().optional(),
  site_description: z.string().optional(),
  theme_slug: z.string().optional(),
  resume_theme: z.string().optional(),
  custom_domain: z.string().optional(),
  seo_keywords: z.string().optional(),
});

export function settingsRoutes(db: FoliyoDb) {
  const r = new Hono<AppEnv>();

  r.get("/", (c) => {
    const userId = c.get("userId");
    const settings = queryOne(db, "SELECT * FROM settings WHERE user_id = ?", [userId]);
    if (!settings) return c.json({ error: "not found" }, 404);
    return c.json(settings);
  });

  r.put("/", async (c) => {
    const userId = c.get("userId");
    const body = settingsSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = body.data;
    const existing = queryOne(db, "SELECT id FROM settings WHERE user_id = ?", [userId]);
    if (existing) {
      run(
        db,
        `UPDATE settings SET site_title=?, site_description=?, theme_slug=?, resume_theme=?,
         custom_domain=?, seo_keywords=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
        [
          d.site_title ?? "My Portfolio", d.site_description ?? "", d.theme_slug ?? "minimal",
          d.resume_theme ?? "classic", d.custom_domain ?? "", d.seo_keywords ?? "", userId,
        ],
      );
    } else {
      run(
        db,
        `INSERT INTO settings (user_id, site_title, site_description, theme_slug, resume_theme, custom_domain, seo_keywords)
         VALUES (?,?,?,?,?,?,?)`,
        [
          userId, d.site_title ?? "My Portfolio", d.site_description ?? "",
          d.theme_slug ?? "minimal", d.resume_theme ?? "classic",
          d.custom_domain ?? "", d.seo_keywords ?? "",
        ],
      );
    }
    const settings = queryOne(db, "SELECT * FROM settings WHERE user_id = ?", [userId]);
    return c.json(settings);
  });

  return r;
}

export function uploadRoutes(_db: FoliyoDb, _config: Config) {
  const r = new Hono<AppEnv>();
  r.post("/avatar", (c) => c.json({ error: "upload not implemented yet" }, 501));
  r.post("/project-image", (c) => c.json({ error: "upload not implemented yet" }, 501));
  return r;
}
