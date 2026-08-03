import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "../config.js";
import type { PublicPortfolio } from "./pages.js";
import { effectivePlan, showFoliyoBranding } from "../plan.js";

const PORTFOLIO_SLUGS = new Set(["minimal", "modern", "creative"]);
const RESUME_SLUGS = new Set(["classic", "compact", "academic"]);

const themesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/themes",
);

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

function sectionsHtml(data: PublicPortfolio, mode: "portfolio" | "resume"): string {
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
  if (profile.website) {
    contactBits.push(`<a href="${esc(profile.website)}" rel="noopener noreferrer">Website</a>`);
  }
  if (profile.github) {
    contactBits.push(
      `<a href="https://github.com/${esc(profile.github)}" rel="noopener noreferrer">GitHub</a>`,
    );
  }
  if (profile.linkedin) {
    contactBits.push(
      `<a href="https://linkedin.com/in/${esc(profile.linkedin)}" rel="noopener noreferrer">LinkedIn</a>`,
    );
  }
  if (profile.location) contactBits.push(`<span>${esc(profile.location)}</span>`);

  const contactHtml =
    mode === "resume" && contactBits.length
      ? `<p class="contact">${contactBits.join(" · ")}</p>`
      : "";

  return `${contactHtml}${skillsHtml}${projectsHtml}${expHtml}${eduHtml}${certHtml}${langHtml}`;
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

  if (mode === "resume") {
    return `<header class="hero">
      <div>
        <h1>${name}</h1>
        ${headline ? `<p class="headline">${headline}</p>` : ""}
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
    </div>
  </header>`;
}

function documentShell(opts: {
  title: string;
  themeClass: string;
  css: string;
  body: string;
  topbar?: string;
  footer?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  <link rel="icon" href="/static/images/foliyo-icon.svg" type="image/svg+xml">
  <style>${opts.css}</style>
</head>
<body class="${opts.themeClass}">
  ${opts.topbar ?? ""}
  <main class="page">
    ${opts.body}
  </main>
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
  const plan = effectivePlan(data.plan, config);
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
  const plan = effectivePlan(data.plan, config);
  const footer = showFoliyoBranding(plan)
    ? `<footer class="site-footer">Made with <a href="https://foliyo.dev">Foliyo</a></footer>`
    : "";
  const toolbar = `<div class="resume-toolbar no-print">
    <button type="button" class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    <span class="print-hint">Use your browser print dialog → Save as PDF</span>
  </div>
  <script>
    if (new URLSearchParams(location.search).get("print") === "1") {
      window.addEventListener("load", function () { window.print(); });
    }
  </script>`;

  return documentShell({
    title: resumeTitle,
    themeClass: `theme-resume theme-${slug}`,
    css,
    body: `${toolbar}${heroHtml(data, "resume")}${sectionsHtml(data, "resume")}`,
    footer,
  });
}
