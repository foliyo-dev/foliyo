import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { resolveCorePublicDir } from "../assets.js";
import type { Config } from "../config.js";
import { queryOne, run, type FoliyoDb } from "../db.js";
import {
  getDefaultPublicPortfolio,
  getPublicPortfolioBySlug,
  getUserByHandle,
  loadResumeContent,
  renderNotFound,
  renderPortfolioPage,
  renderWelcome,
} from "../public/pages.js";
import { renderResumeHtml } from "../public/themes.js";

export function publicRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono();

  r.get("/static/*", serveStatic({ root: resolveCorePublicDir(import.meta.url) }));

  r.get("/spec", (c) => c.redirect("/static/spec/index.html"));
  r.get("/spec/", (c) => c.redirect("/static/spec/index.html"));

  r.get("/welcome", (c) => c.html(renderWelcome(config)));

  r.get("/r/:token", async (c) => {
    const resume = await queryOne<{
      id: string;
      name: string;
      theme_slug: string;
      portfolio_id: string | null;
      view_count: number;
    }>(db, "SELECT * FROM resumes WHERE share_token = ? AND is_public = 1", [c.req.param("token")]);

    if (!resume) {
      return c.html(renderNotFound("Resume not found or private.", config.dashboardUrl), 404);
    }

    const data = await loadResumeContent(db, resume.id);
    if (!data) {
      return c.html(renderNotFound("Resume content not found.", config.dashboardUrl), 404);
    }

    await run(db, "UPDATE resumes SET view_count = view_count + 1 WHERE id = ?", [resume.id]);

    return c.html(
      renderResumeHtml(
        data,
        { name: resume.name, theme_slug: resume.theme_slug },
        config,
      ),
    );
  });

  r.get("/u/:handle/:slug", async (c) => {
    const { handle, slug } = c.req.param();
    const user = await getUserByHandle(db, handle);
    if (!user) return c.html(renderNotFound("User not found.", config.dashboardUrl), 404);
    const data = await getPublicPortfolioBySlug(db, user.id, slug);
    if (!data) return c.html(renderNotFound("Portfolio not found or private.", config.dashboardUrl), 404);
    return c.html(renderPortfolioPage(data, config));
  });

  r.get("/u/:handle", async (c) => {
    const user = await getUserByHandle(db, c.req.param("handle"));
    if (!user) return c.html(renderNotFound("User not found.", config.dashboardUrl), 404);
    const data = await getDefaultPublicPortfolio(db, user.id);
    if (!data) {
      return c.html(renderNotFound(
        "No public default portfolio for this user. Mark a portfolio as public and default in the dashboard.",
        config.dashboardUrl,
      ), 404);
    }
    return c.html(renderPortfolioPage(data, config));
  });

  r.get("/", async (c) => {
    const data = await getDefaultPublicPortfolio(db);
    if (!data) return c.redirect("/welcome");
    return c.html(renderPortfolioPage(data, config));
  });

  const reserved = new Set(["welcome", "api", "mesh", "static", "u", "r"]);
  r.get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (reserved.has(slug)) return c.notFound();
    const row = await queryOne<{ user_id: string }>(
      db,
      "SELECT user_id FROM portfolios WHERE slug = ? AND is_public = 1 LIMIT 1",
      [slug],
    );
    if (!row) return c.html(renderNotFound("Portfolio not found or private.", config.dashboardUrl), 404);
    const data = await getPublicPortfolioBySlug(db, row.user_id, slug);
    if (!data) return c.html(renderNotFound("Portfolio not found.", config.dashboardUrl), 404);
    return c.html(renderPortfolioPage(data, config));
  });

  return r;
}
