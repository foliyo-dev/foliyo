import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveThemesDir } from "../assets.js";
import type { Config } from "../config.js";
import type { PublicPortfolio } from "./pages.js";
import { effectivePlan, showFoliyoBranding } from "../plan.js";
import { absoluteHttpUrl } from "../http-url.js";
import { markdownToSafeHtml } from "../markdown.js";
import { resolveAvatarUrl } from "../avatar.js";
import {
  resolveSocialUrl,
  socialDisplayLabel,
  socialIconSvg,
} from "../social/providers.js";
import {
  isGallerySectionsMode,
  resolveThemeConfig,
  skinCssVars,
  type ThemeConfig,
} from "../spec/theme-config.js";
import {
  loadRecipeCss,
  renderGalleryGridBody,
  renderGlassmorphicBody,
  renderPhotoHeroBody,
} from "./recipes.js";

const PORTFOLIO_SLUGS = new Set([
  "minimal",
  "modern",
  "creative",
  "noir",
  "atelier",
  "editorial",
]);
const RESUME_SLUGS = new Set(["classic", "compact", "academic", "sidebar"]);

const here = dirname(fileURLToPath(import.meta.url));

/** Resolve packages/themes for OSS core, cloud, and release bundles. */
function resolveThemesRoot(): string {
  const fromBundle = resolveThemesDir(import.meta.url);
  if (fromBundle) return fromBundle;

  const marker = join("portfolio", "minimal", "style.css");
  const candidates = [
    // apps/core/src/public → ../../../../packages/themes (real monorepo layout)
    join(here, "../../../../packages/themes"),
    // cwd = apps/core
    join(process.cwd(), "../../packages/themes"),
    join(process.cwd(), "packages/themes"),
    // cwd = foliyo-cloud/apps/api
    join(process.cwd(), "../../foliyo/packages/themes"),
    join(process.cwd(), "../../../foliyo/packages/themes"),
  ];

  let dir = here;
  for (let i = 0; i < 12; i++) {
    candidates.push(join(dir, "packages/themes"));
    candidates.push(join(dir, "foliyo/packages/themes"));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const root of candidates) {
    if (existsSync(join(root, marker))) return root;
  }
  return candidates[0]!;
}

const themesRoot = resolveThemesRoot();

export type ResumeMeta = {
  name: string;
  theme_slug: string;
};

type RenderVariant = "site" | "document";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeSlug(kind: "portfolio" | "resume", slug: unknown): string {
  const raw = String(slug ?? "").trim().toLowerCase();
  if (kind === "portfolio") return PORTFOLIO_SLUGS.has(raw) ? raw : "minimal";
  return RESUME_SLUGS.has(raw) ? raw : "classic";
}

export function loadThemeCss(kind: "portfolio" | "resume", slug: unknown): string {
  const safe = normalizeSlug(kind, slug);
  const file = join(themesRoot, kind, safe, "style.css");
  if (!existsSync(file)) {
    return `/* missing theme css: ${kind}/${safe} */`;
  }
  return readFileSync(file, "utf8");
}

function displayName(data: PublicPortfolio): string {
  return String(data.profile.name || data.portfolio.name || "Portfolio");
}

function displayHeadline(data: PublicPortfolio): string {
  const fromPortfolio = String(data.portfolio.headline ?? "").trim();
  if (fromPortfolio) return fromPortfolio;
  return String(data.profile.headline ?? "").trim();
}

function displayBio(data: PublicPortfolio): string {
  const fromPortfolio = String(data.portfolio.bio ?? "").trim();
  if (fromPortfolio) return fromPortfolio;
  return String(data.profile.bio ?? "").trim();
}

/** Interactive project links for portfolio sites. */
function linkLabel(raw: unknown, fallback: string): string {
  const s = String(raw ?? "").trim();
  return s || fallback;
}

function hrefOf(raw: unknown): string {
  const href = absoluteHttpUrl(String(raw ?? ""));
  return href ? esc(href) : "";
}

function projectLinksSite(pr: Record<string, unknown>): string {
  const links: string[] = [];
  if (pr.url) {
    const href = hrefOf(pr.url);
    if (href) {
      links.push(
        `<a href="${href}" rel="noopener noreferrer">${esc(linkLabel(pr.url_label, "Live"))}</a>`,
      );
    }
  }
  if (pr.repo_url) {
    const href = hrefOf(pr.repo_url);
    if (href) {
      links.push(
        `<a href="${href}" rel="noopener noreferrer">${esc(linkLabel(pr.repo_url_label, "Repo"))}</a>`,
      );
    }
  }
  if (pr.article_url) {
    const href = hrefOf(pr.article_url);
    if (href) {
      links.push(
        `<a href="${href}" rel="noopener noreferrer">${esc(linkLabel(pr.article_url_label, "View write-up"))}</a>`,
      );
    }
  }
  return links.length ? `<p class="links">${links.join(" · ")}</p>` : "";
}

/** Quieter document-style links for resumes (print-friendly). */
function projectLinksDocument(pr: Record<string, unknown>): string {
  const links: string[] = [];
  if (pr.url) {
    const href = absoluteHttpUrl(String(pr.url));
    if (href) links.push(`<a class="doc-link" href="${esc(href)}" rel="noopener noreferrer">${esc(href)}</a>`);
  } else if (pr.repo_url) {
    const href = absoluteHttpUrl(String(pr.repo_url));
    if (href) links.push(`<a class="doc-link" href="${esc(href)}" rel="noopener noreferrer">${esc(href)}</a>`);
  } else if (pr.article_url) {
    const href = absoluteHttpUrl(String(pr.article_url));
    if (href) links.push(`<a class="doc-link" href="${esc(href)}" rel="noopener noreferrer">${esc(href)}</a>`);
  }
  return links.length ? `<p class="links doc-links">${links.join("<br>")}</p>` : "";
}

