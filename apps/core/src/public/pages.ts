import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "../config.js";
import { queryAll, queryOne, type FoliyoDb } from "../db.js";

export type PublicPortfolio = {
  portfolio: Record<string, unknown>;
  profile: Record<string, unknown>;
  skills: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  experience: Record<string, unknown>[];
  education: Record<string, unknown>[];
  certifications: Record<string, unknown>[];
  languages: Record<string, unknown>[];
  handle: string;
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

function loadPortfolioContent(db: FoliyoDb, portfolioId: string): PublicPortfolio | null {
  const portfolio = queryOne(db, "SELECT * FROM portfolios WHERE id = ?", [portfolioId]);
  if (!portfolio) return null;

  const userId = portfolio.user_id as string;
  const profile = queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
  const user = queryOne<{ handle: string }>(db, "SELECT handle FROM users WHERE id = ?", [userId]);

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
    handle: user?.handle ?? "",
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

export function renderWelcome(config: Config): string {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../templates/welcome.html");
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

export function renderPortfolioPage(data: PublicPortfolio, _config: Config): string {
  const p = data.portfolio;
  const profile = data.profile;
  const name = esc(profile.name || p.name);
  const headline = esc((p.headline as string)?.trim() || profile.headline || "");
  const bio = esc((p.bio as string)?.trim() || profile.bio || "");
  const desc = esc(p.description);
  const avatar = String(profile.avatar_url || "").trim();
  const avatarHtml = avatar
    ? `<img class="avatar" src="${esc(avatar)}" alt="" width="72" height="72" />`
    : "";

  const skillsHtml = data.skills.length
    ? `<section><h2>Skills</h2><ul class="tags">${data.skills.map((s) =>
      `<li>${esc(s.name)} <span class="muted">${esc(s.level)}</span></li>`).join("")}</ul></section>`
    : "";

  const projectsHtml = data.projects.length
    ? `<section><h2>Projects</h2><ul class="cards">${data.projects.map((pr) =>
      `<li><strong>${esc(pr.title)}</strong>${pr.description ? `<p>${esc(pr.description)}</p>` : ""}${pr.url ? `<a href="${esc(pr.url)}">View</a>` : ""}</li>`).join("")}</ul></section>`
    : "";

  const expHtml = data.experience.length
    ? `<section><h2>Experience</h2><ul>${data.experience.map((e) =>
      `<li><strong>${esc(e.role)}</strong> at ${esc(e.company)} <span class="muted">${esc(e.start_date)} – ${e.end_date ? esc(e.end_date) : "Present"}</span></li>`).join("")}</ul></section>`
    : "";

  const eduHtml = data.education.length
    ? `<section><h2>Education</h2><ul>${data.education.map((e) =>
      `<li><strong>${esc(e.institution)}</strong>${e.degree ? ` — ${esc(e.degree)}` : ""}</li>`).join("")}</ul></section>`
    : "";

  const certHtml = data.certifications.length
    ? `<section><h2>Certifications</h2><ul>${data.certifications.map((c) =>
      `<li><strong>${esc(c.name)}</strong>${c.issuer ? ` — ${esc(c.issuer)}` : ""}${
        c.credential_url
          ? ` <a href="${esc(c.credential_url)}" rel="noopener noreferrer">Credential</a>`
          : ""
      }</li>`).join("")}</ul></section>`
    : "";

  const langHtml = data.languages.length
    ? `<section><h2>Languages</h2><ul class="tags">${data.languages.map((l) =>
      `<li>${esc(l.name)} <span class="muted">${esc(l.proficiency)}</span></li>`).join("")}</ul></section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} · Foliyo</title>
  <link rel="icon" href="/static/images/foliyo-icon.svg" type="image/svg+xml">
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 0; color: #1a1a2e; background: #faf9fc; }
    header { padding: 1rem 1.5rem; border-bottom: 1px solid #e4e2ef; background: #fff; display: flex; justify-content: space-between; align-items: center; }
    header a { color: #534ab7; text-decoration: none; font-weight: 500; }
    main { max-width: 48rem; margin: 0 auto; padding: 2rem 1rem; }
    h1 { margin: 0 0 0.25rem; }
    .hero { display: flex; gap: 1rem; align-items: flex-start; }
    .avatar { border-radius: 50%; object-fit: cover; background: #eeedfe; }
    .headline { color: #534ab7; font-weight: 500; margin: 0 0 1rem; }
    .bio, .desc { color: #666; line-height: 1.6; }
    section { margin-top: 2rem; }
    h2 { font-size: 1.125rem; color: #534ab7; border-bottom: 1px solid #e4e2ef; padding-bottom: 0.35rem; }
    ul { padding-left: 1.25rem; }
    .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .tags li { background: #eeedfe; padding: 0.35rem 0.75rem; border-radius: 999px; font-size: 0.875rem; }
    .cards { list-style: none; padding: 0; }
    .cards li { background: #fff; border: 1px solid #e4e2ef; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; }
    .muted { color: #888; font-size: 0.875rem; }
    footer { text-align: center; padding: 2rem; color: #888; font-size: 0.8125rem; }
  </style>
</head>
<body>
  <header>
    <a href="/">Foliyo</a>
    ${data.handle ? `<a href="/u/${esc(data.handle)}">@${esc(data.handle)}</a>` : ""}
  </header>
  <main>
    <div class="hero">
      ${avatarHtml}
      <div>
        <h1>${name}</h1>
        ${headline ? `<p class="headline">${headline}</p>` : ""}
        ${bio ? `<p class="bio">${bio}</p>` : ""}
        ${desc ? `<p class="desc">${desc}</p>` : ""}
      </div>
    </div>
    ${skillsHtml}
    ${projectsHtml}
    ${expHtml}
    ${eduHtml}
    ${certHtml}
    ${langHtml}
  </main>
  <footer>Built with <a href="https://foliyo.dev">Foliyo</a></footer>
</body>
</html>`;
}

export function renderNotFound(message: string, dashboardUrl: string): string {
  return `<!DOCTYPE html><html><head><title>Not found</title></head><body style="font-family:system-ui;padding:2rem;text-align:center">
    <h1>404</h1><p>${esc(message)}</p><p><a href="/welcome">Welcome page</a> · <a href="${esc(dashboardUrl)}">Dashboard</a></p>
  </body></html>`;
}
