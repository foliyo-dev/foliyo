import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveCoreTemplatesDir } from "../assets.js";
import type { Config } from "../config.js";
import { queryAll, queryOne, type FoliyoDb } from "../db.js";
import { renderPortfolioHtml } from "./themes.js";

export type PublicPortfolio = {
  portfolio: Record<string, unknown>;
  profile: Record<string, unknown>;
  skills: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  experience: Record<string, unknown>[];
  education: Record<string, unknown>[];
  certifications: Record<string, unknown>[];
  languages: Record<string, unknown>[];
  social_links: Record<string, unknown>[];
  handle: string;
  /** Stored user plan (`free` | `pro` | …). Branding uses effective plan + expiry + config.mode. */
  plan: string;
  plan_expires?: string | null;
};

function handleFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "user";
  return local.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "user";
}

/** Ensure every user has a handle (for /u/:handle URLs). */
export function ensureHandles(db: FoliyoDb): void {
  const users = queryAll<{ id: string; email: string; handle: string | null }>(
    db, "SELECT id, email, handle FROM users WHERE handle IS NULL OR handle = ''",
  );
  for (const u of users) {
    let handle = handleFromEmail(u.email);
    let n = 0;
    while (queryOne(db, "SELECT id FROM users WHERE handle = ? AND id != ?", [handle, u.id])) {
      n += 1;
      handle = `${handleFromEmail(u.email)}${n}`;
    }
    db.prepare("UPDATE users SET handle = ? WHERE id = ?").run(handle, u.id);
  }
}

export function getUserByHandle(db: FoliyoDb, handle: string) {
  return queryOne<{ id: string; handle: string; email: string }>(
    db, "SELECT id, handle, email FROM users WHERE handle = ?", [handle],
  );
}