type SectionParts = {
  contactHtml: string;
  skillsHtml: string;
  projectsHtml: string;
  expHtml: string;
  eduHtml: string;
  certHtml: string;
  langHtml: string;
  postsHtml: string;
};

type NavItem = { id: string; label: string; href?: string };

function sectionTag(
  mode: "portfolio" | "resume",
  id: string,
  extraClass: string,
  inner: string,
): string {
  const idAttr = mode === "portfolio" ? ` id="${id}"` : "";
  return `<section${idAttr} class="section ${extraClass}">${inner}</section>`;
}

function parseSkillsDeveloped(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter(Boolean);
  } catch {
    return [];
  }
}

function skillsDevelopedHtml(raw: unknown): string {
  const names = parseSkillsDeveloped(raw);
  if (!names.length) return "";
  return `<ul class="tags skill-chips">${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
}

const SECTION_DEFAULTS = {
  skills: "Skills",
  projects: "Projects",
  experience: "Experience",
  education: "Education",
  certifications: "Certifications",
  languages: "Languages",
  posts: "Writing",
} as const;

type SectionKey = keyof typeof SECTION_DEFAULTS;

function sectionTitle(data: PublicPortfolio, key: SectionKey, mode: "portfolio" | "resume"): string {
  if (mode === "resume") return SECTION_DEFAULTS[key];
  const custom = String(data.portfolio[`${key}_title`] ?? "").trim();
  return custom || SECTION_DEFAULTS[key];
}

function safeMediaUrl(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol === "http:" || u.protocol === "https:") return s;
    } catch {
      return null;
    }
    return null;
  }
  if (/^\/uploads\/[a-f0-9]{32}\.(jpe?g|png|webp)$/i.test(s)) return s;
  return null;
}

function projectMediaHtml(
  pr: Record<string, unknown>,
  mode: "portfolio" | "resume",
  siteUrl: string,
): string {
  if (mode === "resume") return "";
  const src = safeMediaUrl(pr.image_url);
  if (!src) return "";
  const abs =
    src.startsWith("/uploads/") ? `${siteUrl.replace(/\/$/, "")}${src}` : src;
  return `<img class="card-media" src="${esc(abs)}" alt="" />`;
}

type ProjectRow = Record<string, unknown> & {
  title: string;
  description?: string | null;
  skills_developed?: unknown;
  featured?: number | boolean;
  start_date?: string | null;
  end_date?: string | null;
  sort_order?: number;
};

function projectsLayoutOf(data: PublicPortfolio): "cards" | "featured_timeline" | "timeline" {
  const raw = String(data.portfolio.projects_layout ?? "cards");
  if (raw === "featured_timeline" || raw === "timeline") return raw;
  return "cards";
}

function projectDateSpan(pr: ProjectRow): string {
  const start = String(pr.start_date ?? "").trim();
  const endRaw = pr.end_date == null ? "" : String(pr.end_date).trim();
  if (!start && !endRaw) return "";
  if (!start) return endRaw;
  if (!endRaw) return `${start} – Present`;
  return `${start} – ${endRaw}`;
}

function compareProjectsByDateDesc(a: ProjectRow, b: ProjectRow): number {
  const as = String(a.start_date ?? "").trim();
  const bs = String(b.start_date ?? "").trim();
  if (as && !bs) return -1;
  if (!as && bs) return 1;
  if (as !== bs) return bs.localeCompare(as);
  const ao = Number(a.sort_order ?? 0);
  const bo = Number(b.sort_order ?? 0);
  if (ao !== bo) return ao - bo;
  return String(a.title).localeCompare(String(b.title));
}

function projectCardLi(
  pr: ProjectRow,
  mode: "portfolio" | "resume",
  siteUrl: string,
  linkFn: (pr: Record<string, unknown>) => string,
): string {
  const media = projectMediaHtml(pr, mode, siteUrl);
  return `<li${media ? ' class="has-media"' : ""}>${media}<strong>${esc(pr.title)}</strong>${
    pr.description ? `<p>${esc(String(pr.description))}</p>` : ""
  }${skillsDevelopedHtml(pr.skills_developed)}${linkFn(pr)}</li>`;
}

function projectTimelineLi(
  pr: ProjectRow,
  mode: "portfolio" | "resume",
  linkFn: (pr: Record<string, unknown>) => string,
): string {
  const span = projectDateSpan(pr);
  return `<li>
    <div class="item-head">
      <strong>${esc(pr.title)}</strong>
      ${span ? `<span class="muted">${esc(span)}</span>` : ""}
    </div>
    ${pr.description ? `<p>${esc(String(pr.description))}</p>` : ""}
    ${skillsDevelopedHtml(pr.skills_developed)}
    ${linkFn(pr)}
  </li>`;
}

function projectsBodyHtml(
  data: PublicPortfolio,
  mode: "portfolio" | "resume",
  siteUrl: string,
  linkFn: (pr: Record<string, unknown>) => string,
): string {
  const projects = data.projects as ProjectRow[];
  const layout = mode === "resume" ? "cards" : projectsLayoutOf(data);

  if (layout === "cards") {
    return `<ul class="cards">${projects
      .map((pr) => projectCardLi(pr, mode, siteUrl, linkFn))
      .join("")}</ul>`;
  }

  if (layout === "timeline") {
    const ordered = [...projects].sort(compareProjectsByDateDesc);
    return `<ul class="timeline project-timeline">${ordered
      .map((pr) => projectTimelineLi(pr, mode, linkFn))
      .join("")}</ul>`;
  }

  // featured_timeline: featured cards first, then chronological build log of the rest
  const featured = projects.filter((p) => Number(p.featured) === 1);
  const rest = projects
    .filter((p) => Number(p.featured) !== 1)
    .sort(compareProjectsByDateDesc);
  const featuredBlock = featured.length
    ? `<ul class="cards featured-projects">${featured
        .map((pr) => projectCardLi(pr, mode, siteUrl, linkFn))
        .join("")}</ul>`
    : "";
  const timelineBlock = rest.length
    ? `${featured.length ? `<h3 class="project-log-heading">Build log</h3>` : ""}<ul class="timeline project-timeline">${rest
        .map((pr) => projectTimelineLi(pr, mode, linkFn))
        .join("")}</ul>`
    : "";
  if (!featuredBlock && !timelineBlock) {
    return `<ul class="cards">${projects
      .map((pr) => projectCardLi(pr, mode, siteUrl, linkFn))
      .join("")}</ul>`;
  }
  return `${featuredBlock}${timelineBlock}`;
}

function sectionParts(
  data: PublicPortfolio,
  mode: "portfolio" | "resume",
  siteUrl = "",
): SectionParts {
  const linkFn = mode === "portfolio" ? projectLinksSite : projectLinksDocument;

  const skillsHtml = data.skills.length
    ? sectionTag(
        mode,
        "skills",
        "section-skills",
        mode === "resume"
          ? `<h2>${esc(sectionTitle(data, "skills", mode))}</h2><p class="skills-keywords">${data.skills
              .map((s) => esc(s.name))
              .join(", ")}</p>`
          : (() => {
              const groups = new Map<string, typeof data.skills>();
              for (const s of data.skills) {
                const raw = String(s.category ?? "").trim();
                const cat = !raw || raw === "general" ? "Skills" : raw;
                const list = groups.get(cat) ?? [];
                list.push(s);
                groups.set(cat, list);
              }
              const entries = [...groups.entries()];
              const multi = entries.length > 1;
              const body = entries
                .map(([cat, list]) => {
                  const heading = multi
                    ? `<h3 class="skill-group">${esc(cat)}</h3>`
                    : "";
                  const showLevels =
                    mode === "portfolio" && Number(data.portfolio.show_skill_levels) === 1;
                  const items = list
                    .map((s) => {
                      const level =
                        showLevels && s.level
                          ? ` <span class="muted">${esc(String(s.level))}</span>`
                          : "";
                      return `<li>${esc(String(s.name))}${level}</li>`;
                    })
                    .join("");
                  return `${heading}<ul class="tags">${items}</ul>`;
                })
                .join("");
              return `<h2>${esc(sectionTitle(data, "skills", mode))}</h2>${body}`;
            })(),
      )
    : "";

  const projectsHtml = data.projects.length
    ? sectionTag(
        mode,
        "projects",
        "section-projects",
        `<h2>${esc(sectionTitle(data, "projects", mode))}</h2>${projectsBodyHtml(data, mode, siteUrl, linkFn)}`,
      )
    : "";

  const expHtml = data.experience.length
    ? sectionTag(
        mode,
        "experience",
        "section-experience",
        `<h2>${esc(sectionTitle(data, "experience", mode))}</h2><ul class="timeline">${data.experience
          .map((e) => {
            const writeUpLabel = linkLabel(e.article_url_label, "View write-up");
            const writeUp =
              mode === "portfolio" && e.article_url
                ? `<p class="links"><a href="${hrefOf(e.article_url)}" rel="noopener noreferrer">${esc(writeUpLabel)}</a></p>`
                : mode === "resume" && e.article_url
                  ? `<p class="links doc-links"><a class="doc-link" href="${hrefOf(e.article_url)}" rel="noopener noreferrer">${esc(String(e.article_url))}</a></p>`
                  : "";
            return `<li>
              <div class="item-head">
                <strong>${esc(e.role)}</strong>
                <span class="muted">${esc(e.start_date)} – ${e.end_date ? esc(e.end_date) : "Present"}</span>
              </div>
              <div class="item-sub">${esc(e.company)}${e.location ? ` · ${esc(e.location)}` : ""}</div>
              ${e.description ? `<p>${esc(e.description)}</p>` : ""}
              ${skillsDevelopedHtml(e.skills_developed)}
              ${writeUp}
            </li>`;
          })
          .join("")}</ul>`,
      )
    : "";

  const eduHtml = data.education.length
    ? sectionTag(
        mode,
        "education",
        "section-education",
        `<h2>${esc(sectionTitle(data, "education", mode))}</h2><ul class="timeline">${data.education
          .map(
            (e) =>
              `<li>
              <div class="item-head">
                <strong>${esc(e.institution)}</strong>
                <span class="muted">${esc(e.start_date)}${e.end_date ? ` – ${esc(e.end_date)}` : ""}</span>
              </div>
              <div class="item-sub">${[e.degree, e.field].filter(Boolean).map(esc).join(" · ")}</div>
              ${skillsDevelopedHtml(e.skills_developed)}
            </li>`,
          )
          .join("")}</ul>`,
      )
    : "";

  const certHtml = data.certifications.length
    ? sectionTag(
        mode,
        "certifications",
        "section-certs",
        `<h2>${esc(sectionTitle(data, "certifications", mode))}</h2><ul class="timeline">${data.certifications
          .map((c) => {
            const cred =
              c.credential_url && mode === "portfolio"
                ? ` <a href="${hrefOf(c.credential_url)}" rel="noopener noreferrer">Credential</a>`
                : c.credential_url && mode === "resume"
                  ? ` <a class="doc-link" href="${hrefOf(c.credential_url)}" rel="noopener noreferrer">Credential</a>`
                  : "";
            return `<li>
              <strong>${esc(c.name)}</strong>${c.issuer ? ` — ${esc(c.issuer)}` : ""}
              ${c.issued_at ? ` <span class="muted">${esc(c.issued_at)}</span>` : ""}
              ${cred}
              ${skillsDevelopedHtml(c.skills_developed)}
            </li>`;
          })
          .join("")}</ul>`,
      )
    : "";

  const langHtml = data.languages.length
    ? sectionTag(
        mode,
        "languages",
        "section-languages",
        `<h2>${esc(sectionTitle(data, "languages", mode))}</h2><ul class="tags">${data.languages
          .map((l) => `<li>${esc(l.name)} <span class="muted">${esc(l.proficiency)}</span></li>`)
          .join("")}</ul>`,
      )
    : "";

  // Writing lives on /u/{handle}/blog — linked from site nav, not inlined here.
  const postsHtml = "";

  return {
    contactHtml: "",
    skillsHtml,
    projectsHtml,
    expHtml,
    eduHtml,
    certHtml,
    langHtml,
    postsHtml,
  };
}

function navItemsFor(data: PublicPortfolio): NavItem[] {
  const items: NavItem[] = [{ id: "about", label: "About" }];
  // Portfolio nav mirrors body order: projects before skills.
  if (data.projects.length) items.push({ id: "projects", label: sectionTitle(data, "projects", "portfolio") });
  if (data.skills.length) items.push({ id: "skills", label: sectionTitle(data, "skills", "portfolio") });
  if (data.experience.length) {
    items.push({ id: "experience", label: sectionTitle(data, "experience", "portfolio") });
  }
  if (data.education.length) items.push({ id: "education", label: sectionTitle(data, "education", "portfolio") });
  if (data.certifications.length) {
    items.push({ id: "certifications", label: sectionTitle(data, "certifications", "portfolio") });
  }
  if (data.languages.length) items.push({ id: "languages", label: sectionTitle(data, "languages", "portfolio") });
  const handle = data.handle?.trim();
  if ((data.posts ?? []).length && handle) {
    items.push({
      id: "posts",
      label: sectionTitle(data, "posts", "portfolio"),
      href: `/u/${encodeURIComponent(handle)}/blog`,
    });
  }
  return items;
}

function siteNavHtml(data: PublicPortfolio, activeId = ""): string {
  const name = esc(displayName(data));
  const handle = data.handle ? esc(data.handle) : "";
  const home = handle ? `/u/${handle}` : "#about";
  const items = navItemsFor(data)
    .map((item) => {
      const href = item.href ?? (item.id === "about" ? home : `${home}#${item.id}`);
      const active = item.id === activeId ? ' aria-current="page" class="active"' : "";
      return `<a href="${esc(href)}"${active}>${esc(item.label)}</a>`;
    })
    .join("");
  return `<nav class="site-nav" aria-label="Site">
    <div class="site-nav-brand">
      <a class="site-name" href="${home}">${name}</a>
      ${handle ? `<a class="handle" href="/u/${handle}">@${handle}</a>` : ""}
    </div>
    <div class="site-nav-links">${items}</div>
  </nav>`;
}

