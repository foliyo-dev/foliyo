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

function projectLinks(pr: Record<string, unknown>): string {
  const links: string[] = [];
  if (pr.url) links.push(`<a href="${esc(pr.url)}" rel="noopener noreferrer">Live</a>`);
  if (pr.repo_url) links.push(`<a href="${esc(pr.repo_url)}" rel="noopener noreferrer">Repo</a>`);
  if (pr.article_url) {
    links.push(`<a href="${esc(pr.article_url)}" rel="noopener noreferrer">View write-up</a>`);
  }
  return links.length ? `<p class="links">${links.join(" · ")}</p>` : "";
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

function sectionParts(
  data: PublicPortfolio,
  mode: "portfolio" | "resume",
  opts?: { contactJoin?: string },
): SectionParts {
  const skillsHtml = data.skills.length
    ? `<section class="section section-skills"><h2>Skills</h2><ul class="tags">${
      data.skills
        .map((s) => `<li>${esc(s.name)} <span class="muted">${esc(s.level)}</span></li>`)
        .join("")
    }</ul></section>`
    : "";

  const projectsHtml = data.projects.length
    ? `<section class="section section-projects"><h2>Projects</h2><ul class="cards">${
      data.projects
        .map(
          (pr) =>
            `<li><strong>${esc(pr.title)}</strong>${
              pr.description ? `<p>${esc(pr.description)}</p>` : ""
            }${projectLinks(pr)}</li>`,
        )
        .join("")
    }</ul></section>`
    : "";

  const expHtml = data.experience.length
    ? `<section class="section section-experience"><h2>Experience</h2><ul class="timeline">${
      data.experience
        .map(
          (e) =>
            `<li>
              <div class="item-head">
                <strong>${esc(e.role)}</strong>
                <span class="muted">${esc(e.start_date)} – ${e.end_date ? esc(e.end_date) : "Present"}</span>
              </div>
              <div class="item-sub">${esc(e.company)}${e.location ? ` · ${esc(e.location)}` : ""}</div>
              ${e.description ? `<p>${esc(e.description)}</p>` : ""}
              ${
                e.article_url
                  ? `<p class="links"><a href="${esc(e.article_url)}" rel="noopener noreferrer">View write-up</a></p>`
                  : ""
              }
            </li>`,
        )
        .join("")
    }</ul></section>`
    : "";

  const eduHtml = data.education.length
    ? `<section class="section section-education"><h2>Education</h2><ul class="timeline">${
      data.education
        .map(
          (e) =>
            `<li>
              <div class="item-head">
                <strong>${esc(e.institution)}</strong>
                <span class="muted">${esc(e.start_date)}${e.end_date ? ` – ${esc(e.end_date)}` : ""}</span>
              </div>
              <div class="item-sub">${[e.degree, e.field].filter(Boolean).map(esc).join(" · ")}</div>
            </li>`,
        )
        .join("")
    }</ul></section>`
    : "";

  const certHtml = data.certifications.length
    ? `<section class="section section-certs"><h2>Certifications</h2><ul class="timeline">${
      data.certifications
        .map(
          (c) =>
            `<li>
              <strong>${esc(c.name)}</strong>${c.issuer ? ` — ${esc(c.issuer)}` : ""}
              ${c.issued_at ? ` <span class="muted">${esc(c.issued_at)}</span>` : ""}
              ${
                c.credential_url
                  ? ` <a href="${esc(c.credential_url)}" rel="noopener noreferrer">Credential</a>`
                  : ""
              }
            </li>`,
        )
        .join("")
    }</ul></section>`
    : "";

  const langHtml = data.languages.length
    ? `<section class="section section-languages"><h2>Languages</h2><ul class="tags">${
      data.languages
        .map((l) => `<li>${esc(l.name)} <span class="muted">${esc(l.proficiency)}</span></li>`)
        .join("")
    }</ul></section>`
    : "";

  const contactBits: string[] = [];
  const profile = data.profile;
  if (profile.email) contactBits.push(`<a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>`);
  if (profile.location) contactBits.push(`<span>${esc(profile.location)}</span>`);

  const contactHtml =
    mode === "resume" && contactBits.length
      ? `<p class="contact">${contactBits.join(opts?.contactJoin ?? " · ")}</p>`
      : "";

  return { contactHtml, skillsHtml, projectsHtml, expHtml, eduHtml, certHtml, langHtml };
}

function sectionsHtml(data: PublicPortfolio, mode: "portfolio" | "resume"): string {
  const p = sectionParts(data, mode);
  return `${p.contactHtml}${p.skillsHtml}${p.projectsHtml}${p.expHtml}${p.eduHtml}${p.certHtml}${p.langHtml}`;
}

function resumeBodyHtml(data: PublicPortfolio, slug: string): string {
  const hero = heroHtml(data, "resume");
  if (slug !== "sidebar") {
    return `${hero}${sectionsHtml(data, "resume")}`;
  }

  const p = sectionParts(data, "resume", { contactJoin: "" });
  return `<div class="resume-layout">
    <aside class="resume-sidebar">
      ${hero}
      ${p.contactHtml}
      ${p.skillsHtml}
      ${p.langHtml}
      ${p.certHtml}
    </aside>
    <div class="resume-main">
      ${p.expHtml}
      ${p.eduHtml}
      ${p.projectsHtml}
    </div>
  </div>`;
}

function socialLinksHtml(data: PublicPortfolio): string {
  const links = data.social_links ?? [];
  if (!links.length) return "";
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
  const social = socialLinksHtml(data);

  if (mode === "resume") {
    return `<header class="hero">
      <div>
        <h1>${name}</h1>
        ${headline ? `<p class="headline">${headline}</p>` : ""}
        ${social}
      </div>
    </header>`;
  }

  return `<header class="hero">
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

function documentShell(opts: {
  title: string;
  themeClass: string;
  css: string;
  body: string;
  topbar?: string;
  /** UI chrome outside the resume/portfolio document (e.g. floating print). */
  chrome?: string;
  footer?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  <link rel="icon" href="/static/images/foliyo-icon.svg" type="image/svg+xml">
  <style>${opts.css}
.social-links{display:flex;flex-wrap:wrap;gap:0.5rem;list-style:none;margin:1rem 0 0;padding:0}
.social-links a{display:inline-flex;align-items:center;gap:0.4rem;padding:0.4rem 0.75rem;border-radius:999px;border:1px solid var(--line,#e7e5e4);background:var(--surface,#fff);color:var(--ink,inherit);font-size:0.8125rem;font-weight:500;line-height:1;text-decoration:none;transition:border-color .15s ease,color .15s ease,background .15s ease}
.social-links a:hover{border-color:var(--accent,#0f766e);color:var(--accent,#0f766e)}
.social-links svg{width:1rem;height:1rem;flex-shrink:0;display:block}
.theme-creative .social-links a{background:rgba(255,255,255,.08);border-color:rgba(232,196,160,.35);color:#f8f1e8}
.theme-creative .social-links a:hover{border-color:#e8c4a0;color:#f0a06a;background:rgba(255,255,255,.12)}
.theme-noir .social-links a{background:var(--surface,#181b22);border-color:var(--line,#2a2e36);color:var(--ink,#e8e6e3)}
.theme-noir .social-links a:hover{border-color:var(--accent,#d4a574);color:var(--accent,#d4a574)}
</style>
</head>
<body class="${opts.themeClass}">
  ${opts.topbar ?? ""}
  <main class="page">
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
  const topbar = `<nav class="topbar">
    <a class="brand" href="/">Foliyo</a>
    ${data.handle ? `<a class="handle" href="/u/${esc(data.handle)}">@${esc(data.handle)}</a>` : ""}
  </nav>`;
  const plan = effectivePlan(data.plan, config, data.plan_expires);
  const footer = showFoliyoBranding(plan)
    ? `<footer class="site-footer">Made with <a href="https://foliyo.dev">Foliyo</a></footer>`
    : "";

  return documentShell({
    title: `${name} · Foliyo`,
    themeClass: `theme-portfolio theme-${slug}`,
    css,
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
    body: resumeBodyHtml(data, slug),
    chrome,
    footer,
  });
}