export function loadPortfolioContent(db: FoliyoDb, portfolioId: string): PublicPortfolio | null {
  const portfolio = queryOne(db, "SELECT * FROM portfolios WHERE id = ?", [portfolioId]);
  if (!portfolio) return null;

  const userId = portfolio.user_id as string;
  const profile = queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
  const user = queryOne<{ handle: string; plan: string; plan_expires: string | null }>(
    db,
    "SELECT handle, plan, plan_expires FROM users WHERE id = ?",
    [userId],
  );

  const skillIds = queryAll<{ skill_id: string }>(
    db, "SELECT skill_id FROM portfolio_skills WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.skill_id);
  const projectIds = queryAll<{ project_id: string }>(
    db, "SELECT project_id FROM portfolio_projects WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.project_id);
  const experienceIds = queryAll<{ experience_id: string }>(
    db, "SELECT experience_id FROM portfolio_experience WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.experience_id);
  const educationIds = queryAll<{ education_id: string }>(
    db, "SELECT education_id FROM portfolio_education WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.education_id);
  const certificationIds = queryAll<{ certification_id: string }>(
    db, "SELECT certification_id FROM portfolio_certifications WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.certification_id);
  const languageIds = queryAll<{ language_id: string }>(
    db, "SELECT language_id FROM portfolio_languages WHERE portfolio_id = ?", [portfolioId],
  ).map((r) => r.language_id);

  const fetchByIds = (table: string, ids: string[]) => {
    if (!ids.length) return [];
    return queryAll(
      db,
      `SELECT * FROM ${table} WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY sort_order`,
      ids,
    );
  };

  return {
    portfolio,
    profile: profile ?? { name: "", headline: "", bio: "" },
    skills: portfolio.show_skills === 1 ? fetchByIds("skills", skillIds) : [],
    projects: portfolio.show_projects === 1 ? fetchByIds("projects", projectIds) : [],
    experience: portfolio.show_experience === 1 ? fetchByIds("experience", experienceIds) : [],
    education: portfolio.show_education === 1 ? fetchByIds("education", educationIds) : [],
    certifications:
      portfolio.show_certifications === 1 ? fetchByIds("certifications", certificationIds) : [],
    languages: portfolio.show_languages === 1 ? fetchByIds("languages", languageIds) : [],
    social_links: queryAll(
      db,
      "SELECT * FROM social_links WHERE user_id = ? ORDER BY sort_order, provider",
      [userId],
    ),
    handle: user?.handle ?? "",
    plan: user?.plan ?? "free",
    plan_expires: user?.plan_expires ?? null,
  };
}

export function getDefaultPublicPortfolio(db: FoliyoDb, userId?: string): PublicPortfolio | null {
  const portfolio = userId
    ? queryOne(
      db,
      "SELECT * FROM portfolios WHERE user_id = ? AND is_default = 1 AND is_public = 1",
      [userId],
    )
    : queryOne(db, "SELECT * FROM portfolios WHERE is_default = 1 AND is_public = 1 LIMIT 1");
  if (!portfolio) return null;
  return loadPortfolioContent(db, portfolio.id as string);
}

export function getPublicPortfolioBySlug(
  db: FoliyoDb,
  userId: string,
  slug: string,
): PublicPortfolio | null {
  const portfolio = queryOne(
    db,
    "SELECT * FROM portfolios WHERE user_id = ? AND slug = ? AND is_public = 1",
    [userId, slug],
  );
  if (!portfolio) return null;
  return loadPortfolioContent(db, portfolio.id as string);
}

/**
 * Synthetic portfolio from the user's full content library (no portfolio required).
 * Used by the dashboard live preview pane.
 */
export function loadLibraryPreview(
  db: FoliyoDb,
  userId: string,
  themeOverride?: string,
): PublicPortfolio | null {
  const user = queryOne<{ handle: string | null; plan: string; plan_expires: string | null }>(
    db,
    "SELECT handle, plan, plan_expires FROM users WHERE id = ?",
    [userId],
  );
  if (!user) return null;

  const profile = queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
  const settings = queryOne<{ theme_slug: string }>(
    db,
    "SELECT theme_slug FROM settings WHERE user_id = ?",
    [userId],
  );

  const themeSlug = themeOverride || settings?.theme_slug || "minimal";

  return {
    portfolio: {
      id: "library-preview",
      user_id: userId,
      name: "Library preview",
      slug: "preview",
      description: "",
      headline: "",
      bio: "",
      theme_slug: themeSlug,
      is_public: 1,
      is_default: 1,
      show_skills: 1,
      show_projects: 1,
      show_experience: 1,
      show_education: 1,
      show_certifications: 1,
      show_languages: 1,
    },
    profile: profile ?? { name: "", headline: "", bio: "" },
    skills: queryAll(db, "SELECT * FROM skills WHERE user_id = ? ORDER BY sort_order, name", [
      userId,
    ]),
    projects: queryAll(db, "SELECT * FROM projects WHERE user_id = ? ORDER BY sort_order, title", [
      userId,
    ]),
    experience: queryAll(db, "SELECT * FROM experience WHERE user_id = ? ORDER BY sort_order", [
      userId,
    ]),
    education: queryAll(db, "SELECT * FROM education WHERE user_id = ? ORDER BY sort_order", [
      userId,
    ]),
    certifications: queryAll(
      db,
      "SELECT * FROM certifications WHERE user_id = ? ORDER BY sort_order",
      [userId],
    ),
    languages: queryAll(db, "SELECT * FROM languages WHERE user_id = ? ORDER BY sort_order", [
      userId,
    ]),
    social_links: queryAll(
      db,
      "SELECT * FROM social_links WHERE user_id = ? ORDER BY sort_order, provider",
      [userId],
    ),
    handle: user.handle ?? "",
    plan: user.plan ?? "free",
    plan_expires: user.plan_expires ?? null,
  };
}

export function renderWelcome(config: Config): string {
  const path = join(resolveCoreTemplatesDir(import.meta.url), "welcome.html");
  let html = readFileSync(path, "utf8");
  html = html.replaceAll("{{.DashboardURL}}", config.dashboardUrl);
  html = html.replaceAll("{{.Title}}", "Welcome to Foliyo");
  return html;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPortfolioPage(data: PublicPortfolio, config: Config): string {
  return renderPortfolioHtml(data, config);
}

export function renderNotFound(message: string, dashboardUrl: string): string {
  return `<!DOCTYPE html><html><head><title>Not found</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: "IBM Plex Sans", system-ui, sans-serif; margin: 0; padding: 3rem 1.5rem; text-align: center; color: #1c1917; background: #fafaf9; }
    a { color: #0f766e; }
  </style>
  </head><body>
    <h1>404</h1><p>${esc(message)}</p><p><a href="/welcome">Welcome page</a> · <a href="${esc(dashboardUrl)}">Dashboard</a></p>
  </body></html>`;
}
