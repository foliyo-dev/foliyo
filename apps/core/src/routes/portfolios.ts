import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import { queryAll, queryOne, run, withTransaction, type FoliyoDb, type SqlValue } from "../db.js";
import { filterOwnedContent } from "../resume/content.js";
import { orderedJunctionIds, sortIdsByLibraryOrder } from "../content-order.js";
import {
  FREE_PORTFOLIO_LIMIT,
  getEffectiveUserPlan,
  isProPlan,
  upgradePayload,
} from "../plan.js";

const portfolioSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().default(""),
  headline: z.string().default(""),
  bio: z.string().default(""),
  theme_slug: z.string().default("minimal"),
  is_public: z.number().int().default(0),
  is_default: z.number().int().default(0),
  show_skills: z.number().int().default(1),
  show_projects: z.number().int().default(1),
  show_experience: z.number().int().default(1),
  show_education: z.number().int().default(1),
  show_certifications: z.number().int().default(1),
  show_languages: z.number().int().default(1),
  skills_title: z.string().max(40).default(""),
  projects_title: z.string().max(40).default(""),
  experience_title: z.string().max(40).default(""),
  education_title: z.string().max(40).default(""),
  certifications_title: z.string().max(40).default(""),
  languages_title: z.string().max(40).default(""),
  sort_order: z.number().int().default(0),
  /** Resume shown as a "Download resume" button on this public portfolio, if any. */
  resume_id: z.string().nullable().default(null),
});

const contentSchema = z.object({
  skill_ids: z.array(z.string()).default([]),
  project_ids: z.array(z.string()).default([]),
  experience_ids: z.array(z.string()).default([]),
  education_ids: z.array(z.string()).default([]),
  certification_ids: z.array(z.string()).default([]),
  language_ids: z.array(z.string()).default([]),
});

async function getContentIds(db: FoliyoDb, portfolioId: string) {
  const [skills, projects, experience, education, certifications, languages] = await Promise.all([
    orderedJunctionIds(db, "portfolio_skills", "portfolio_id", portfolioId, "skill_id", "skills", false),
    orderedJunctionIds(
      db,
      "portfolio_projects",
      "portfolio_id",
      portfolioId,
      "project_id",
      "projects",
      true,
    ),
    orderedJunctionIds(
      db,
      "portfolio_experience",
      "portfolio_id",
      portfolioId,
      "experience_id",
      "experience",
      true,
    ),
    orderedJunctionIds(
      db,
      "portfolio_education",
      "portfolio_id",
      portfolioId,
      "education_id",
      "education",
      true,
    ),
    orderedJunctionIds(
      db,
      "portfolio_certifications",
      "portfolio_id",
      portfolioId,
      "certification_id",
      "certifications",
      false,
    ),
    orderedJunctionIds(
      db,
      "portfolio_languages",
      "portfolio_id",
      portfolioId,
      "language_id",
      "languages",
      false,
    ),
  ]);
  return {
    skill_ids: skills,
    project_ids: projects,
    experience_ids: experience,
    education_ids: education,
    certification_ids: certifications,
    language_ids: languages,
  };
}

async function setContent(
  db: FoliyoDb,
  portfolioId: string,
  userId: string,
  content: z.infer<typeof contentSchema>,
) {
  const owned = await filterOwnedContent(db, userId, content);
  const skill_ids = await sortIdsByLibraryOrder(db, "skills", owned.skill_ids);
  const project_ids = await sortIdsByLibraryOrder(db, "projects", owned.project_ids);
  const experience_ids = await sortIdsByLibraryOrder(db, "experience", owned.experience_ids);
  const education_ids = await sortIdsByLibraryOrder(db, "education", owned.education_ids);
  const certification_ids = await sortIdsByLibraryOrder(db, "certifications", owned.certification_ids);
  const language_ids = await sortIdsByLibraryOrder(db, "languages", owned.language_ids);

  await withTransaction(db, async () => {
    await run(db, "DELETE FROM portfolio_skills WHERE portfolio_id = ?", [portfolioId]);
    await run(db, "DELETE FROM portfolio_projects WHERE portfolio_id = ?", [portfolioId]);
    await run(db, "DELETE FROM portfolio_experience WHERE portfolio_id = ?", [portfolioId]);
    await run(db, "DELETE FROM portfolio_education WHERE portfolio_id = ?", [portfolioId]);
    await run(db, "DELETE FROM portfolio_certifications WHERE portfolio_id = ?", [portfolioId]);
    await run(db, "DELETE FROM portfolio_languages WHERE portfolio_id = ?", [portfolioId]);
    for (const skillId of skill_ids) {
      await run(db, "INSERT INTO portfolio_skills (portfolio_id, skill_id) VALUES (?, ?)", [portfolioId, skillId]);
    }
    for (const [sortOrder, projectId] of project_ids.entries()) {
      await run(db, "INSERT INTO portfolio_projects (portfolio_id, project_id, sort_order) VALUES (?, ?, ?)", [
        portfolioId,
        projectId,
        sortOrder,
      ]);
    }
    for (const [sortOrder, experienceId] of experience_ids.entries()) {
      await run(db, "INSERT INTO portfolio_experience (portfolio_id, experience_id, sort_order) VALUES (?, ?, ?)", [
        portfolioId,
        experienceId,
        sortOrder,
      ]);
    }
    for (const [sortOrder, educationId] of education_ids.entries()) {
      await run(db, "INSERT INTO portfolio_education (portfolio_id, education_id, sort_order) VALUES (?, ?, ?)", [
        portfolioId,
        educationId,
        sortOrder,
      ]);
    }
    for (const certificationId of certification_ids) {
      await run(db, "INSERT INTO portfolio_certifications (portfolio_id, certification_id) VALUES (?, ?)", [
        portfolioId,
        certificationId,
      ]);
    }
    for (const languageId of language_ids) {
      await run(db, "INSERT INTO portfolio_languages (portfolio_id, language_id) VALUES (?, ?)", [
        portfolioId,
        languageId,
      ]);
    }
  });
  return {
    skill_ids,
    project_ids,
    experience_ids,
    education_ids,
    certification_ids,
    language_ids,
  };
}