function isSparsePortfolio(data: PublicPortfolio): boolean {
  return (
    data.skills.length === 0 &&
    data.projects.length === 0 &&
    data.experience.length === 0 &&
    data.education.length === 0 &&
    data.certifications.length === 0 &&
    data.languages.length === 0
  );
}

function sparseSectionHtml(mode: "portfolio" | "resume"): string {
  const copy =
    mode === "portfolio"
      ? "This folio is just getting started — check back soon."
      : "Sections will appear here once content is added.";
  return `<section class="section section-sparse" aria-label="Empty"><p class="muted sparse-copy">${copy}</p></section>`;
}

function sectionsHtml(data: PublicPortfolio, mode: "portfolio" | "resume", siteUrl = ""): string {
  const p = sectionParts(data, mode, siteUrl);
  // Portfolio: work-first (projects before skills). Resume keeps classic CV order.
  const body =
    mode === "portfolio"
      ? `${p.contactHtml}${p.projectsHtml}${p.skillsHtml}${p.expHtml}${p.eduHtml}${p.certHtml}${p.langHtml}${p.postsHtml}`
      : `${p.contactHtml}${p.skillsHtml}${p.projectsHtml}${p.expHtml}${p.eduHtml}${p.certHtml}${p.langHtml}${p.postsHtml}`;
  if (mode === "portfolio" && isSparsePortfolio(data) && !body.trim()) {
    return sparseSectionHtml(mode);
  }
  if (mode === "resume" && isSparsePortfolio(data) && !body.trim()) {
    return sparseSectionHtml(mode);
  }
  return body;
}

