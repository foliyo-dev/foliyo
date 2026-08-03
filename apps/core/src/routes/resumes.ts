import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import { queryAll, queryOne, run, type FoliyoDb } from "../db.js";
import { entitlementsFor, getEffectiveUserPlan, upgradePayload } from "../plan.js";
import { loadPortfolioContent } from "../public/pages.js";
import { renderResumeHtml } from "../public/themes.js";

const resumeSchema = z.object({
  portfolio_id: z.string().min(1),
  name: z.string().min(1),
  theme_slug: z.string().default("classic"),
  is_public: z.number().int().default(0),
});

export function resumesRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();

  r.get("/", (c) => {
    const userId = c.get("userId");
    const items = queryAll(db, "SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return c.json(items);
  });

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const body = resumeSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = body.data;
    run(
      db,
      "INSERT INTO resumes (portfolio_id, user_id, name, theme_slug, is_public, share_token) VALUES (?,?,?,?,?,?)",
      [d.portfolio_id, userId, d.name, d.theme_slug, d.is_public, nanoid(16)],
    );
    const items = queryAll(db, "SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return c.json(items, 201);
  });

  r.put("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = resumeSchema.partial().safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const cols = Object.keys(body.data);
    if (cols.length === 0) return c.json({ ok: true });
    const sets = cols.map((col) => `${col}=?`).join(", ");
    run(db, `UPDATE resumes SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`, [
      ...Object.values(body.data), id, userId,
    ]);
    return c.json({ ok: true });
  });

  r.delete("/:id", (c) => {
    const userId = c.get("userId");
    run(db, "DELETE FROM resumes WHERE id=? AND user_id=?", [c.req.param("id"), userId]);
    return c.body(null, 204);
  });

  r.post("/:id/regenerate-token", (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const token = nanoid(16);
    run(db, "UPDATE resumes SET share_token=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?", [
      token, id, userId,
    ]);
    return c.json({ share_token: token });
  });

  /**
   * PDF export gate. Free → 402 with upgrade payload.
   * Pro → printable HTML interim until Chromium PDF (Phase B export engine).
   */
  r.get("/:id/export", (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const plan = getEffectiveUserPlan(db, userId, config);
    const ents = entitlementsFor(plan);

    if (!ents.pdf_export) {
      return c.json(
        upgradePayload(
          "pdf_export",
          "PDF export is a Pro feature (₹99/mo). Upgrade to download print-ready resumes.",
        ),
        402,
      );
    }

    const resume = queryOne<{
      id: string;
      name: string;
      theme_slug: string;
      portfolio_id: string;
      user_id: string;
    }>(db, "SELECT * FROM resumes WHERE id = ? AND user_id = ?", [id, userId]);

    if (!resume) return c.json({ error: "not found" }, 404);

    const data = loadPortfolioContent(db, resume.portfolio_id);
    if (!data) return c.json({ error: "portfolio not found" }, 404);

    const html = renderResumeHtml(
      data,
      { name: resume.name, theme_slug: resume.theme_slug },
      config,
    );

    const safeName = resume.name.replace(/[^\w\-]+/g, "_").slice(0, 64) || "resume";
    c.header("Content-Type", "text/html; charset=utf-8");
    c.header("Content-Disposition", `inline; filename="${safeName}.html"`);
    c.header("X-Foliyo-Export", "html-interim");
    return c.body(html);
  });

  return r;
}
