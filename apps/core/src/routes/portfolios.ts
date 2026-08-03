import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import { queryAll, queryOne, run, type FoliyoDb } from "../db.js";
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
  sort_order: z.number().int().default(0),
});

const contentSchema = z.object({
  skill_ids: z.array(z.string()).default([]),
  project_ids: z.array(z.string()).default([]),
  experience_ids: z.array(z.string()).default([]),
  education_ids: z.array(z.string()).default([]),
  certification_ids: z.array(z.string()).default([]),
  language_ids: z.array(z.string()).default([]),
});

function getContentIds(db: FoliyoDb, portfolioId: string) {
  const skills = queryAll<{ skill_id: string }>(
    db, "SELECT skill_id FROM portfolio_skills WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.skill_id);
  const projects = queryAll<{ project_id: string }>(
    db, "SELECT project_id FROM portfolio_projects WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.project_id);
  const experience = queryAll<{ experience_id: string }>(
    db, "SELECT experience_id FROM portfolio_experience WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.experience_id);
  const education = queryAll<{ education_id: string }>(
    db, "SELECT education_id FROM portfolio_education WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.education_id);
  const certifications = queryAll<{ certification_id: string }>(
    db, "SELECT certification_id FROM portfolio_certifications WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.certification_id);
  const languages = queryAll<{ language_id: string }>(
    db, "SELECT language_id FROM portfolio_languages WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.language_id);
  return {
    skill_ids: skills,
    project_ids: projects,
    experience_ids: experience,
    education_ids: education,
    certification_ids: certifications,
    language_ids: languages,
  };
}

function setContent(db: FoliyoDb, portfolioId: string, content: z.infer<typeof contentSchema>) {
  db.exec("BEGIN");
  try {
    run(db, "DELETE FROM portfolio_skills WHERE portfolio_id = ?", [portfolioId]);
    run(db, "DELETE FROM portfolio_projects WHERE portfolio_id = ?", [portfolioId]);
    run(db, "DELETE FROM portfolio_experience WHERE portfolio_id = ?", [portfolioId]);
    run(db, "DELETE FROM portfolio_education WHERE portfolio_id = ?", [portfolioId]);
    run(db, "DELETE FROM portfolio_certifications WHERE portfolio_id = ?", [portfolioId]);
    run(db, "DELETE FROM portfolio_languages WHERE portfolio_id = ?", [portfolioId]);
    for (const skillId of content.skill_ids) {
      run(db, "INSERT INTO portfolio_skills (portfolio_id, skill_id) VALUES (?, ?)", [portfolioId, skillId]);
    }
    for (const projectId of content.project_ids) {
      run(db, "INSERT INTO portfolio_projects (portfolio_id, project_id) VALUES (?, ?)", [portfolioId, projectId]);
    }
    for (const experienceId of content.experience_ids) {
      run(db, "INSERT INTO portfolio_experience (portfolio_id, experience_id) VALUES (?, ?)", [portfolioId, experienceId]);
    }
    for (const educationId of content.education_ids) {
      run(db, "INSERT INTO portfolio_education (portfolio_id, education_id) VALUES (?, ?)", [portfolioId, educationId]);
    }
    for (const certificationId of content.certification_ids) {
      run(db, "INSERT INTO portfolio_certifications (portfolio_id, certification_id) VALUES (?, ?)", [
        portfolioId,
        certificationId,
      ]);
    }
    for (const languageId of content.language_ids) {
      run(db, "INSERT INTO portfolio_languages (portfolio_id, language_id) VALUES (?, ?)", [
        portfolioId,
        languageId,
      ]);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function portfoliosRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();

  r.get("/", (c) => {
    const userId = c.get("userId");
    const items = queryAll(db, "SELECT * FROM portfolios WHERE user_id = ? ORDER BY sort_order", [userId]);
    return c.json(items);
  });

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const plan = getEffectiveUserPlan(db, userId, config);
    if (!isProPlan(plan)) {
      const existing = queryAll(db, "SELECT id FROM portfolios WHERE user_id = ?", [userId]);
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
    const existingCount = queryAll(db, "SELECT id FROM portfolios WHERE user_id = ?", [userId]).length;
    const isDefault = d.is_default || existingCount === 0 ? 1 : d.is_default;

    if (isDefault) {
      run(db, "UPDATE portfolios SET is_default=0 WHERE user_id=?", [userId]);
    }

    run(
      db,
      `INSERT INTO portfolios (user_id, name, slug, description, headline, bio, theme_slug, is_public, is_default,
       show_skills, show_projects, show_experience, show_education, show_certifications, show_languages, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId, d.name, d.slug, d.description, d.headline, d.bio, d.theme_slug, d.is_public, isDefault,
        d.show_skills, d.show_projects, d.show_experience, d.show_education, d.show_certifications,
        d.show_languages, d.sort_order,
      ],
    );
    const items = queryAll(db, "SELECT * FROM portfolios WHERE user_id = ? ORDER BY sort_order", [userId]);
    return c.json(items, 201);
  });

  r.put("/:id/default", (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    run(db, "UPDATE portfolios SET is_default=0 WHERE user_id=?", [userId]);
    run(db, "UPDATE portfolios SET is_default=1 WHERE id=? AND user_id=?", [id, userId]);
    return c.json({ ok: true });
  });

  r.put("/:id/content", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const portfolio = queryOne(db, "SELECT id FROM portfolios WHERE id=? AND user_id=?", [id, userId]);
    if (!portfolio) return c.json({ error: "not found" }, 404);
    const body = contentSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    setContent(db, id, body.data);
    return c.json({ ok: true, content: body.data });
  });

  r.get("/:id", (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const portfolio = queryOne(db, "SELECT * FROM portfolios WHERE id=? AND user_id=?", [id, userId]);
    if (!portfolio) return c.json({ error: "not found" }, 404);
    return c.json({ ...portfolio, content: getContentIds(db, id) });
  });

  r.put("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = portfolioSchema.partial().safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const cols = Object.keys(body.data);
    if (cols.length === 0) return c.json({ ok: true });
    if (body.data.is_default === 1) {
      run(db, "UPDATE portfolios SET is_default=0 WHERE user_id=?", [userId]);
    }
    const sets = cols.map((col) => `${col}=?`).join(", ");
    run(db, `UPDATE portfolios SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`, [
      ...Object.values(body.data), id, userId,
    ]);
    return c.json({ ok: true });
  });

  r.delete("/:id", (c) => {
    const userId = c.get("userId");
    run(db, "DELETE FROM portfolios WHERE id=? AND user_id=?", [c.req.param("id"), userId]);
    return c.body(null, 204);
  });

  return r;
}