function resumeBodyHtml(data: PublicPortfolio, slug: string, siteUrl = ""): string {
  const hero = heroHtml(data, "resume");
  if (slug !== "sidebar") {
    return `<div class="resume-sheet">${hero}${sectionsHtml(data, "resume", siteUrl)}</div>`;
  }

  const p = sectionParts(data, "resume", siteUrl);
  return `<div class="resume-sheet">
    <div class="resume-layout">
      <aside class="resume-sidebar">
        ${hero}
        ${p.skillsHtml}
        ${p.langHtml}
        ${p.certHtml}
      </aside>
      <div class="resume-main">
        ${p.expHtml}
        ${p.eduHtml}
        ${p.projectsHtml}
      </div>
    </div>
  </div>`;
}

function socialLinksHtml(data: PublicPortfolio, mode: "portfolio" | "resume"): string {
  const links = data.social_links ?? [];
  if (!links.length) return "";

  if (mode === "resume") {
    const items = links
      .map((link) => {
        const provider = String(link.provider ?? "other");
        const url = resolveSocialUrl(provider, String(link.value ?? ""));
        if (!url) return "";
        const label = socialDisplayLabel(provider, String(link.label ?? ""));
        return `<li><a class="doc-link" href="${esc(url)}" rel="noopener noreferrer">${esc(label)}</a></li>`;
      })
      .filter(Boolean)
      .join("");
    if (!items) return "";
    return `<ul class="social-links social-links-doc">${items}</ul>`;
  }

  const items = links
    .map((link) => {
      const provider = String(link.provider ?? "other");
      const url = resolveSocialUrl(provider, String(link.value ?? ""));
      if (!url) return "";
      const label = socialDisplayLabel(provider, String(link.label ?? ""));
      const icon = socialIconSvg(provider);
      return `<li><a class="social-link" href="${esc(url)}" rel="noopener noreferrer" title="${esc(label)}" aria-label="${esc(label)}">${icon}<span>${esc(label)}</span></a></li>`;
    })
    .filter(Boolean)
    .join("");
  if (!items) return "";
  return `<ul class="social-links">${items}</ul>`;
}

