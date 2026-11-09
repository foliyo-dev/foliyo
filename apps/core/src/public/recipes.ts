import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { absoluteHttpUrl } from "../http-url.js";
import type { ThemeConfig } from "../spec/theme-config.js";
import type { PublicPortfolio } from "./pages.js";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function projectById(data: PublicPortfolio, id?: string): Record<string, unknown> | null {
  if (!id) return null;
  return data.projects.find((p) => String(p.id) === id) ?? null;
}

function resolveImage(
  data: PublicPortfolio,
  siteUrl: string,
  opts: { projectId?: string; url?: string; fallbackProject?: boolean },
): string {
  const fromProject = projectById(data, opts.projectId);
  const raw =
    String(opts.url ?? "").trim() ||
    String(fromProject?.image_url ?? "").trim() ||
    (opts.fallbackProject
      ? String(data.projects.find((p) => String(p.image_url ?? "").trim())?.image_url ?? "").trim()
      : "");
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = siteUrl.replace(/\/$/, "");
  return absoluteHttpUrl(raw.startsWith("/") ? `${base}${raw}` : raw) || raw;
}

function iconGlyph(icon?: string): string {
  const map: Record<string, string> = {
    spark: "✦",
    camera: "◉",
    clock: "◷",
    edit: "✎",
    globe: "◎",
    star: "★",
    heart: "♥",
    layers: "☰",
    zap: "⚡",
    frame: "▢",
  };
  return map[icon ?? ""] ?? "✦";
}

function projectCategory(pr: Record<string, unknown>): string {
  const tags = pr.tags;
  if (Array.isArray(tags) && tags.length) return String(tags[0]);
  if (typeof tags === "string" && tags.trim()) {
    try {
      const parsed = JSON.parse(tags) as unknown;
      if (Array.isArray(parsed) && parsed.length) return String(parsed[0]);
    } catch {
      return tags.split(",")[0]?.trim() || "Project";
    }
  }
  const skills = pr.skills_developed;
  if (typeof skills === "string" && skills.trim()) {
    try {
      const parsed = JSON.parse(skills) as unknown;
      if (Array.isArray(parsed) && parsed.length) return String(parsed[0]);
    } catch {
      /* ignore */
    }
  }
  return "Project";
}

export function loadRecipeCss(themesRoot: string, recipe: string): string {
  const file = join(themesRoot, "portfolio", "recipes", recipe, "style.css");
  if (!existsSync(file)) return `/* missing recipe css: ${recipe} */`;
  return readFileSync(file, "utf8");
}

function titleHtml(config: ThemeConfig, fallback: string): string {
  const hero = config.content.hero;
  const title = hero?.title?.trim() || fallback;
  const accent = hero?.title_accent?.trim();
  if (!accent) return esc(title);
  return `${esc(title)} <span class="accent">${esc(accent)}</span>`;
}

function statsHtml(config: ThemeConfig, className: string): string {
  const stats = config.content.stats ?? [];
  if (!stats.length) return "";
  return `<ul class="${className}">${stats
    .map((s) => `<li><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></li>`)
    .join("")}</ul>`;
}

function featuresHtml(config: ThemeConfig): string {
  const features = config.content.features ?? [];
  if (!features.length) return "";
  return `<ul class="ph-features">${features
    .map(
      (f) => `<li>
      <div class="icon" aria-hidden="true">${iconGlyph(f.icon)}</div>
      <strong>${esc(f.title)}</strong>
      <p>${esc(f.description)}</p>
    </li>`,
    )
    .join("")}</ul>`;
}

function badgesHtml(config: ThemeConfig): string {
  const badges = config.content.hero?.badges ?? [];
  if (!badges.length) return "";
  return badges
    .map((b, i) => {
      const pos = i === 0 ? "ph-badge-tl" : "ph-badge-br";
      return `<span class="ph-badge ${pos}">${esc(b.label)}</span>`;
    })
    .join("");
}

function ctasHtml(
  config: ThemeConfig,
  handle: string,
  primaryClass: string,
  secondaryClass: string,
): string {
  const hero = config.content.hero;
  const primary = hero?.cta_primary?.trim() || "View Portfolio";
  const secondary = hero?.cta_secondary?.trim();
  const home = handle ? `/u/${esc(handle)}` : "#projects";
  const secondaryHref = handle ? `/u/${esc(handle)}#about` : "#about";
  return `<div class="${primaryClass.includes("ph-") ? "ph-ctas" : "gl-ctas"}">
    <a class="${primaryClass}" href="${home}#projects">${esc(primary)}</a>
    ${
      secondary
        ? `<a class="${secondaryClass}" href="${secondaryHref}">${esc(secondary)}</a>`
        : ""
    }
  </div>`;
}

