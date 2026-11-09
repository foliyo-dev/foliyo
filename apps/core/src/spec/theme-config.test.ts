import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  coerceThemeConfig,
  defaultThemeConfig,
  parseThemeConfig,
  resolveThemeConfig,
  serializeThemeConfig,
  skinCssVars,
  themeConfigSchema,
} from "./theme-config.js";

describe("theme-config", () => {
  it("defaults to classic with theme slug", () => {
    const cfg = defaultThemeConfig("noir");
    assert.equal(cfg.recipe, "classic");
    assert.equal(cfg.skin.theme_slug, "noir");
    assert.equal(cfg.version, 1);
  });

  it("parses a photo-hero config", () => {
    const raw = {
      version: 1,
      recipe: "photo-hero",
      skin: {
        colors: { bg: "#0A0E17", ink: "#FFFFFF", muted: "#94A3B8", accent: "#3B82F6" },
        fonts: { heading: "Space Grotesk", body: "Outfit" },
      },
      content: {
        hero: {
          title: "Light, framed into",
          title_accent: "stories that last.",
          subtitle: "Editorial photography",
          cta_primary: "View Portfolio",
        },
        stats: [{ value: "12+", label: "Years behind the lens" }],
        features: [{ title: "Cinematic direction", description: "Mood, light, and motion.", icon: "camera" }],
      },
    };
    const parsed = parseThemeConfig(raw);
    assert.ok(parsed);
    assert.equal(parsed!.recipe, "photo-hero");
    assert.equal(parsed!.content.stats?.length, 1);
  });

  it("parses glassmorphic with glass tokens", () => {
    const parsed = parseThemeConfig({
      version: 1,
      recipe: "glassmorphic",
      skin: {
        colors: { bg: "#0f172a", ink: "#f8fafc", muted: "#94a3b8", accent: "#38bdf8" },
        fonts: { heading: "Sora", body: "DM Sans" },
        glass: { blur: "lg", opacity: "medium", borderGlow: true },
      },
      chrome: { nav_style: "floating-glass" },
    });
    assert.ok(parsed);
    assert.equal(parsed!.skin.glass?.blur, "lg");
    assert.equal(parsed!.chrome.nav_style, "floating-glass");
  });

  it("parses gallery sections_mode", () => {
    const parsed = parseThemeConfig({
      version: 1,
      recipe: "gallery-grid",
      chrome: { sections_mode: "gallery" },
    });
    assert.ok(parsed);
    assert.equal(parsed!.chrome.sections_mode, "gallery");
  });

  it("rejects unknown recipe", () => {
    assert.equal(parseThemeConfig({ version: 1, recipe: "freeform" }), null);
  });

  it("rejects bad hex colors", () => {
    assert.equal(
      parseThemeConfig({
        version: 1,
        recipe: "classic",
        skin: { colors: { bg: "red", ink: "#000", muted: "#111", accent: "#222" } },
      }),
      null,
    );
  });

  it("coerces missing defaults", () => {
    const coerced = coerceThemeConfig({ recipe: "gallery-grid" });
    assert.ok(coerced);
    assert.equal(coerced!.version, 1);
    assert.deepEqual(coerced!.content, {});
  });

  it("resolve falls back to classic", () => {
    const cfg = resolveThemeConfig(null, "atelier");
    assert.equal(cfg.recipe, "classic");
    assert.equal(cfg.skin.theme_slug, "atelier");
  });

  it("serialize round-trips", () => {
    const cfg = themeConfigSchema.parse({
      version: 1,
      recipe: "gallery-grid",
      skin: {
        colors: { bg: "#F5F2E9", ink: "#1c1a17", muted: "#6b6358", accent: "#C45C26" },
        fonts: { heading: "Cormorant Garamond", body: "Outfit" },
      },
      content: { gallery: { columns: 3, caption_mode: "name-category" } },
    });
    const json = serializeThemeConfig(cfg);
    assert.ok(json);
    assert.equal(parseThemeConfig(json)?.recipe, "gallery-grid");
  });

  it("skinCssVars emits CSS custom properties", () => {
    const css = skinCssVars(
      themeConfigSchema.parse({
        version: 1,
        recipe: "glassmorphic",
        skin: {
          colors: { bg: "#0f172a", ink: "#fff", muted: "#aaa", accent: "#38bdf8" },
          fonts: { heading: "Sora", body: "DM Sans" },
          glass: { blur: "md" },
        },
      }),
    );
    assert.match(css, /--bg:#0f172a/);
    assert.match(css, /--glass-blur:18px/);
    assert.match(css, /fonts\.googleapis\.com/);
  });
});
