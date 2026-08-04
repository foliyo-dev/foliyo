import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { resolveCorePublicDir } from "../assets.js";
import type { Config } from "../config.js";
import type { FoliyoDb } from "../db.js";
import {
  getDefaultPublicPortfolio,
  getPublicPortfolioBySlug,
  getUserByHandle,
  loadPortfolioContent,
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

  r.get("/r/:token", (c) => {
    const resume = db.prepare(
      "SELECT * FROM resumes WHERE share_token = ? AND is_public = 1",
    ).get(c.req.param("token")) as
      | {
        id: string;
        name: string;
        theme_slug: string;
        portfolio_id: string;
        view_count: number;
      }
      | undefined;

    if (!resume) {
      return c.html(renderNotFound("Resume not found or private.", config.dashboardUrl), 404);
    }

    const data = loadPortfolioContent(db, resume.portfolio_id);
    if (!data) {
      return c.html(renderNotFound("Resume portfolio not found.", config.dashboardUrl), 404);
    }

    db.prepare("UPDATE resumes SET view_count = view_count + 1 WHERE id = ?").run(resume.id);

    return c.html(
      renderResumeHtml(
        data,
        { name: resume.name, theme_slug: resume.theme_slug },
        config,
      ),
    );
  });

  r.get("/u/:handle/:slug", (c) => {
    const { handle, slug } = c.req.param();
    const user = getUserByHandle(db, handle);
    if (!user) return c.html(renderNotFound("User not found.", config.dashboardUrl), 404);
    const data = getPublicPortfolioBySlug(db, user.id, slug);
    if (!data) return c.html(renderNotFound("Portfolio not found or private.", config.dashboardUrl), 404);
    return c.html(renderPortfolioPage(data, config));
  });

  r.get("/u/:handle", (c) => {
    const user = getUserByHandle(db, c.req.param("handle"));
    if (!user) return c.html(renderNotFound("User not found.", config.dashboardUrl), 404);
    const data = getDefaultPublicPortfolio(db, user.id);
    if (!data) {
      return c.html(renderNotFound(
        "No public default portfolio for this user. Mark a portfolio as public and default in the dashboard.",
        config.dashboardUrl,
      ), 404);
    }
    return c.html(renderPortfolioPage(data, config));
  });

  r.get("/", (c) => {
    const data = getDefaultPublicPortfolio(db);
    if (!data) return c.redirect("/welcome");
    return c.html(renderPortfolioPage(data, config));
  });

  const reserved = new Set(["welcome", "api", "mesh", "static", "u", "r"]);
  r.get("/:slug", (c) => {
    const slug = c.req.param("slug");
    if (reserved.has(slug)) return c.notFound();
    const row = db.prepare(
      "SELECT user_id FROM portfolios WHERE slug = ? AND is_public = 1 LIMIT 1",
    ).get(slug) as { user_id: string } | undefined;
    if (!row) return c.html(renderNotFound("Portfolio not found or private.", config.dashboardUrl), 404);
    const data = getPublicPortfolioBySlug(db, row.user_id, slug);
    if (!data) return c.html(renderNotFound("Portfolio not found.", config.dashboardUrl), 404);
    return c.html(renderPortfolioPage(data, config));
  });

  return r;
}