export function portfoliosRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();

  r.get("/", async (c) => {
    const userId = c.get("userId");
    const items = await queryAll(db, "SELECT * FROM portfolios WHERE user_id = ? ORDER BY sort_order", [userId]);
    return c.json(items);
  });

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const plan = await getEffectiveUserPlan(db, userId, config);
    if (!isProPlan(plan)) {
      const existing = await queryAll(db, "SELECT id FROM portfolios WHERE user_id = ?", [userId]);
      if (existing.length >= FREE_PORTFOLIO_LIMIT) {
        return c.json(
          upgradePayload(
            "portfolios",
            "Free plan includes 1 portfolio. Upgrade to Pro for unlimited portfolios.",
          ),
          402,
        );
      }
    }

    const body = portfolioSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = body.data;
    const existingCount = (await queryAll(db, "SELECT id FROM portfolios WHERE user_id = ?", [userId])).length;
    const isDefault = d.is_default || existingCount === 0 ? 1 : d.is_default;

    if (isDefault) {
      await run(db, "UPDATE portfolios SET is_default=0 WHERE user_id=?", [userId]);
    }

    if (d.resume_id) {
      const owned = await queryOne(db, "SELECT id FROM resumes WHERE id = ? AND user_id = ?", [
        d.resume_id,
        userId,
      ]);
      if (!owned) return c.json({ error: "resume not found" }, 404);
    }

    await run(
      db,
      `INSERT INTO portfolios (user_id, name, slug, description, headline, bio, theme_slug, is_public, is_default,
       show_skills, show_projects, show_experience, show_education, show_certifications, show_languages,
       skills_title, projects_title, experience_title, education_title, certifications_title, languages_title,
       sort_order, resume_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId, d.name, d.slug, d.description, d.headline, d.bio, d.theme_slug, d.is_public, isDefault,
        d.show_skills, d.show_projects, d.show_experience, d.show_education, d.show_certifications,
        d.show_languages, d.skills_title, d.projects_title, d.experience_title, d.education_title,
        d.certifications_title, d.languages_title, d.sort_order, d.resume_id,
      ],
    );
    const items = await queryAll(db, "SELECT * FROM portfolios WHERE user_id = ? ORDER BY sort_order", [userId]);
    return c.json(items, 201);
  });

  r.put("/:id/default", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    await run(db, "UPDATE portfolios SET is_default=0 WHERE user_id=?", [userId]);
    await run(db, "UPDATE portfolios SET is_default=1 WHERE id=? AND user_id=?", [id, userId]);
    return c.json({ ok: true });
  });

  r.put("/:id/content", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const portfolio = await queryOne(db, "SELECT id FROM portfolios WHERE id=? AND user_id=?", [id, userId]);
    if (!portfolio) return c.json({ error: "not found" }, 404);
    const body = contentSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const content = await setContent(db, id, userId, body.data);
    return c.json({ ok: true, content });
  });

  r.get("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const portfolio = await queryOne(db, "SELECT * FROM portfolios WHERE id=? AND user_id=?", [id, userId]);
    if (!portfolio) return c.json({ error: "not found" }, 404);
    return c.json({ ...portfolio, content: await getContentIds(db, id) });
  });

  r.put("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = portfolioSchema.partial().safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const cols = Object.keys(body.data);
    if (cols.length === 0) return c.json({ ok: true });
    if (body.data.resume_id) {
      const owned = await queryOne(db, "SELECT id FROM resumes WHERE id = ? AND user_id = ?", [
        body.data.resume_id,
        userId,
      ]);
      if (!owned) return c.json({ error: "resume not found" }, 404);
    }
    if (body.data.is_default === 1) {
      await run(db, "UPDATE portfolios SET is_default=0 WHERE user_id=?", [userId]);
    }
    const sets = cols.map((col) => `${col}=?`).join(", ");
    await run(db, `UPDATE portfolios SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`, [
      ...Object.values(body.data) as SqlValue[], id, userId,
    ]);
    return c.json({ ok: true });
  });

  /** Generate (or replace) an unguessable link for viewing this portfolio, regardless of is_public. */
  r.post("/:id/access-token", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const portfolio = await queryOne(db, "SELECT id FROM portfolios WHERE id=? AND user_id=?", [id, userId]);
    if (!portfolio) return c.json({ error: "not found" }, 404);
    const token = nanoid(16);
    await run(db, "UPDATE portfolios SET access_token=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?", [
      token, id, userId,
    ]);
    return c.json({ access_token: token });
  });

  /** Revoke the private link — the old token stops working immediately. */
  r.delete("/:id/access-token", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    await run(db, "UPDATE portfolios SET access_token=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?", [
      id, userId,
    ]);
    return c.json({ ok: true });
  });

  r.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    // Delete resumes seeded from this portfolio so public /r links cannot orphan
    // under Free (portfolio recreate + new resume) after ON DELETE SET NULL.
    await run(db, "DELETE FROM resumes WHERE portfolio_id=? AND user_id=?", [id, userId]);
    await run(db, "DELETE FROM portfolios WHERE id=? AND user_id=?", [id, userId]);
    return c.body(null, 204);
  });

  return r;
}
