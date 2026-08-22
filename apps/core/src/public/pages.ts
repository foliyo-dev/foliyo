import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveCoreTemplatesDir } from "../assets.js";
import type { Config } from "../config.js";
import { queryAll, queryOne, run, type FoliyoDb } from "../db.js";
import {
  fetchJunctionLibraryRows,
  fetchRowsInIdOrder,
  orderRowsByIds,
  orderedJunctionIds,
  sortIdsByLibraryOrder,
} from "../content-order.js";
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
  /** share_token of the linked resume, only set when that resume is public (renders a "Download resume" button). */
  download_resume_token?: string | null;
};

function handleFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "user";
  return local.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "user";
}

async function fetchSkillsForParent(
  db: FoliyoDb,
  junctionTable: string,
  parentColumn: string,
  parentId: string,
): Promise<Record<string, unknown>[]> {
  const ids = await orderedJunctionIds(
    db,
    junctionTable,
    parentColumn,
    parentId,
    "skill_id",
    "skills",
    false,
  );
  let skills = await fetchRowsInIdOrder(db, "skills", ids);
  return skills.filter(
    (s) =>
      (s.status as string | undefined) !== "pending" &&
      (s.status as string | undefined) !== "dismissed",
  );
}

async function fetchSimpleJunctionRows(
  db: FoliyoDb,
  junctionTable: string,
  parentColumn: string,
  parentId: string,
  itemColumn: string,
  libraryTable: string,
): Promise<Record<string, unknown>[]> {
  const ids = await orderedJunctionIds(
    db,
    junctionTable,
    parentColumn,
    parentId,
    itemColumn,
    libraryTable,
    false,
  );
  return fetchRowsInIdOrder(db, libraryTable, ids);
}

/** Ensure every user has a handle (for /u/:handle URLs). */
export async function ensureHandles(db: FoliyoDb): Promise<void> {
  const users = await queryAll<{ id: string; email: string; handle: string | null }>(
    db, "SELECT id, email, handle FROM users WHERE handle IS NULL OR handle = ''",
  );
  for (const u of users) {
    let handle = handleFromEmail(u.email);
    let n = 0;
    while (await queryOne(db, "SELECT id FROM users WHERE handle = ? AND id != ?", [handle, u.id])) {
      n += 1;
      handle = `${handleFromEmail(u.email)}${n}`;
    }
    await run(db, "UPDATE users SET handle = ? WHERE id = ?", [handle, u.id]);
  }
}

export async function getUserByHandle(db: FoliyoDb, handle: string) {
  return queryOne<{ id: string; handle: string; email: string }>(
    db, "SELECT id, handle, email FROM users WHERE handle = ?", [handle],
  );
}