export function renderPhotoHeroBody(
  data: PublicPortfolio,
  config: ThemeConfig,
  siteUrl: string,
  sectionsBelow: string,
): string {
  const name = displayName(data);
  const subtitle =
    config.content.hero?.subtitle?.trim() || displayBio(data) || displayHeadline(data);
  const img = resolveImage(data, siteUrl, {
    projectId: config.content.hero?.image_project_id,
    url: config.content.hero?.image_url,
    fallbackProject: true,
  });
  const about = config.content.about;
  const aboutImg = resolveImage(data, siteUrl, {
    projectId: about?.image_project_id,
    url: about?.image_url,
    fallbackProject: true,
  });
  const detailImg = resolveImage(data, siteUrl, {
    projectId: about?.detail_project_id,
    url: about?.detail_url,
  });

  const aboutBlock =
    about?.title || about?.body || aboutImg
      ? `<section class="ph-about" id="about-person">
      <div class="ph-about-media">
        ${aboutImg ? `<img class="main" src="${esc(aboutImg)}" alt="" />` : `<div class="main"></div>`}
        ${detailImg ? `<img class="detail" src="${esc(detailImg)}" alt="" />` : ""}
      </div>
      <div>
        ${about?.eyebrow ? `<p class="eyebrow">${esc(about.eyebrow)}</p>` : ""}
        <h2>${esc(about?.title || "The person behind the lens")}</h2>
        <p class="body">${esc(about?.body || displayBio(data))}</p>
        ${
          about?.signature_url
            ? `<img src="${esc(about.signature_url)}" alt="" style="max-width:10rem;opacity:.85" />`
            : ""
        }
      </div>
    </section>`
      : "";

  return `<section class="ph-hero" id="about">
    <div class="ph-copy">
      <p class="eyebrow">${esc(config.content.brand?.name || name)}</p>
      <h1>${titleHtml(config, displayHeadline(data) || name)}</h1>
      ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
      ${ctasHtml(config, data.handle, "ph-btn ph-btn-primary", "ph-btn ph-btn-secondary")}
      ${statsHtml(config, "ph-stats")}
    </div>
    <div class="ph-media">
      ${img ? `<img class="ph-portrait" src="${esc(img)}" alt="" />` : `<div class="ph-portrait" style="background:var(--surface);border-radius:var(--radius);min-height:28rem"></div>`}
      ${badgesHtml(config)}
    </div>
  </section>
  ${featuresHtml(config)}
  ${aboutBlock}
  ${sectionsBelow}`;
}

export function renderGalleryGridBody(
  data: PublicPortfolio,
  config: ThemeConfig,
  siteUrl: string,
  sectionsBelow: string,
): string {
  const name = displayName(data);
  const brand = config.content.brand;
  const monogram =
    brand?.monogram?.trim() ||
    name
      .split(/\s+/)
      .map((p) => p[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    "F";
  const title = config.content.hero?.title?.trim() || `Hello, I am ${name.split(" ")[0] || name}!`;
  const bio = config.content.hero?.subtitle?.trim() || displayBio(data);
  const cta = config.content.hero?.cta_primary?.trim() || "Contact me";
  const gallery = config.content.gallery;
  const columns = gallery?.columns === 2 ? 2 : 3;
  const captionMode = gallery?.caption_mode ?? "name-category";
  const handle = data.handle ? esc(data.handle) : "";

  const tiles = data.projects
    .map((pr) => {
      const img = resolveImage(data, siteUrl, { url: String(pr.image_url ?? "") });
      const cat = projectCategory(pr);
      let caption = "";
      if (captionMode === "title") caption = esc(pr.title);
      else if (captionMode === "name-category") {
        caption = `${esc(pr.title)} <span class="cat">— ${esc(cat)}</span>`;
      }
      return `<li><figure>
        ${img ? `<img src="${esc(img)}" alt="" />` : `<div class="gg-empty">No image</div>`}
        ${caption ? `<figcaption>${caption}</figcaption>` : ""}
      </figure></li>`;
    })
    .join("");

  return `<header class="gg-hero" id="about">
    <div class="gg-monogram" aria-hidden="true">${esc(monogram)}</div>
    <h1><span class="mark">${esc(title)}</span></h1>
    ${bio ? `<p class="bio">${esc(bio)}</p>` : ""}
    <a class="gg-cta" href="${handle ? `mailto:${esc(data.profile.email || "")}` : "#about"}">${esc(cta)}</a>
  </header>
  <section class="gg-gallery" id="projects">
    <div class="gg-gallery-head">
      <h2>${esc(gallery?.title || "Project Gallery")}</h2>
      <p>Selected work</p>
    </div>
    <ul class="gg-grid cols-${columns}">${tiles || `<li><div class="gg-empty">Add projects with images</div></li>`}</ul>
  </section>
  ${sectionsBelow}`;
}

export function renderGlassmorphicBody(
  data: PublicPortfolio,
  config: ThemeConfig,
  siteUrl: string,
  sectionsBelow: string,
): string {
  const name = displayName(data);
  const subtitle =
    config.content.hero?.subtitle?.trim() || displayBio(data) || displayHeadline(data);
  const img = resolveImage(data, siteUrl, {
    projectId: config.content.hero?.image_project_id,
    url: config.content.hero?.image_url,
    fallbackProject: true,
  });

  const glazed = sectionsBelow.replace(/class="section /g, 'class="section glass ');

  return `<section class="gl-hero glass" id="about">
    <div>
      <h1>${titleHtml(config, displayHeadline(data) || name)}</h1>
      ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
      ${ctasHtml(config, data.handle, "gl-btn gl-btn-primary", "gl-btn gl-btn-secondary")}
      ${statsHtml(config, "gl-stats")}
    </div>
    <div class="gl-hero-media">
      ${img ? `<img src="${esc(img)}" alt="" />` : ""}
    </div>
  </section>
  ${glazed}`;
}