function classicHeroCtasHtml(data: PublicPortfolio): string {
  const primary = String(data.portfolio.hero_cta_primary ?? "").trim();
  const secondary = String(data.portfolio.hero_cta_secondary ?? "").trim();
  if (!primary && !secondary) return "";
  const handle = data.handle?.trim();
  const home = handle ? `/u/${esc(handle)}` : "";
  const projectsHref = `${home}#projects`;
  const email = String(data.profile.email ?? "").trim();
  const contactHref = email ? `mailto:${esc(email)}` : `${home}#about`;
  const bits: string[] = [];
  if (primary) {
    bits.push(`<a class="hero-cta hero-cta-primary" href="${projectsHref}">${esc(primary)}</a>`);
  }
  if (secondary) {
    bits.push(`<a class="hero-cta hero-cta-secondary" href="${contactHref}">${esc(secondary)}</a>`);
  }
  return `<div class="hero-ctas">${bits.join("")}</div>`;
}

function heroHtml(data: PublicPortfolio, mode: "portfolio" | "resume"): string {
  const name = esc(displayName(data));
  const headline = esc(displayHeadline(data));
  const bio = esc(displayBio(data));
  const avatar = resolveAvatarUrl(
    data.profile.avatar_url as string | null | undefined,
    data.profile.email as string | null | undefined,
    176,
  );
  const avatarHtml = avatar
    ? `<img class="avatar" src="${esc(avatar)}" alt="" width="88" height="88" />`
    : "";
  const social = socialLinksHtml(data, mode);

  if (mode === "resume") {
    const contactBits: string[] = [];
    if (data.profile.email) {
      contactBits.push(`<a href="mailto:${esc(data.profile.email)}">${esc(data.profile.email)}</a>`);
    }
    if (data.profile.location) contactBits.push(`<span>${esc(data.profile.location)}</span>`);
    const contact =
      contactBits.length > 0 ? `<p class="contact">${contactBits.join(" · ")}</p>` : "";

    return `<header class="hero">
      <div>
        <h1>${name}</h1>
        ${headline ? `<p class="headline">${headline}</p>` : ""}
        ${bio ? `<p class="bio">${bio}</p>` : ""}
        ${contact}
        ${social}
      </div>
    </header>`;
  }

  const ctas = classicHeroCtasHtml(data);

  return `<header id="about" class="hero">
    ${avatarHtml}
    <div class="hero-text">
      <h1>${name}</h1>
      ${headline ? `<p class="headline">${headline}</p>` : ""}
      ${bio ? `<p class="bio">${bio}</p>` : ""}
      ${ctas}
      ${social}
    </div>
  </header>`;
}

