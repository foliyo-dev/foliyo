import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Config } from "../config.js";
import type { PublicPortfolio } from "./pages.js";
import {
  renderBlogListHtml,
  renderBlogPostHtml,
  renderPortfolioHtml,
  renderResumeHtml,
} from "./themes.js";

const baseConfig = {
  siteUrl: "http://localhost:8080",
  mode: "oss",
} as unknown as Config;

function sampleData(overrides: Partial<PublicPortfolio["portfolio"]> = {}): PublicPortfolio {
  return {
    portfolio: {
      id: "p1",
      name: "Demo",
      slug: "side",
      is_default: 0,
      headline: "Builder of careful tools",
      bio: "A longer bio that should only appear when headline is missing from the portfolio SEO description.",
      theme_slug: "minimal",
      theme_config: null,
      show_skills: 1,
      show_projects: 1,
      show_experience: 0,
      show_education: 0,
      show_certifications: 0,
      show_languages: 0,
      show_posts: 0,
      ...overrides,
    },
    profile: {
      name: "Ada Lovelace",
      headline: "Engineer",
      bio: "Notes",
      email: "ada@example.com",
      avatar_url: "https://example.com/avatar.jpg",
    },
    skills: [],
    projects: [
      {
        id: "pr1",
        title: "MeshQL",
        description: "Field selection",
        image_url: "https://example.com/project.jpg",
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

describe("portfolio SEO meta", () => {
  it("emits description, canonical, og, and twitter tags for public portfolios", () => {
    const html = renderPortfolioHtml(sampleData(), baseConfig);

    assert.match(html, /<meta name="description" content="Builder of careful tools">/);
    assert.match(
      html,
      /<link rel="canonical" href="http:\/\/localhost:8080\/u\/ada\/side">/,
    );
    assert.match(html, /<meta property="og:title" content="Ada Lovelace · Foliyo">/);
    assert.match(html, /<meta property="og:type" content="website">/);
    assert.match(html, /<meta property="og:description" content="Builder of careful tools">/);
    assert.match(
      html,
      /<meta property="og:url" content="http:\/\/localhost:8080\/u\/ada\/side">/,
    );
    assert.match(html, /<meta property="og:image" content="https:\/\/example.com\/project.jpg">/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
    assert.match(html, /<meta name="twitter:title" content="Ada Lovelace · Foliyo">/);
    assert.match(html, /<meta name="twitter:description" content="Builder of careful tools">/);
    assert.match(html, /<meta name="twitter:image" content="https:\/\/example.com\/project.jpg">/);
    assert.doesNotMatch(html, /name="robots"/);
  });

  it("uses /u/{handle} canonical for the default portfolio", () => {
    const html = renderPortfolioHtml(
      sampleData({ is_default: 1, slug: "main" }),
      baseConfig,
    );
    assert.match(
      html,
      /<link rel="canonical" href="http:\/\/localhost:8080\/u\/ada">/,
    );
    assert.match(
      html,
      /<meta property="og:url" content="http:\/\/localhost:8080\/u\/ada">/,
    );
  });

  it("falls back to truncated bio when headline is empty", () => {
    const longBio =
      "x".repeat(170) + " should truncate for meta description length limits in crawlers.";
    const data = sampleData({ headline: "", bio: longBio });
    data.profile = { ...data.profile, headline: "", bio: "" };
    const html = renderPortfolioHtml(data, baseConfig);
    assert.match(html, /<meta name="description" content="x{159}…">/);
  });

  it("marks private portfolio shares noindex", () => {
    const html = renderPortfolioHtml(sampleData(), baseConfig, {
      robots: "noindex, nofollow",
    });
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  });

  it("marks private resume shares noindex", () => {
    const html = renderResumeHtml(
      sampleData(),
      { name: "Ada Resume", theme_slug: "minimal" },
      baseConfig,
      { robots: "noindex, nofollow" },
    );
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(html, /<meta name="description" content="Builder of careful tools">/);
  });
});

describe("blog SEO parity", () => {
  it("falls back blog post description to title when excerpt is empty", () => {
    const html = renderBlogPostHtml(
      {
        handle: "ada",
        authorName: "Ada Lovelace",
        plan: "pro",
        post: {
          title: "Hello mesh",
          slug: "hello-mesh",
          excerpt: "",
          content: "# Hi",
          cover_image: "https://example.com/cover.jpg",
          published_at: "2026-01-01T00:00:00.000Z",
          tags: "[]",
        },
      },
      baseConfig,
    );
    assert.match(html, /<meta name="description" content="Hello mesh">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/example.com\/cover.jpg">/);
  });

  it("sets blog list og:image from the first cover when available", () => {
    const html = renderBlogListHtml(
      {
        handle: "ada",
        authorName: "Ada Lovelace",
        plan: "pro",
        posts: [
          {
            title: "One",
            slug: "one",
            excerpt: "First",
            cover_image: "https://example.com/list-cover.jpg",
            published_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      baseConfig,
    );
    assert.match(html, /<meta name="description" content="Writing by Ada Lovelace">/);
    assert.match(
      html,
      /<link rel="canonical" href="http:\/\/localhost:8080\/u\/ada\/blog">/,
    );
    assert.match(
      html,
      /<meta property="og:image" content="https:\/\/example.com\/list-cover.jpg">/,
    );
  });
});
