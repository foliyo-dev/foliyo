import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Config } from "../config.js";
import { themeConfigSchema } from "../spec/theme-config.js";
import type { PublicPortfolio } from "./pages.js";
import { renderPortfolioHtml } from "./themes.js";

const baseConfig = {
  siteUrl: "http://localhost:8080",
  mode: "oss",
} as unknown as Config;

function sampleData(themeConfig: unknown, themeSlug = "minimal"): PublicPortfolio {
  return {
    portfolio: {
      id: "p1",
      name: "Demo",
      headline: "Light, framed into stories",
      bio: "Editorial photography",
      theme_slug: themeSlug,
      theme_config: themeConfig == null ? null : JSON.stringify(themeConfig),
      show_skills: 1,
      show_projects: 1,
      show_experience: 0,
      show_education: 0,
      show_certifications: 0,
      show_languages: 0,
      show_posts: 0,
    },
    profile: { name: "Elena Reyes", headline: "Photographer", bio: "Lisbon-based" },
    skills: [{ id: "s1", name: "Lighting", category: "Craft" }],
    projects: [
      {
        id: "pr1",
        title: "Viggo",
        description: "Portrait series",
        image_url: "https://example.com/a.jpg",
        tags: '["Illustration"]',
      },
      {
        id: "pr2",
        title: "Hotel",
        description: "Brand",
        image_url: "https://example.com/b.jpg",
        tags: '["Branding"]',
      },
    ],
    experience: [],
    education: [],
    certifications: [],
    languages: [],
    posts: [],
    social_links: [],
    handle: "elena",
    plan: "pro",
  };
}

describe("portfolio recipe rendering", () => {
  it("classic null theme_config stays theme-{slug}", () => {
    const html = renderPortfolioHtml(sampleData(null, "noir"), baseConfig);
    assert.match(html, /class="theme-portfolio theme-noir"/);
    assert.match(html, /<header id="about" class="hero">/);
    assert.doesNotMatch(html, /theme-photo-hero/);
  });

  it("photo-hero emits recipe chrome", () => {
    const cfg = themeConfigSchema.parse({
      version: 1,
      recipe: "photo-hero",
      skin: {
        colors: { bg: "#0A0E17", ink: "#fff", muted: "#94a3b8", accent: "#3B82F6" },
        fonts: { heading: "Space Grotesk", body: "Outfit" },
      },
      content: {
        hero: { title: "Light, framed into", title_accent: "stories that last." },
        stats: [{ value: "12+", label: "Years" }],
        features: [{ title: "Cinematic", description: "Mood and light", icon: "camera" }],
      },
    });
    const html = renderPortfolioHtml(sampleData(cfg), baseConfig);
    assert.match(html, /theme-photo-hero/);
    assert.match(html, /ph-hero/);
    assert.match(html, /stories that last/);
    assert.match(html, /ph-features/);
  });

  it("gallery-grid emits image grid", () => {
    const cfg = themeConfigSchema.parse({
      version: 1,
      recipe: "gallery-grid",
      skin: {
        colors: { bg: "#F5F2E9", ink: "#1c1a17", muted: "#6b6358", accent: "#C45C26" },
        fonts: { heading: "Cormorant Garamond", body: "Outfit" },
      },
      content: {
        brand: { monogram: "ER" },
        gallery: { columns: 3, caption_mode: "name-category" },
      },
    });
    const html = renderPortfolioHtml(sampleData(cfg), baseConfig);
    assert.match(html, /theme-gallery-grid/);
    assert.match(html, /gg-grid/);
    assert.match(html, /gg-monogram/);
    assert.match(html, /Viggo/);
  });

  it("glassmorphic emits frosted panels", () => {
    const cfg = themeConfigSchema.parse({
      version: 1,
      recipe: "glassmorphic",
      skin: {
        colors: { bg: "#0B1224", ink: "#F8FAFC", muted: "#B6C2D9", accent: "#38BDF8" },
        fonts: { heading: "Sora", body: "DM Sans" },
        glass: { blur: "lg", opacity: "medium", borderGlow: true },
      },
      chrome: { nav_style: "floating-glass" },
    });
    const html = renderPortfolioHtml(sampleData(cfg), baseConfig);
    assert.match(html, /theme-glassmorphic/);
    assert.match(html, /gl-hero glass/);
    assert.match(html, /--glass-blur/);
    assert.match(html, /backdrop-filter/);
  });

  it("gallery sections_mode hides library chrome", () => {
    const cfg = themeConfigSchema.parse({
      version: 1,
      recipe: "classic",
      chrome: { sections_mode: "gallery" },
    });
    const data = sampleData(cfg, "minimal");
    data.download_resume_token = "tok123";
    data.skills = [{ id: "s1", name: "Lighting", category: "Craft" }];
    data.experience = [{ id: "e1", company: "Studio", title: "Lead" }];
    const html = renderPortfolioHtml(data, baseConfig);
    assert.doesNotMatch(html, /section-skills/);
    assert.doesNotMatch(html, /section-experience/);
    assert.doesNotMatch(html, /Download resume/);
    assert.match(html, /Viggo/);
  });
});
