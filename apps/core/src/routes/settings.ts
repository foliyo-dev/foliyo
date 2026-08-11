import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import { queryOne, run, type FoliyoDb } from "../db.js";
import type { Config } from "../config.js";
import { clearUserContent } from "../account/clear-content.js";

const settingsSchema = z.object({
  site_title: z.string().optional(),
  site_description: z.string().optional(),
  theme_slug: z.string().optional(),
  resume_theme: z.string().optional(),
  custom_domain: z.string().optional(),
  seo_keywords: z.string().optional(),
});

const clearSchema = z.object({
  confirm: z.literal("CLEAR"),
});

export function settingsRoutes(db: FoliyoDb) {
  const r = new Hono<AppEnv>();

  r.get("/", async (c) => {
    const userId = c.get("userId");
    const settings = await queryOne(db, "SELECT * FROM settings WHERE user_id = ?", [userId]);
    if (!settings) return c.json({ error: "not found" }, 404);
    return c.json(settings);
  });

  r.put("/", async (c) => {
    const userId = c.get("userId");
    const body = settingsSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = body.data;
    const existing = await queryOne(db, "SELECT id FROM settings WHERE user_id = ?", [userId]);
    if (existing) {
      await run(
        db,
        `UPDATE settings SET site_title=?, site_description=?, theme_slug=?, resume_theme=?,
         custom_domain=?, seo_keywords=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
        [
          d.site_title ?? "My Portfolio", d.site_description ?? "", d.theme_slug ?? "minimal",
          d.resume_theme ?? "classic", d.custom_domain ?? "", d.seo_keywords ?? "", userId,
        ],
      );
    } else {
      await run(
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
    const settings = await queryOne(db, "SELECT * FROM settings WHERE user_id = ?", [userId]);
    return c.json(settings);
  });

  /**
   * Clear all portfolio/library content. Keeps login email, password, plan, email_verified, profile.
   */
  r.post("/clear-content", async (c) => {
    const userId = c.get("userId");
    const body = clearSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return c.json(
        { error: "confirm_required", message: 'Type CLEAR and send { "confirm": "CLEAR" }.' },
        400,
      );
    }
    const deleted = await clearUserContent(db, userId);
    return c.json({ ok: true, deleted });
  });

  return r;
}

export function uploadRoutes(_db: FoliyoDb, _config: Config) {
  const r = new Hono<AppEnv>();
  r.post("/avatar", (c) => c.json({ error: "upload not implemented yet" }, 501));
  r.post("/project-image", (c) => c.json({ error: "upload not implemented yet" }, 501));
  return r;
}