export async function loadPortfolioContent(db: FoliyoDb, portfolioId: string): Promise<PublicPortfolio | null> {
  const portfolio = await queryOne(db, "SELECT * FROM portfolios WHERE id = ?", [portfolioId]);
  if (!portfolio) return null;

  const userId = portfolio.user_id as string;
  const profile = await queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
  const user = await queryOne<{ handle: string; plan: string; plan_expires: string | null }>(
    db,
    "SELECT handle, plan, plan_expires FROM users WHERE id = ?",
    [userId],
  );

  const skills =
    portfolio.show_skills === 1
      ? await fetchSkillsForParent(db, "portfolio_skills", "portfolio_id", portfolioId)
      : [];

  let downloadResumeToken: string | null = null;
  const resumeId = portfolio.resume_id as string | null | undefined;
  if (resumeId) {
    const linked = await queryOne<{ share_token: string; is_public: number }>(
      db,
      "SELECT share_token, is_public FROM resumes WHERE id = ? AND user_id = ?",
      [resumeId, userId],
    );
    if (linked && linked.is_public === 1) downloadResumeToken = linked.share_token;
  }

  return {
    portfolio,
    profile: profile ?? { name: "", headline: "", bio: "" },
    download_resume_token: downloadResumeToken,
    skills,
    projects:
      portfolio.show_projects === 1
        ? await fetchJunctionLibraryRows(db, {
            junctionTable: "portfolio_projects",
            parentColumn: "portfolio_id",
            parentId: portfolioId,
            itemColumn: "project_id",
            libraryTable: "projects",
            junctionSort: true,
          })
        : [],
    experience:
      portfolio.show_experience === 1
        ? await fetchJunctionLibraryRows(db, {
            junctionTable: "portfolio_experience",
            parentColumn: "portfolio_id",
            parentId: portfolioId,
            itemColumn: "experience_id",
            libraryTable: "experience",
            junctionSort: true,
          })
        : [],
    education:
      portfolio.show_education === 1
        ? await fetchJunctionLibraryRows(db, {
            junctionTable: "portfolio_education",
            parentColumn: "portfolio_id",
            parentId: portfolioId,
            itemColumn: "education_id",
            libraryTable: "education",
            junctionSort: true,
          })
        : [],
    certifications:
      portfolio.show_certifications === 1
        ? await fetchSimpleJunctionRows(
            db,
            "portfolio_certifications",
            "portfolio_id",
            portfolioId,
            "certification_id",
            "certifications",
          )
        : [],
    languages:
      portfolio.show_languages === 1
        ? await fetchSimpleJunctionRows(
            db,
            "portfolio_languages",
            "portfolio_id",
            portfolioId,
            "language_id",
            "languages",
          )
        : [],
    social_links: await queryAll(
      db,
      "SELECT * FROM social_links WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, provider",
      [userId],
    ),
    handle: user?.handle ?? "",
    plan: user?.plan ?? "free",
    plan_expires: user?.plan_expires ?? null,
  };
}

/**
 * Load a resume's own content snapshot for preview / public / export.
 * Uses resume_* junctions; portfolio_id is only for optional headline/bio overrides.
 */
export async function loadResumeContent(db: FoliyoDb, resumeId: string): Promise<PublicPortfolio | null> {
  const resume = await queryOne<{
    id: string;
    user_id: string;
    name: string;
    theme_slug: string;
    portfolio_id: string | null;
    headline: string | null;
    bio: string | null;
  }>(db, "SELECT * FROM resumes WHERE id = ?", [resumeId]);
  if (!resume) return null;

  const userId = resume.user_id;
  const profile = await queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
  const user = await queryOne<{ handle: string; plan: string; plan_expires: string | null }>(
    db,
    "SELECT handle, plan, plan_expires FROM users WHERE id = ?",
    [userId],
  );

  const portfolio = resume.portfolio_id
    ? await queryOne(db, "SELECT * FROM portfolios WHERE id = ?", [resume.portfolio_id])
    : null;

  const resumeHeadline = String(resume.headline ?? "").trim();
  const resumeBio = String(resume.bio ?? "").trim();

  const portfolioShell: Record<string, unknown> = portfolio
    ? {
        ...portfolio,
        headline: resumeHeadline || String(portfolio.headline ?? ""),
        bio: resumeBio || String(portfolio.bio ?? ""),
      }
    : {
        id: `resume-shell-${resume.id}`,
        user_id: userId,
        name: resume.name,
        slug: "resume",
        description: "",
        theme_slug: "minimal",
        headline: resumeHeadline,
        bio: resumeBio,
        is_public: 0,
        is_default: 0,
        show_skills: 1,
        show_projects: 1,
        show_experience: 1,
        show_education: 1,
        show_certifications: 1,
        show_languages: 1,
      };

  return {
    portfolio: portfolioShell,
    profile: profile ?? { name: "", headline: "", bio: "" },
    skills: await fetchSkillsForParent(db, "resume_skills", "resume_id", resumeId),
    projects: await fetchJunctionLibraryRows(db, {
      junctionTable: "resume_projects",
      parentColumn: "resume_id",
      parentId: resumeId,
      itemColumn: "project_id",
      libraryTable: "projects",
      junctionSort: true,
    }),
    experience: await fetchJunctionLibraryRows(db, {
      junctionTable: "resume_experience",
      parentColumn: "resume_id",
      parentId: resumeId,
      itemColumn: "experience_id",
      libraryTable: "experience",
      junctionSort: true,
    }),
    education: await fetchJunctionLibraryRows(db, {
      junctionTable: "resume_education",
      parentColumn: "resume_id",
      parentId: resumeId,
      itemColumn: "education_id",
      libraryTable: "education",
      junctionSort: true,
    }),
    certifications: await fetchSimpleJunctionRows(
      db,
      "resume_certifications",
      "resume_id",
      resumeId,
      "certification_id",
      "certifications",
    ),
    languages: await fetchSimpleJunctionRows(
      db,
      "resume_languages",
      "resume_id",
      resumeId,
      "language_id",
      "languages",
    ),
    social_links: await queryAll(
      db,
      "SELECT * FROM social_links WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, provider",
      [userId],
    ),
    handle: user?.handle ?? "",
    plan: user?.plan ?? "free",
    plan_expires: user?.plan_expires ?? null,
  };
}