const SITE_SHELL_CSS = `
.social-links{display:flex;flex-wrap:wrap;gap:0.5rem;list-style:none;margin:1rem 0 0;padding:0}
.social-links a{display:inline-flex;align-items:center;gap:0.4rem;padding:0.4rem 0.75rem;border-radius:999px;border:1px solid var(--line,#e7e5e4);background:var(--surface,#fff);color:var(--ink,inherit);font-size:0.8125rem;font-weight:500;line-height:1;text-decoration:none;transition:border-color .15s ease,color .15s ease,background .15s ease}
.social-links a:hover{border-color:var(--accent,#0f766e);color:var(--accent,#0f766e)}
.social-links svg{width:1rem;height:1rem;flex-shrink:0;display:block}
.hero-ctas{display:flex;flex-wrap:wrap;gap:0.65rem;margin:1.1rem 0 0}
.hero-cta{display:inline-flex;align-items:center;justify-content:center;padding:0.55rem 1.05rem;border-radius:8px;font-size:0.875rem;font-weight:600;text-decoration:none;line-height:1.2}
.hero-cta-primary{background:var(--accent,#0f766e);color:#fff;border:1px solid transparent}
.hero-cta-primary:hover{opacity:.92}
.hero-cta-secondary{background:transparent;color:var(--ink,inherit);border:1px solid var(--line,#e7e5e4)}
.hero-cta-secondary:hover{border-color:var(--accent,#0f766e);color:var(--accent,#0f766e)}
.theme-creative .hero-cta-primary{background:#e8c4a0;color:#1a1510}
.theme-creative .hero-cta-secondary{border-color:rgba(232,196,160,.35);color:#f8f1e8}
.theme-noir .hero-cta-primary{background:var(--accent,#d4a574);color:#0c0d10}
.theme-noir .hero-cta-secondary{border-color:var(--line,#2a2e36);color:var(--ink,#e8e6e3)}
.card-media{display:block;width:100%;height:9rem;object-fit:cover;margin:0 0 0.85rem;border-radius:6px;background:var(--line,#e7e5e4)}
.theme-atelier .card-media{height:8.5rem;margin:0;border-radius:0}
.project-log-heading{margin:1.5rem 0 0.75rem;font-size:0.8125rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:var(--muted,#78716c)}
/* Baseline content links — never fall back to browser blue; dark recipes set --link lighter than --accent */
.links{margin:0.5rem 0 0;font-size:0.875rem}
.links a{color:var(--link,var(--accent,#0f766e));text-decoration:none;font-weight:500}
.links a:hover{text-decoration:underline;text-underline-offset:2px}
.theme-creative .social-links a{background:rgba(255,255,255,.08);border-color:rgba(232,196,160,.35);color:#f8f1e8}
.theme-creative .social-links a:hover{border-color:#e8c4a0;color:#f0a06a;background:rgba(255,255,255,.12)}
.theme-noir .social-links a{background:var(--surface,#181b22);border-color:var(--line,#2a2e36);color:var(--ink,#e8e6e3)}
.theme-noir .social-links a:hover{border-color:var(--accent,#d4a574);color:var(--accent,#d4a574)}
.site-nav{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem 1.25rem;padding:0.85rem 1.5rem;border-bottom:1px solid var(--line,#e7e5e4);background:color-mix(in srgb,var(--surface,#fff) 92%,transparent);backdrop-filter:blur(8px)}
.site-nav-brand{display:flex;align-items:baseline;gap:0.65rem;min-width:0}
.site-nav .site-name{font-weight:600;text-decoration:none;color:var(--ink,inherit);font-size:0.95rem}
.site-nav .handle{font-size:0.8125rem;color:var(--muted,#78716c);text-decoration:none}
.site-nav-links{display:flex;flex-wrap:wrap;gap:0.35rem 0.85rem}
.site-nav-links a{font-size:0.8125rem;font-weight:500;color:var(--muted,#78716c);text-decoration:none}
.site-nav-links a:hover,.site-nav-links a.active,.site-nav-links a[aria-current="page"]{color:var(--accent,#0f766e)}
.section[id],.hero[id]{scroll-margin-top:4.5rem}
.section-sparse{padding:2rem 0 3rem}
.sparse-copy{margin:0;font-size:0.9375rem;text-align:center;color:var(--muted,#78716c)}
.skill-group{margin:1rem 0 0.5rem;font-size:0.8125rem;font-weight:600;letter-spacing:0.03em;text-transform:uppercase;color:var(--muted,#78716c)}
.skill-group:first-of-type{margin-top:0.35rem}
.print-fab{position:fixed;right:1rem;bottom:1rem;z-index:30}
.print-btn{border:0;border-radius:999px;padding:0.7rem 1.1rem;background:var(--accent,#0f766e);color:#fff;font:inherit;font-size:0.875rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.print-btn:hover{opacity:.92}
@media print{.no-print,.print-fab{display:none!important}}
@media (max-width:560px){
  .site-nav{padding:0.65rem 1rem;gap:0.5rem 0.75rem}
  .site-nav .site-name{font-size:0.875rem}
  .site-nav-links{width:100%;gap:0.5rem 0.75rem}
  .site-nav-links a{font-size:0.75rem}
  .section[id],.hero[id]{scroll-margin-top:5.5rem}
}
`;

const DOCUMENT_SHELL_CSS = `
.social-links-doc{display:flex;flex-wrap:wrap;justify-content:center;gap:0.35rem 0.75rem;list-style:none;margin:0.5rem 0 0;padding:0}
.social-links-doc a,.doc-link{color:inherit;font-size:0.8125rem;text-decoration:underline;text-underline-offset:2px;word-break:break-all}
.social-links-doc a:hover,.doc-link:hover{color:var(--accent,#111827)}
.print-fab{position:fixed;right:1rem;bottom:1rem;z-index:30}
.print-btn{border:0;border-radius:999px;padding:0.7rem 1.1rem;background:var(--ink,#111827);color:#fff;font:inherit;font-size:0.875rem;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.print-btn:hover{opacity:.92}
.resume-sheet{background:var(--surface,#fff)}
@media print{
  .no-print,.print-fab,.site-footer{display:none!important}
  body{background:#fff!important;padding:0!important}
  .page,.resume-sheet{max-width:none!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important}
  /* Fill leftover space — don't push a whole section to the next page. Keep a heading with what follows, and don't split a job/project card. */
  .section h2{break-after:avoid;page-break-after:avoid}
  .cards>li,.timeline>li,.skills-keywords{break-inside:avoid;page-break-inside:avoid}
  a.doc-link{text-decoration:none}
}
@page{margin:0.6in}
`;

