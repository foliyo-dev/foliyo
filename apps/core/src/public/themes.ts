import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveThemesDir } from "../assets.js";
import type { Config } from "../config.js";
import type { PublicPortfolio } from "./pages.js";
import { effectivePlan, showFoliyoBranding } from "../plan.js";
import {
  resolveSocialUrl,
  socialDisplayLabel,
  socialIconSvg,
} from "../social/providers.js";

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
function projectLinksSite(pr: Record<string, unknown>): string {
  const links: string[] = [];
  if (pr.url) links.push(`<a href="${esc(pr.url)}" rel="noopener noreferrer">Live</a>`);
  if (pr.repo_url) links.push(`<a href="${esc(pr.repo_url)}" rel="noopener noreferrer">Repo</a>`);
  if (pr.article_url) {
    links.push(`<a href="${esc(pr.article_url)}" rel="noopener noreferrer">View write-up</a>`);
  }
  return links.length ? `<p class="links">${links.join(" · ")}</p>` : "";
}

/** Quieter document-style links for resumes (print-friendly). */
function projectLinksDocument(pr: Record<string, unknown>): string {
  const links: string[] = [];
  if (pr.url) {
    const href = String(pr.url);
    links.push(`<a class="doc-link" href="${esc(href)}" rel="noopener noreferrer">${esc(href)}</a>`);
  } else if (pr.repo_url) {
    const href = String(pr.repo_url);
    links.push(`<a class="doc-link" href="${esc(href)}" rel="noopener noreferrer">${esc(href)}</a>`);
  } else if (pr.article_url) {
    const href = String(pr.article_url);
    links.push(`<a class="doc-link" href="${esc(href)}" rel="noopener noreferrer">${esc(href)}</a>`);
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
};

type NavItem = { id: string; label: string };

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

function sectionParts(data: PublicPortfolio, mode: "portfolio" | "resume"): SectionParts {
  const linkFn = mode === "portfolio" ? projectLinksSite : projectLinksDocument;

  const skillsHtml = data.skills.length
    ? sectionTag(
        mode,
        "skills",
        "section-skills",
        mode === "resume"
          ? `<h2>Skills</h2><p class="skills-keywords">${data.skills
              .map((s) => esc(s.name))
              .join(", ")}</p>`
          : `<h2>Skills</h2><ul class="tags">${data.skills
              .map((s) => {
                const recency = String(s.recency ?? "current");
                const meta = ` <span class="muted">${esc(s.level)}</span> <span class="muted">· ${esc(recency)}</span>`;
                return `<li>${esc(s.name)}${meta}</li>`;
              })
              .join("")}</ul>`,
      )
    : "";

  const projectsHtml = data.projects.length
    ? sectionTag(
        mode,
        "projects",
        "section-projects",
        `<h2>Projects</h2><ul class="cards">${data.projects
          .map(
            (pr) =>
              `<li><strong>${esc(pr.title)}</strong>${
                pr.description ? `<p>${esc(pr.description)}</p>` : ""
              }${skillsDevelopedHtml(pr.skills_developed)}${linkFn(pr)}</li>`,
          )
          .join("")}</ul>`,
      )
    : "";

  const expHtml = data.experience.length
    ? sectionTag(
        mode,
        "experience",
        "section-experience",
        `<h2>Experience</h2><ul class="timeline">${data.experience
          .map((e) => {
            const writeUp =
              mode === "portfolio" && e.article_url
                ? `<p class="links"><a href="${esc(e.article_url)}" rel="noopener noreferrer">View write-up</a></p>`
                : mode === "resume" && e.article_url
                  ? `<p class="links doc-links"><a class="doc-link" href="${esc(e.article_url)}" rel="noopener noreferrer">${esc(String(e.article_url))}</a></p>`
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
        `<h2>Education</h2><ul class="timeline">${data.education
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
        `<h2>Certifications</h2><ul class="timeline">${data.certifications
          .map((c) => {
            const cred =
              c.credential_url && mode === "portfolio"
                ? ` <a href="${esc(c.credential_url)}" rel="noopener noreferrer">Credential</a>`
                : c.credential_url && mode === "resume"
                  ? ` <a class="doc-link" href="${esc(c.credential_url)}" rel="noopener noreferrer">Credential</a>`
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
        `<h2>Languages</h2><ul class="tags">${data.languages
          .map((l) => `<li>${esc(l.name)} <span class="muted">${esc(l.proficiency)}</span></li>`)
          .join("")}</ul>`,
      )
    : "";

  return {
    contactHtml: "",
    skillsHtml,
    projectsHtml,
    expHtml,
    eduHtml,
    certHtml,
    langHtml,
  };
}

function navItemsFor(data: PublicPortfolio): NavItem[] {
  const items: NavItem[] = [{ id: "about", label: "About" }];
  if (data.skills.length) items.push({ id: "skills", label: "Skills" });
  if (data.projects.length) items.push({ id: "projects", label: "Projects" });
  if (data.experience.length) items.push({ id: "experience", label: "Experience" });
  if (data.education.length) items.push({ id: "education", label: "Education" });
  if (data.certifications.length) items.push({ id: "certifications", label: "Certifications" });
  if (data.languages.length) items.push({ id: "languages", label: "Languages" });
  return items;
}

function siteNavHtml(data: PublicPortfolio): string {
  const name = esc(displayName(data));
  const handle = data.handle ? esc(data.handle) : "";
  const items = navItemsFor(data)
    .map((item) => `<a href="#${item.id}">${esc(item.label)}</a>`)
    .join("");
  return `<nav class="site-nav" aria-label="Site">
    <div class="site-nav-brand">
      <a class="site-name" href="#about">${name}</a>
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

function sectionsHtml(data: PublicPortfolio, mode: "portfolio" | "resume"): string {
  const p = sectionParts(data, mode);
  const body = `${p.contactHtml}${p.skillsHtml}${p.projectsHtml}${p.expHtml}${p.eduHtml}${p.certHtml}${p.langHtml}`;
  if (mode === "portfolio" && isSparsePortfolio(data) && !body.trim()) {
    return sparseSectionHtml(mode);
  }
  if (mode === "resume" && isSparsePortfolio(data) && !body.trim()) {
    return sparseSectionHtml(mode);
  }
  return body;
}

function resumeBodyHtml(data: PublicPortfolio, slug: string): string {
  const hero = heroHtml(data, "resume");
  if (slug !== "sidebar") {
    return `<div class="resume-sheet">${hero}${sectionsHtml(data, "resume")}</div>`;
  }

  const p = sectionParts(data, "resume");
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

function heroHtml(data: PublicPortfolio, mode: "portfolio" | "resume"): string {
  const name = esc(displayName(data));
  const headline = esc(displayHeadline(data));
  const bio = esc(displayBio(data));
  const desc = esc(String(data.portfolio.description ?? "").trim());
  const avatar = String(data.profile.avatar_url || "").trim();
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
        ${contact}
        ${social}
      </div>
    </header>`;
  }

  return `<header id="about" class="hero">
    ${avatarHtml}
    <div class="hero-text">
      <h1>${name}</h1>
      ${headline ? `<p class="headline">${headline}</p>` : ""}
      ${bio ? `<p class="bio">${bio}</p>` : ""}
      ${desc ? `<p class="desc">${desc}</p>` : ""}
      ${social}
    </div>
  </header>`;
}

const SITE_SHELL_CSS = `
.social-links{display:flex;flex-wrap:wrap;gap:0.5rem;list-style:none;margin:1rem 0 0;padding:0}
.social-links a{display:inline-flex;align-items:center;gap:0.4rem;padding:0.4rem 0.75rem;border-radius:999px;border:1px solid var(--line,#e7e5e4);background:var(--surface,#fff);color:var(--ink,inherit);font-size:0.8125rem;font-weight:500;line-height:1;text-decoration:none;transition:border-color .15s ease,color .15s ease,background .15s ease}
.social-links a:hover{border-color:var(--accent,#0f766e);color:var(--accent,#0f766e)}
.social-links svg{width:1rem;height:1rem;flex-shrink:0;display:block}
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
.site-nav-links a:hover{color:var(--accent,#0f766e)}
.section[id],.hero[id]{scroll-margin-top:4.5rem}
.section-sparse{padding:2rem 0 3rem}
.sparse-copy{margin:0;font-size:0.9375rem;text-align:center;color:var(--muted,#78716c)}
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
  .section,.cards>li,.timeline>li{break-inside:avoid}
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
}): string {
  const shellCss = opts.variant === "site" ? SITE_SHELL_CSS : DOCUMENT_SHELL_CSS;
  const mainClass = opts.variant === "document" ? "page resume-page" : "page";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
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

export function renderPortfolioHtml(data: PublicPortfolio, config: Config): string {
  const slug = normalizeSlug("portfolio", data.portfolio.theme_slug);
  const css = loadThemeCss("portfolio", slug);
  const name = esc(displayName(data));
  const topbar = siteNavHtml(data);
  const plan = effectivePlan(data.plan, config, data.plan_expires);
  const footer = showFoliyoBranding(plan)
    ? `<footer class="site-footer">Made with <a href="https://foliyo.dev">Foliyo</a></footer>`
    : "";

  return documentShell({
    title: `${name} · Foliyo`,
    themeClass: `theme-portfolio theme-${slug}`,
    css,
    variant: "site",
    topbar,
    body: `${heroHtml(data, "portfolio")}${sectionsHtml(data, "portfolio")}`,
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
    body: resumeBodyHtml(data, slug),
    chrome,
    footer,
  });
}