export async function getDefaultPublicPortfolio(db: FoliyoDb, userId?: string): Promise<PublicPortfolio | null> {
  const portfolio = userId
    ? await queryOne(
      db,
      "SELECT * FROM portfolios WHERE user_id = ? AND is_default = 1 AND is_public = 1",
      [userId],
    )
    : await queryOne(db, "SELECT * FROM portfolios WHERE is_default = 1 AND is_public = 1 LIMIT 1");
  if (!portfolio) return null;
  return loadPortfolioContent(db, portfolio.id as string);
}

export async function getPublicPortfolioBySlug(
  db: FoliyoDb,
  userId: string,
  slug: string,
): Promise<PublicPortfolio | null> {
  const portfolio = await queryOne(
    db,
    "SELECT * FROM portfolios WHERE user_id = ? AND slug = ? AND is_public = 1",
    [userId, slug],
  );
  if (!portfolio) return null;
  return loadPortfolioContent(db, portfolio.id as string);
}

/**
 * Private-link access: the unguessable token alone is the access control, so this
 * intentionally does not require is_public — it's how a portfolio can be shared with
 * a specific person without being discoverable at /u/{handle} or /u/{handle}/{slug}.
 */
export async function getPublicPortfolioByToken(
  db: FoliyoDb,
  token: string,
): Promise<PublicPortfolio | null> {
  const portfolio = await queryOne(db, "SELECT * FROM portfolios WHERE access_token = ?", [token]);
  if (!portfolio) return null;
  return loadPortfolioContent(db, portfolio.id as string);
}

/**
 * Synthetic portfolio from the user's full content library (no portfolio required).
 * Used by the dashboard live preview pane.
 * Theme matches the default portfolio when present so content preview shares
 * the same design language as portfolio live preview.
 */
export async function loadLibraryPreview(
  db: FoliyoDb,
  userId: string,
  themeOverride?: string,
): Promise<PublicPortfolio | null> {
  const user = await queryOne<{ handle: string | null; plan: string; plan_expires: string | null }>(
    db,
    "SELECT handle, plan, plan_expires FROM users WHERE id = ?",
    [userId],
  );
  if (!user) return null;

  const profile = await queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
  const defaultPortfolio = await queryOne<{ theme_slug: string }>(
    db,
    "SELECT theme_slug FROM portfolios WHERE user_id = ? AND is_default = 1 LIMIT 1",
    [userId],
  );
  const settings = await queryOne<{ theme_slug: string }>(
    db,
    "SELECT theme_slug FROM settings WHERE user_id = ?",
    [userId],
  );

  const themeSlug =
    themeOverride || defaultPortfolio?.theme_slug || settings?.theme_slug || "minimal";

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
    skills: await queryAll(db, "SELECT * FROM skills WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, name", [
      userId,
    ]),
    projects: await queryAll(db, "SELECT * FROM projects WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, title", [
      userId,
    ]),
    experience: await queryAll(db, "SELECT * FROM experience WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order", [
      userId,
    ]),
    education: await queryAll(db, "SELECT * FROM education WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order", [
      userId,
    ]),
    certifications: await queryAll(
      db,
      "SELECT * FROM certifications WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order",
      [userId],
    ),
    languages: await queryAll(db, "SELECT * FROM languages WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order", [
      userId,
    ]),
    social_links: await queryAll(
      db,
      "SELECT * FROM social_links WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, provider",
      [userId],
    ),
    handle: user.handle ?? "",
    plan: user.plan ?? "free",
    plan_expires: user.plan_expires ?? null,
  };
}

