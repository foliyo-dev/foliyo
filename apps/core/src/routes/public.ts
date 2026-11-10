import { basename } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { resolveCorePublicDir } from "../assets.js";
import type { Config } from "../config.js";
import { queryAll, queryOne, run, type FoliyoDb } from "../db.js";
import {
  getDefaultPublicPortfolio,
  getPublicPortfolioBySlug,
  getPublicPortfolioByToken,
  getUserByHandle,
  loadResumeContent,
  renderNotFound,
  renderPortfolioPage,
  renderWelcome,
} from "../public/pages.js";
import { renderBlogListHtml, renderBlogPostHtml, renderResumeHtml } from "../public/themes.js";
import { getStorage, parseUploadKey } from "../storage/index.js";

export function publicRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono();

  r.get("/static/*", serveStatic({ root: resolveCorePublicDir(import.meta.url) }));

  r.get("/uploads/:file", async (c) => {
    const file = basename(c.req.param("file"));
    const key = parseUploadKey(file);
    if (!key) return c.notFound();
    const obj = await getStorage(config).get(key);
    if (!obj) return c.notFound();
    return new Response(new Uint8Array(obj.bytes), {
      headers: {
        "Content-Type": obj.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });

  r.get("/spec", (c) => c.redirect("/static/spec/index.html"));
  r.get("/spec/", (c) => c.redirect("/static/spec/index.html"));

  r.get("/welcome", (c) => c.html(renderWelcome(config)));

  // OSS: site root is the default portfolio; dashboard lives on FOLIYO_DASHBOARD_URL.
  // Cloud keeps a separate marketing landing. Bridge common auth entry paths.
  const dash = config.dashboardUrl.replace(/\/$/, "");
  for (const path of ["/login", "/signup", "/forgot", "/reset", "/check-email", "/verify"] as const) {
    r.get(path, (c) => {
      const q = new URL(c.req.url).search;
      return c.redirect(`${dash}${path}${q}`);
    });
  }

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

  r.get("/p/:token", async (c) => {
    const data = await getPublicPortfolioByToken(db, c.req.param("token"));
    if (!data) return c.html(renderNotFound("Portfolio not found.", config.dashboardUrl), 404);
    return c.html(renderPortfolioPage(data, config));
  });

  // Blog routes must register before /u/:handle/:slug so "blog" is never a portfolio slug.
  r.get("/u/:handle/blog/:postSlug", async (c) => {
    const handle = c.req.param("handle");
    const postSlug = c.req.param("postSlug");
    const user = await getUserByHandle(db, handle);
    if (!user) return c.html(renderNotFound("User not found.", config.dashboardUrl), 404);

    const post = await queryOne<{
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      cover_image: string;
      published_at: string | null;
      tags: string;
    }>(
      db,
      `SELECT title, slug, excerpt, content, cover_image, published_at, tags FROM blog_posts
       WHERE user_id = ? AND slug = ? AND status = 'published'`,
      [user.id, postSlug],
    );
    if (!post) return c.html(renderNotFound("Post not found.", config.dashboardUrl), 404);

    const profile = await queryOne<{ name: string | null }>(
      db,
      "SELECT name FROM profile WHERE user_id = ?",
      [user.id],
    );
    const planRow = await queryOne<{ plan: string; plan_expires: string | null }>(
      db,
      "SELECT plan, plan_expires FROM users WHERE id = ?",
      [user.id],
    );

    const portfolio = await getDefaultPublicPortfolio(db, user.id);

    return c.html(
      renderBlogPostHtml(
        {
          handle: user.handle,
          authorName: profile?.name?.trim() || user.handle,
          plan: planRow?.plan ?? "free",
          plan_expires: planRow?.plan_expires ?? null,
          post,
        },
        config,
        portfolio,
      ),
    );
  });

  r.get("/u/:handle/blog", async (c) => {
    const handle = c.req.param("handle");
    const user = await getUserByHandle(db, handle);
    if (!user) return c.html(renderNotFound("User not found.", config.dashboardUrl), 404);

    const posts = await queryAll<{
      title: string;
      slug: string;
      excerpt: string;
      cover_image: string;
      published_at: string | null;
    }>(
      db,
      `SELECT title, slug, excerpt, cover_image, published_at FROM blog_posts
       WHERE user_id = ? AND status = 'published'
       ORDER BY published_at DESC, created_at DESC`,
      [user.id],
    );

    const profile = await queryOne<{ name: string | null }>(
      db,
      "SELECT name FROM profile WHERE user_id = ?",
      [user.id],
    );
    const planRow = await queryOne<{ plan: string; plan_expires: string | null }>(
      db,
      "SELECT plan, plan_expires FROM users WHERE id = ?",
      [user.id],
    );

    const portfolio = await getDefaultPublicPortfolio(db, user.id);

    return c.html(
      renderBlogListHtml(
        {
          handle: user.handle,
          authorName: profile?.name?.trim() || user.handle,
          plan: planRow?.plan ?? "free",
          plan_expires: planRow?.plan_expires ?? null,
          posts,
        },
        config,
        portfolio,
      ),
    );
  });

  r.get("/u/:handle/:slug", async (c) => {
    const { handle, slug } = c.req.param();
    if (slug === "blog") {
      return c.redirect(`/u/${encodeURIComponent(handle)}/blog`, 301);
    }
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

  // Self-host (single): site root is the default public portfolio.
  // Cloud (multi): marketing lives on FOLIYO_SITE_URL — never pick a random SaaS folio.
  r.get("/", async (c) => {
    if (config.mode === "multi") {
      const site = config.siteUrl.replace(/\/$/, "");
      if (!site) return c.redirect("/welcome");
      try {
        const here = new URL(c.req.url);
        const dest = new URL(site);
        if (here.origin === dest.origin) return c.redirect("/welcome");
      } catch {
        /* invalid siteUrl — still try redirect below */
      }
      return c.redirect(site);
    }
    const data = await getDefaultPublicPortfolio(db);
    if (!data) return c.redirect("/welcome");
    return c.html(renderPortfolioPage(data, config));
  });

  const reserved = new Set([
    "welcome",
    "login",
    "signup",
    "forgot",
    "reset",
    "check-email",
    "verify",
    "api",
    "mesh",
    "static",
    "u",
    "r",
    "p",
    "uploads",
  ]);
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
