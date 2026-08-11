import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import { queryAll, queryOne, run, type FoliyoDb, type SqlValue } from "../db.js";
import {
  FREE_RESUME_LIMIT,
  entitlementsFor,
  getEffectiveUserPlan,
  upgradePayload,
} from "../plan.js";

/** Returns a 402 upgrade payload when Free user already has the max resume count. */
async function assertCanCreateResume(
  db: FoliyoDb,
  userId: string,
  config: Config,
): Promise<ReturnType<typeof upgradePayload> | null> {
  const plan = await getEffectiveUserPlan(db, userId, config);
  const limit = entitlementsFor(plan).resume_limit;
  if (limit == null) return null;
  const existing = await queryAll(db, "SELECT id FROM resumes WHERE user_id = ?", [userId]);
  if (existing.length >= limit) {
    return upgradePayload(
      "resumes",
      `Free plan includes ${FREE_RESUME_LIMIT} resume. Delete it or upgrade to Pro for unlimited resumes.`,
    );
  }
  return null;
}
import { loadResumeContent } from "../public/pages.js";
import { renderResumeHtml } from "../public/themes.js";
import {
  copyPortfolioContentToResume,
  filterOwnedContent,
  getResumeContentIds,
  setResumeContent,
} from "../resume/content.js";
import { buildFioFromPortfolio, FIO_MIME } from "../spec/fio.js";
import {
  buildTailorAnalysis,
  computeTailorSelection,
  matchSkillsFromJd,
} from "../skills/tailor.js";

const contentSchema = z.object({
  skill_ids: z.array(z.string()).default([]),
  project_ids: z.array(z.string()).default([]),
  experience_ids: z.array(z.string()).default([]),
  education_ids: z.array(z.string()).default([]),
  certification_ids: z.array(z.string()).default([]),
  language_ids: z.array(z.string()).default([]),
});

const resumeSchema = z.object({
  portfolio_id: z.string().min(1),
  name: z.string().min(1),
  theme_slug: z.string().default("classic"),
  is_public: z.number().int().default(0),
  /** When set, use this snapshot instead of copying the whole portfolio. */
  content: contentSchema.optional(),
});

const tailorSchema = z
  .object({
    name: z.string().min(1),
    portfolio_id: z.string().min(1),
    theme_slug: z.string().default("classic"),
    is_public: z.number().int().default(0),
    skill_ids: z.array(z.string()).optional(),
    jd_text: z.string().optional(),
    include_matching: z.boolean().default(true),
  })
  .refine((d) => (d.skill_ids && d.skill_ids.length > 0) || (d.jd_text && d.jd_text.trim().length > 0), {
    message: "Provide skill_ids or jd_text",
  });

