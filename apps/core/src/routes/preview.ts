import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import { queryOne, type FoliyoDb } from "../db.js";
import {
  loadLibraryPreview,
  loadPortfolioContent,
  loadPortfolioDraftPreview,
  loadResumeContent,
} from "../public/pages.js";
import { renderPortfolioHtml, renderResumeHtml } from "../public/themes.js";

const PORTFOLIO_THEME_SLUGS = new Set([
  "minimal",
  "modern",
  "creative",
  "noir",
  "atelier",
  "editorial",
]);

const draftSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  headline: z.string().optional(),
  bio: z.string().optional(),
  theme_slug: z.string().optional(),
  show_skills: z.number().int().min(0).max(1).optional(),
  show_projects: z.number().int().min(0).max(1).optional(),
  show_experience: z.number().int().min(0).max(1).optional(),
  show_education: z.number().int().min(0).max(1).optional(),
  show_certifications: z.number().int().min(0).max(1).optional(),
  show_languages: z.number().int().min(0).max(1).optional(),
  skills_title: z.string().max(40).optional(),
  projects_title: z.string().max(40).optional(),
  experience_title: z.string().max(40).optional(),
  education_title: z.string().max(40).optional(),
  certifications_title: z.string().max(40).optional(),
  languages_title: z.string().max(40).optional(),
  skill_ids: z.array(z.string()).optional(),
  project_ids: z.array(z.string()).optional(),
  experience_ids: z.array(z.string()).optional(),
  education_ids: z.array(z.string()).optional(),
  certification_ids: z.array(z.string()).optional(),
  language_ids: z.array(z.string()).optional(),
});

const resumeDraftSchema = z.object({
  headline: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  theme_slug: z.string().optional(),
});

/** Authenticated HTML previews (owner only — not public share links). */
export function previewRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();

  r.get("/library", async (c) => {
    const userId = c.get("userId");
    const themeParam = (c.req.query("theme") ?? "").trim().toLowerCase();
    const themeOverride = PORTFOLIO_THEME_SLUGS.has(themeParam) ? themeParam : undefined;

    const data = await loadLibraryPreview(db, userId, themeOverride);
    if (!data) return c.json({ error: "not found" }, 404);

    const html = renderPortfolioHtml(data, config);
    return c.html(html);
  });

  /**
   * Private portfolio preview for the logged-in owner (works for private folios too).
   */
  r.get("/portfolio/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const owned = await queryOne(db, "SELECT id FROM portfolios WHERE id = ? AND user_id = ?", [
      id,
      userId,
    ]);
    if (!owned) return c.json({ error: "not found" }, 404);

    const data = await loadPortfolioContent(db, id);
    if (!data) return c.json({ error: "not found" }, 404);

    return c.html(renderPortfolioHtml(data, config));
  });

  /**
   * Draft portfolio preview from unsaved form state (create / live edit before save).
   */
  r.post("/portfolio/draft", async (c) => {
    const userId = c.get("userId");
    const body = draftSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body", details: body.error.flatten() }, 400);

    const theme = String(body.data.theme_slug ?? "minimal").trim().toLowerCase();
    const data = await loadPortfolioDraftPreview(db, userId, {
      ...body.data,
      theme_slug: PORTFOLIO_THEME_SLUGS.has(theme) ? theme : "minimal",
    });
    if (!data) return c.json({ error: "not found" }, 404);

    return c.html(renderPortfolioHtml(data, config));
  });

  /**
   * Private resume preview for the logged-in owner.
   * Free on all plans — PDF/print export remains Pro-gated via /resumes/:id/export.
   */
  r.get("/resume/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const resume = await queryOne<{
      id: string;
      name: string;
      theme_slug: string;
      portfolio_id: string;
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
    return c.html(html);
  });

  /**
   * Draft resume preview — unsaved headline / summary / theme from the edit form.
   */
  r.post("/resume/:id/draft", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = resumeDraftSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body", details: body.error.flatten() }, 400);

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

    const draftHeadline = String(body.data.headline ?? "").trim();
    const draftBio = String(body.data.bio ?? "").trim();
    const folio = resume.portfolio_id
      ? await queryOne<{ headline: string | null; bio: string | null }>(
          db,
          "SELECT headline, bio FROM portfolios WHERE id = ? AND user_id = ?",
          [resume.portfolio_id, userId],
        )
      : null;
    const profile = data.profile as { headline?: string | null; bio?: string | null };
    const mergedHeadline =
      draftHeadline ||
      String(folio?.headline ?? "").trim() ||
      String(profile.headline ?? "").trim();
    const mergedBio =
      draftBio ||
      String(folio?.bio ?? "").trim() ||
      String(profile.bio ?? "").trim();
    const portfolio = data.portfolio as Record<string, unknown>;

    const html = renderResumeHtml(
      {
        ...data,
        portfolio: {
          ...portfolio,
          headline: mergedHeadline,
          bio: mergedBio,
        },
      },
      {
        name: resume.name,
        theme_slug: body.data.theme_slug?.trim() || resume.theme_slug,
      },
      config,
    );
    return c.html(html);
  });

  return r;
}