export type PortfolioDraftPreviewInput = {
  name?: string;
  description?: string;
  headline?: string;
  bio?: string;
  theme_slug?: string;
  show_skills?: number;
  show_projects?: number;
  show_experience?: number;
  show_education?: number;
  show_certifications?: number;
  show_languages?: number;
  skills_title?: string;
  projects_title?: string;
  experience_title?: string;
  education_title?: string;
  certifications_title?: string;
  languages_title?: string;
  skill_ids?: string[];
  project_ids?: string[];
  experience_ids?: string[];
  education_ids?: string[];
  certification_ids?: string[];
  language_ids?: string[];
};

/**
 * Owner-only synthetic portfolio for dashboard create/edit live preview
 * before (or without) persisting junctions.
 */
export async function loadPortfolioDraftPreview(
  db: FoliyoDb,
  userId: string,
  input: PortfolioDraftPreviewInput,
): Promise<PublicPortfolio | null> {
  const user = await queryOne<{ handle: string | null; plan: string; plan_expires: string | null }>(
    db,
    "SELECT handle, plan, plan_expires FROM users WHERE id = ?",
    [userId],
  );
  if (!user) return null;

  const profile = await queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
  const themeSlug = String(input.theme_slug ?? "minimal").trim().toLowerCase() || "minimal";

  const show = (v: number | undefined, fallback = 1) => (v === 0 || v === 1 ? v : fallback);

  const fetchOwned = async (table: string, ids: string[]) => {
    const ordered = await sortIdsByLibraryOrder(db, table, ids);
    if (!ordered.length) return [];
    const rows = await queryAll<Record<string, unknown>>(
      db,
      `SELECT * FROM ${table} WHERE user_id = ? AND id IN (${ordered.map(() => "?").join(",")}) AND deleted_at IS NULL`,
      [userId, ...ordered],
    );
    return orderRowsByIds(rows, ordered);
  };

  let skills =
    show(input.show_skills) === 1 ? await fetchOwned("skills", input.skill_ids ?? []) : [];
  skills = skills.filter(
    (s) =>
      (s.status as string | undefined) !== "pending" &&
      (s.status as string | undefined) !== "dismissed",
  );

  return {
    portfolio: {
      id: "draft-preview",
      user_id: userId,
      name: String(input.name ?? "").trim() || "Portfolio preview",
      slug: "preview",
      description: String(input.description ?? ""),
      headline: String(input.headline ?? ""),
      bio: String(input.bio ?? ""),
      theme_slug: themeSlug,
      is_public: 1,
      is_default: 0,
      show_skills: show(input.show_skills),
      show_projects: show(input.show_projects),
      show_experience: show(input.show_experience),
      show_education: show(input.show_education),
      show_certifications: show(input.show_certifications),
      show_languages: show(input.show_languages),
      skills_title: String(input.skills_title ?? ""),
      projects_title: String(input.projects_title ?? ""),
      experience_title: String(input.experience_title ?? ""),
      education_title: String(input.education_title ?? ""),
      certifications_title: String(input.certifications_title ?? ""),
      languages_title: String(input.languages_title ?? ""),
    },
    profile: profile ?? { name: "", headline: "", bio: "" },
    skills,
    projects:
      show(input.show_projects) === 1 ? await fetchOwned("projects", input.project_ids ?? []) : [],
    experience:
      show(input.show_experience) === 1
        ? await fetchOwned("experience", input.experience_ids ?? [])
        : [],
    education:
      show(input.show_education) === 1
        ? await fetchOwned("education", input.education_ids ?? [])
        : [],
    certifications:
      show(input.show_certifications) === 1
        ? await fetchOwned("certifications", input.certification_ids ?? [])
        : [],
    languages:
      show(input.show_languages) === 1
        ? await fetchOwned("languages", input.language_ids ?? [])
        : [],
    social_links: await queryAll(
      db,
      "SELECT * FROM social_links WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, provider",
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
