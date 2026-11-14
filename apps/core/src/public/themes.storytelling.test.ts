import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Config } from "../config.js";
import type { PublicPortfolio } from "./pages.js";
import { renderPortfolioHtml, renderResumeHtml } from "./themes.js";

const baseConfig = {
  siteUrl: "http://localhost:8080",
  mode: "oss",
} as unknown as Config;

function sampleData(overrides: Partial<PublicPortfolio["portfolio"]> = {}): PublicPortfolio {
  return {
    portfolio: {
      id: "p1",
      name: "Demo",
      headline: "Builder",
      bio: "Ships tools",
      theme_slug: "minimal",
      theme_config: null,
      show_skills: 1,
      show_projects: 1,
      show_experience: 0,
      show_education: 0,
      show_certifications: 0,
      show_languages: 0,
      show_posts: 0,
      show_skill_levels: 0,
      projects_layout: "featured_timeline",
      hero_cta_primary: "View work",
      hero_cta_secondary: "Contact",
      ...overrides,
    },
    profile: {
      name: "Ada Lovelace",
      headline: "Engineer",
      bio: "Notes",
      email: "ada@example.com",
    },
    skills: [
      { id: "s1", name: "TypeScript", level: "expert", category: "languages" },
      { id: "s2", name: "Go", level: "advanced", category: "languages" },
    ],
    projects: [
      {
        id: "pr1",
        title: "MeshQL",
        description: "Field selection for REST",
        featured: 1,
        start_date: "2025-01",
        end_date: null,
        skills_developed: '["typescript"]',
        sort_order: 0,
      },
      {
        id: "pr2",
        title: "ERDLens",
        description: "Postgres ERD viewer",
        featured: 0,
        start_date: "2024-06",
        end_date: "2024-12",
        skills_developed: '["go"]',
        sort_order: 1,
      },
    ],
    experience: [],
    education: [],
    certifications: [],
    languages: [],
    posts: [],
    social_links: [],
    handle: "ada",
    plan: "pro",
  };
}

describe("portfolio storytelling rendering", () => {
  it("orders projects before skills and emits hero CTAs", () => {
    const html = renderPortfolioHtml(sampleData(), baseConfig);
    const projectsIdx = html.indexOf('id="projects"');
    const skillsIdx = html.indexOf('id="skills"');
    assert.ok(projectsIdx > 0 && skillsIdx > 0);
    assert.ok(projectsIdx < skillsIdx, "projects section should precede skills");
    assert.match(html, /class="hero-cta hero-cta-primary"[^>]*>View work</);
    assert.match(html, /class="hero-cta hero-cta-secondary"[^>]*>Contact</);
    assert.match(html, /mailto:ada@example\.com/);
  });

  it("hides skill levels by default and shows when enabled", () => {
    const off = renderPortfolioHtml(sampleData({ show_skill_levels: 0 }), baseConfig);
    assert.doesNotMatch(off, /TypeScript[\s\S]*?<span class="muted">expert<\/span>/);

    const on = renderPortfolioHtml(sampleData({ show_skill_levels: 1 }), baseConfig);
    assert.match(on, /TypeScript <span class="muted">expert<\/span>/);
  });

  it("featured_timeline shows featured cards and build-log timeline", () => {
    const html = renderPortfolioHtml(sampleData({ projects_layout: "featured_timeline" }), baseConfig);
    assert.match(html, /class="cards featured-projects"/);
    assert.match(html, /MeshQL/);
    assert.match(html, /project-log-heading/);
    assert.match(html, /project-timeline/);
    assert.match(html, /2024-06 – 2024-12/);
    assert.match(html, /ERDLens/);
  });

  it("timeline layout sorts by start_date descending", () => {
    const html = renderPortfolioHtml(sampleData({ projects_layout: "timeline" }), baseConfig);
    assert.doesNotMatch(html, /featured-projects/);
    assert.match(html, /project-timeline/);
    const mesh = html.indexOf("MeshQL");
    const erd = html.indexOf("ERDLens");
    assert.ok(mesh > 0 && erd > 0);
    assert.ok(mesh < erd, "newer MeshQL should appear before older ERDLens");
  });

  it("resume keeps skills before projects and ignores storytelling layout", () => {
    const html = renderResumeHtml(
      sampleData({ projects_layout: "featured_timeline", show_skill_levels: 1 }),
      { name: "Resume", theme_slug: "classic" },
      baseConfig,
    );
    const skillsIdx = html.indexOf("Skills");
    const projectsIdx = html.indexOf("Projects");
    assert.ok(skillsIdx > 0 && projectsIdx > 0);
    assert.ok(skillsIdx < projectsIdx);
    assert.doesNotMatch(html, /hero-cta/);
    assert.doesNotMatch(html, /project-timeline/);
  });
});