export function resumesRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();

  r.get("/", async (c) => {
    const userId = c.get("userId");
    const items = await queryAll(db, "SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return c.json(items);
  });

  /**
   * Tailor: paste JD and/or pick skills → create resume with its own content snapshot.
   * Does not mutate the seeded portfolio. Exports still use Free/Pro gates (.fio free, PDF Pro).
   */
  r.post("/tailor", async (c) => {
    const userId = c.get("userId");
    const body = tailorSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body", details: body.error.flatten() }, 400);
    const d = body.data;

    const blocked = await assertCanCreateResume(db, userId, config);
    if (blocked) return c.json(blocked, 402);

    const portfolio = await queryOne(db, "SELECT id FROM portfolios WHERE id = ? AND user_id = ?", [
      d.portfolio_id,
      userId,
    ]);
    if (!portfolio) return c.json({ error: "portfolio not found" }, 404);

    const confirmed = await queryAll<{ id: string; name: string }>(
      db,
      "SELECT id, name FROM skills WHERE user_id = ? AND status = 'confirmed'",
      [userId],
    );

    const selectedIds = d.skill_ids ?? [];
    const hadJd = Boolean(d.jd_text?.trim());
    const hadSelection = selectedIds.length > 0;
    const fromJd = hadJd ? matchSkillsFromJd(d.jd_text!, confirmed) : [];
    const skillIds = [...new Set([...selectedIds, ...fromJd])];

    if (skillIds.length === 0) {
      return c.json(
        { error: "no_matching_skills", message: "No confirmed skills matched. Pick skills manually." },
        400,
      );
    }

    const content = await computeTailorSelection(db, userId, skillIds, d.include_matching);

    const shareToken = nanoid(16);
    await run(
      db,
      "INSERT INTO resumes (portfolio_id, user_id, name, theme_slug, is_public, share_token) VALUES (?,?,?,?,?,?)",
      [d.portfolio_id, userId, d.name, d.theme_slug, d.is_public, shareToken],
    );

    const resume = await queryOne<{ id: string }>(
      db,
      "SELECT * FROM resumes WHERE share_token = ? AND user_id = ?",
      [shareToken, userId],
    );
    if (!resume) return c.json({ error: "failed to create resume" }, 500);

    await setResumeContent(db, resume.id, content);

    const full = await queryOne(db, "SELECT * FROM resumes WHERE id = ? AND user_id = ?", [
      resume.id,
      userId,
    ]);

    const analysis = buildTailorAnalysis({
      confirmed,
      selectedIds,
      fromJdIds: fromJd,
      content,
      hadJd,
      hadSelection,
    });

    return c.json(
      {
        resume: full,
        content,
        matched_skill_ids: content.skill_ids,
        analysis,
      },
      201,
    );
  });

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const body = resumeSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = body.data;

    const blocked = await assertCanCreateResume(db, userId, config);
    if (blocked) return c.json(blocked, 402);

    const portfolio = await queryOne(db, "SELECT id FROM portfolios WHERE id = ? AND user_id = ?", [
      d.portfolio_id,
      userId,
    ]);
    if (!portfolio) return c.json({ error: "portfolio not found" }, 404);

    const shareToken = nanoid(16);
    await run(
      db,
      "INSERT INTO resumes (portfolio_id, user_id, name, theme_slug, is_public, share_token) VALUES (?,?,?,?,?,?)",
      [d.portfolio_id, userId, d.name, d.theme_slug, d.is_public, shareToken],
    );

    const created = await queryOne<{ id: string }>(
      db,
      "SELECT id FROM resumes WHERE share_token = ? AND user_id = ?",
      [shareToken, userId],
    );
    if (created) {
      if (d.content) {
        const owned = await filterOwnedContent(db, userId, d.content);
        const total =
          owned.skill_ids.length +
          owned.project_ids.length +
          owned.experience_ids.length +
          owned.education_ids.length +
          owned.certification_ids.length +
          owned.language_ids.length;
        if (total === 0) {
          await run(db, "DELETE FROM resumes WHERE id = ? AND user_id = ?", [created.id, userId]);
          return c.json(
            { error: "empty_content", message: "Select at least one library item for a custom resume." },
            400,
          );
        }
        await setResumeContent(db, created.id, owned);
      } else {
        await copyPortfolioContentToResume(db, created.id, d.portfolio_id);
      }
    }

    const items = await queryAll(db, "SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return c.json(items, 201);
  });

  r.get("/:id/content", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const resume = await queryOne(db, "SELECT id FROM resumes WHERE id = ? AND user_id = ?", [id, userId]);
    if (!resume) return c.json({ error: "not found" }, 404);
    return c.json(await getResumeContentIds(db, id));
  });

  r.put("/:id/content", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const resume = await queryOne(db, "SELECT id FROM resumes WHERE id = ? AND user_id = ?", [id, userId]);
    if (!resume) return c.json({ error: "not found" }, 404);
    const body = contentSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    await setResumeContent(db, id, await filterOwnedContent(db, userId, body.data));
    return c.json({ ok: true });
  });

  r.put("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = resumeSchema.omit({ content: true }).partial().safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const cols = Object.keys(body.data);
    if (cols.length === 0) return c.json({ ok: true });
    const sets = cols.map((col) => `${col}=?`).join(", ");
    await run(db, `UPDATE resumes SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`, [
      ...(Object.values(body.data) as SqlValue[]), id, userId,
    ]);
    return c.json({ ok: true });
  });

  r.delete("/:id", async (c) => {
    const userId = c.get("userId");
    await run(db, "DELETE FROM resumes WHERE id=? AND user_id=?", [c.req.param("id"), userId]);
    return c.body(null, 204);
  });

  r.post("/:id/regenerate-token", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const token = nanoid(16);
    await run(db, "UPDATE resumes SET share_token=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?", [
      token, id, userId,
    ]);
    return c.json({ share_token: token });
  });

  /**
   * Foliyo Resume Spec `.fio` export — available on all plans (growth lever).
   * PDF/HTML print export remains Pro via GET /:id/export.
   */
  r.get("/:id/export.fio", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const resume = await queryOne<{
      id: string;
      name: string;
      theme_slug: string;
      portfolio_id: string | null;
      share_token: string;
      is_public: number;
    }>(db, "SELECT * FROM resumes WHERE id = ? AND user_id = ?", [id, userId]);

    if (!resume) return c.json({ error: "not found" }, 404);

    const data = await loadResumeContent(db, resume.id);
    if (!data) return c.json({ error: "not found" }, 404);

    const fio = buildFioFromPortfolio(
      data,
      {
        name: resume.name,
        theme_slug: resume.theme_slug,
        share_token: resume.share_token,
        is_public: resume.is_public,
      },
      { siteUrl: config.siteUrl, integritySecret: config.integritySecret },
    );

    c.header("Content-Type", FIO_MIME);
    c.header("Content-Disposition", `attachment; filename="${fio.filename}"`);
    c.header("X-Foliyo-Export", "fio");
    c.header("X-Foliyo-Content-Hash", fio.manifest.content_hash);
    return c.body(Buffer.from(fio.bytes));
  });

  /**
   * PDF export gate. Free → 402 with upgrade payload.
   * Pro → printable HTML interim until Chromium PDF (Phase B export engine).
   */
  r.get("/:id/export", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const plan = await getEffectiveUserPlan(db, userId, config);
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

    const resume = await queryOne<{
      id: string;
      name: string;
      theme_slug: string;
      portfolio_id: string | null;
      user_id: string;
    }>(db, "SELECT * FROM resumes WHERE id = ? AND user_id = ?", [id, userId]);

    if (!resume) return c.json({ error: "not found" }, 404);

    const data = await loadResumeContent(db, resume.id);
    if (!data) return c.json({ error: "not found" }, 404);

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