function documentShell(opts: {
  title: string;
  themeClass: string;
  css: string;
  body: string;
  variant: RenderVariant;
  topbar?: string;
  /** UI chrome outside the resume/portfolio document (e.g. floating print). */
  chrome?: string;
  footer?: string;
  description?: string;
  ogImage?: string;
  canonical?: string;
  ogType?: "article" | "website";
}): string {
  const shellCss = opts.variant === "site" ? SITE_SHELL_CSS : DOCUMENT_SHELL_CSS;
  const mainClass = opts.variant === "document" ? "page resume-page" : "page";
  const description = opts.description?.trim();
  const seoBits: string[] = [];
  if (description) {
    seoBits.push(`<meta name="description" content="${esc(description)}">`);
  }
  if (opts.canonical) {
    seoBits.push(`<link rel="canonical" href="${esc(opts.canonical)}">`);
  }
  if (description || opts.ogImage || opts.canonical) {
    seoBits.push(`<meta property="og:title" content="${opts.title}">`);
    seoBits.push(
      `<meta property="og:type" content="${opts.ogType ?? (opts.ogImage ? "article" : "website")}">`,
    );
    if (description) {
      seoBits.push(`<meta property="og:description" content="${esc(description)}">`);
    }
    if (opts.ogImage) {
      seoBits.push(`<meta property="og:image" content="${esc(opts.ogImage)}">`);
      seoBits.push(`<meta name="twitter:card" content="summary_large_image">`);
    } else if (description) {
      seoBits.push(`<meta name="twitter:card" content="summary">`);
    }
  }
  const seo = seoBits.filter(Boolean).join("\n  ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  ${seo}
  <link rel="icon" href="/static/images/foliyo-icon.svg" type="image/svg+xml">
  <style>${opts.css}
${shellCss}
</style>
</head>
<body class="${opts.themeClass}">
  ${opts.topbar ?? ""}
  <main class="${mainClass}">
    ${opts.body}
  </main>
  ${opts.chrome ?? ""}
  ${opts.footer ?? ""}
</body>
</html>`;
}

/** Strip resume/library chrome for photo-gallery display mode. */
function galleryDisplayData(data: PublicPortfolio): PublicPortfolio {
  return {
    ...data,
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    languages: [],
    download_resume_token: undefined,
  };
}

function exoticBody(
  data: PublicPortfolio,
  themeConfig: ThemeConfig,
  siteUrl: string,
): string {
  const galleryOnly = isGallerySectionsMode(themeConfig);
  const base = galleryOnly ? galleryDisplayData(data) : data;
  // For exotic recipes, hide the default projects heading block when gallery-grid owns it.
  const hideProjects = themeConfig.recipe === "gallery-grid";
  const dataForSections: PublicPortfolio = hideProjects
    ? { ...base, projects: [] }
    : base;
  const sections = sectionsHtml(dataForSections, "portfolio", siteUrl);
  if (themeConfig.recipe === "photo-hero") {
    return renderPhotoHeroBody(data, themeConfig, siteUrl, sections);
  }
  if (themeConfig.recipe === "gallery-grid") {
    return renderGalleryGridBody(data, themeConfig, siteUrl, sections);
  }
  return renderGlassmorphicBody(data, themeConfig, siteUrl, sections);
}

export function renderPortfolioHtml(data: PublicPortfolio, config: Config): string {
  const themeConfig = resolveThemeConfig(
    data.portfolio.theme_config,
    data.portfolio.theme_slug,
  );
  const galleryOnly = isGallerySectionsMode(themeConfig);
  const viewData = galleryOnly ? galleryDisplayData(data) : data;
  const classicSlug = normalizeSlug(
    "portfolio",
    themeConfig.skin.theme_slug || data.portfolio.theme_slug,
  );
  const isExotic = themeConfig.recipe !== "classic";

  const css = isExotic
    ? `${skinCssVars(themeConfig)}\n${loadRecipeCss(themesRoot, themeConfig.recipe)}`
    : loadThemeCss("portfolio", classicSlug);

  const name = esc(displayName(data));
  const navStyle = themeConfig.chrome.nav_style;
  const showNav = themeConfig.chrome.show_nav !== false && navStyle !== "none";
  const topbar = showNav ? siteNavHtml(viewData) : "";
  const plan = effectivePlan(data.plan, config, data.plan_expires);
  const footer = showFoliyoBranding(plan)
    ? `<footer class="site-footer">Made with <a href="https://foliyo.dev">Foliyo</a></footer>`
    : "";
  const resumeHref = `${config.siteUrl.replace(/\/$/, "")}/r/${esc(viewData.download_resume_token ?? "")}`;
  const chrome =
    !galleryOnly && viewData.download_resume_token
      ? `<aside class="print-fab no-print" aria-label="Resume download">
    <a class="print-btn" href="${resumeHref}" target="_blank" rel="noreferrer">Download resume</a>
  </aside>`
      : "";

  const themeClass = isExotic
    ? `theme-portfolio theme-${themeConfig.recipe}`
    : `theme-portfolio theme-${classicSlug}`;

  const body = isExotic
    ? exoticBody(data, themeConfig, config.siteUrl)
    : `${heroHtml(viewData, "portfolio")}${sectionsHtml(viewData, "portfolio", config.siteUrl)}`;

  return documentShell({
    title: `${name} · Foliyo`,
    themeClass,
    css,
    variant: "site",
    topbar,
    body,
    chrome,
    footer,
  });
}

export function renderResumeHtml(
  data: PublicPortfolio,
  resume: ResumeMeta,
  config: Config,
): string {
  const slug = normalizeSlug("resume", resume.theme_slug);
  const css = loadThemeCss("resume", slug);
  const resumeTitle = esc(resume.name || `${displayName(data)} — Resume`);
  const plan = effectivePlan(data.plan, config, data.plan_expires);
  const footer = showFoliyoBranding(plan)
    ? `<footer class="site-footer">Made with <a href="https://foliyo.dev">Foliyo</a></footer>`
    : "";
  const chrome = `<aside class="print-fab no-print" aria-label="Export actions">
    <button type="button" class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </aside>
  <script>
    if (new URLSearchParams(location.search).get("print") === "1") {
      window.addEventListener("load", function () { window.print(); });
    }
  </script>`;

  return documentShell({
    title: resumeTitle,
    themeClass: `theme-resume theme-${slug}`,
    css,
    variant: "document",
    body: resumeBodyHtml(data, slug, config.siteUrl),
    chrome,
    footer,
  });
}

export type BlogListPage = {
  handle: string;
  authorName: string;
  plan: string;
  plan_expires?: string | null;
  posts: Array<{
    title: string;
    slug: string;
    excerpt: string;
    cover_image?: string;
    published_at: string | null;
  }>;
};

export type BlogPostPage = {
  handle: string;
  authorName: string;
  plan: string;
  plan_expires?: string | null;
  post: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    cover_image?: string;
    published_at: string | null;
    tags: string;
  };
};

function absMediaUrl(raw: string | undefined, siteUrl: string): string | null {
  const src = safeMediaUrl(raw);
  if (!src) return null;
  return src.startsWith("/uploads/") ? `${siteUrl.replace(/\/$/, "")}${src}` : src;
}

function writingChrome(handle: string, authorName: string, writingLabel = "Writing"): string {
  const h = esc(handle);
  const label = esc(writingLabel);
  return `<nav class="site-nav" aria-label="Site">
    <div class="site-nav-brand">
      <a class="site-name" href="/u/${h}">${esc(authorName)}</a>
      <a class="handle" href="/u/${h}">@${h}</a>
    </div>
    <div class="site-nav-links">
      <a href="/u/${h}">Portfolio</a>
      <a href="/u/${h}/blog" aria-current="page" class="active">${label}</a>
    </div>
  </nav>`;
}

export function renderBlogListHtml(
  data: BlogListPage,
  config: Config,
  portfolio: PublicPortfolio | null = null,
): string {
  const css = loadThemeCss(
    "portfolio",
    portfolio ? normalizeSlug("portfolio", portfolio.portfolio.theme_slug) : "minimal",
  );
  const plan = effectivePlan(data.plan, config, data.plan_expires);
  const footer = showFoliyoBranding(plan)
    ? `<footer class="site-footer">Made with <a href="https://foliyo.dev">Foliyo</a></footer>`
    : "";
  const site = config.siteUrl.replace(/\/$/, "");
  const writingLabel = portfolio
    ? sectionTitle(portfolio, "posts", "portfolio")
    : "Writing";
  const items = data.posts.length
    ? `<ul class="cards">${data.posts
        .map((p) => {
          const when = p.published_at
            ? `<time datetime="${esc(p.published_at)}">${esc(p.published_at.slice(0, 10))}</time>`
            : "";
          const excerpt = p.excerpt ? `<p>${esc(p.excerpt)}</p>` : "";
          const coverAbs = absMediaUrl(p.cover_image, site);
          const cover = coverAbs
            ? `<img class="post-cover post-cover-list" src="${esc(coverAbs)}" alt="" loading="lazy" />`
            : "";
          return `<li class="post-card">
            ${cover}
            <strong><a href="/u/${esc(data.handle)}/blog/${esc(p.slug)}">${esc(p.title)}</a></strong>
            ${when}${excerpt}
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="muted">No published posts yet.</p>`;

  const topbar = portfolio
    ? siteNavHtml(portfolio, "posts")
    : writingChrome(data.handle, data.authorName, writingLabel);

  return documentShell({
    title: `${esc(data.authorName)} · ${esc(writingLabel)} · Foliyo`,
    themeClass: `theme-portfolio theme-${portfolio ? normalizeSlug("portfolio", portfolio.portfolio.theme_slug) : "minimal"}`,
    css,
    variant: "site",
    topbar,
    description: `${writingLabel} by ${data.authorName}`,
    canonical: `${site}/u/${encodeURIComponent(data.handle)}/blog`,
    ogType: "website",
    body: `<header class="hero"><div><h1>${esc(writingLabel)}</h1><p class="headline">By ${esc(data.authorName)}</p></div></header>
      <section class="section section-posts" id="posts">${items}</section>`,
    footer,
  });
}

export function renderBlogPostHtml(
  data: BlogPostPage,
  config: Config,
  portfolio: PublicPortfolio | null = null,
): string {
  const themeSlug = portfolio
    ? normalizeSlug("portfolio", portfolio.portfolio.theme_slug)
    : "minimal";
  const css = loadThemeCss("portfolio", themeSlug);
  const plan = effectivePlan(data.plan, config, data.plan_expires);
  const footer = showFoliyoBranding(plan)
    ? `<footer class="site-footer">Made with <a href="https://foliyo.dev">Foliyo</a></footer>`
    : "";
  const site = config.siteUrl.replace(/\/$/, "");
  const writingLabel = portfolio
    ? sectionTitle(portfolio, "posts", "portfolio")
    : "Writing";
  const when = data.post.published_at
    ? `<p class="muted"><time datetime="${esc(data.post.published_at)}">${esc(data.post.published_at.slice(0, 10))}</time></p>`
    : "";
  let tagsHtml = "";
  try {
    const tags = JSON.parse(data.post.tags || "[]") as unknown;
    if (Array.isArray(tags) && tags.length) {
      tagsHtml = `<ul class="tags">${tags.map((t) => `<li>${esc(String(t))}</li>`).join("")}</ul>`;
    }
  } catch {
    /* ignore */
  }
  const bodyHtml = markdownToSafeHtml(data.post.content);
  const coverAbs = absMediaUrl(data.post.cover_image, site);
  const cover = coverAbs
    ? `<img class="post-cover post-cover-hero" src="${esc(coverAbs)}" alt="" />`
    : "";
  const canonical = `${site}/u/${encodeURIComponent(data.handle)}/blog/${encodeURIComponent(data.post.slug)}`;
  const description = data.post.excerpt?.trim() || undefined;
  const topbar = portfolio
    ? siteNavHtml(portfolio, "posts")
    : writingChrome(data.handle, data.authorName, writingLabel);

  return documentShell({
    title: `${esc(data.post.title)} · ${esc(data.authorName)} · Foliyo`,
    themeClass: `theme-portfolio theme-${themeSlug}`,
    css,
    variant: "site",
    topbar,
    description,
    ogImage: coverAbs ?? undefined,
    canonical,
    ogType: "article",
    body: `<article class="section section-posts" id="post">
      <header class="hero"><div>
        <h1>${esc(data.post.title)}</h1>
        ${when}
        ${data.post.excerpt ? `<p class="headline">${esc(data.post.excerpt)}</p>` : ""}
        ${tagsHtml}
      </div></header>
      ${cover}
      <div class="prose">${bodyHtml}</div>
      <p class="links"><a href="/u/${esc(data.handle)}/blog">← ${esc(writingLabel)}</a></p>
    </article>`,
    footer,
  });
}
