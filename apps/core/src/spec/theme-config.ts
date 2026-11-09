import { z } from "zod";

export const FOLIYO_THEME_SCHEMA = "https://spec.foliyo.dev/theme/v1";
export const FOLIYO_THEME_VERSION = 1;

export const THEME_RECIPES = ["classic", "photo-hero", "gallery-grid", "glassmorphic"] as const;
export type ThemeRecipe = (typeof THEME_RECIPES)[number];

export const CLASSIC_THEME_SLUGS = [
  "minimal",
  "modern",
  "creative",
  "noir",
  "atelier",
  "editorial",
  "custom",
] as const;

export const ALLOWED_FONTS = [
  "Inter",
  "Outfit",
  "DM Sans",
  "Space Grotesk",
  "Sora",
  "Manrope",
  "Cormorant Garamond",
  "Playfair Display",
  "Libre Baskerville",
  "Lora",
  "Source Serif 4",
  "Instrument Serif",
  "Fraunces",
  "IBM Plex Sans",
  "IBM Plex Serif",
  "JetBrains Mono",
] as const;

export const FEATURE_ICONS = [
  "spark",
  "camera",
  "clock",
  "edit",
  "globe",
  "star",
  "heart",
  "layers",
  "zap",
  "frame",
] as const;

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "must be a hex color");

const optionalUrl = z
  .string()
  .max(2048)
  .refine((v) => !v || /^https?:\/\//i.test(v), "must be an http(s) URL")
  .optional();

const badgeSchema = z.object({
  label: z.string().min(1).max(60),
  tone: z.enum(["accent", "muted", "success"]).optional(),
});

const statSchema = z.object({
  value: z.string().min(1).max(24),
  label: z.string().min(1).max(80),
});

const featureSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  icon: z.enum(FEATURE_ICONS).optional(),
});

const glassSchema = z.object({
  blur: z.enum(["sm", "md", "lg"]).optional(),
  opacity: z.enum(["light", "medium", "heavy"]).optional(),
  borderGlow: z.boolean().optional(),
});

const skinSchema = z.object({
  theme_slug: z.enum(CLASSIC_THEME_SLUGS).optional(),
  colors: z
    .object({
      bg: hexColor,
      ink: hexColor,
      muted: hexColor,
      accent: hexColor,
      accentSoft: hexColor.optional(),
    })
    .optional(),
  fonts: z
    .object({
      heading: z.enum(ALLOWED_FONTS),
      body: z.enum(ALLOWED_FONTS),
    })
    .optional(),
  radius: z.enum(["sharp", "soft", "pill"]).optional(),
  density: z.enum(["airy", "cozy"]).optional(),
  glass: glassSchema.optional(),
});

const contentSchema = z.object({
  brand: z
    .object({
      name: z.string().max(80).optional(),
      monogram: z.string().max(4).optional(),
      logo_url: optionalUrl,
    })
    .optional(),
  hero: z
    .object({
      title: z.string().min(1).max(160).optional(),
      title_accent: z.string().max(80).optional(),
      subtitle: z.string().max(400).optional(),
      cta_primary: z.string().max(40).optional(),
      cta_secondary: z.string().max(40).optional(),
      image_project_id: z.string().max(64).optional(),
      image_url: optionalUrl,
      badges: z.array(badgeSchema).max(4).optional(),
    })
    .optional(),
  stats: z.array(statSchema).max(6).optional(),
  features: z.array(featureSchema).max(6).optional(),
  about: z
    .object({
      eyebrow: z.string().max(60).optional(),
      title: z.string().max(160).optional(),
      body: z.string().max(2000).optional(),
      signature_url: optionalUrl,
      image_project_id: z.string().max(64).optional(),
      detail_project_id: z.string().max(64).optional(),
      image_url: optionalUrl,
      detail_url: optionalUrl,
    })
    .optional(),
  gallery: z
    .object({
      title: z.string().max(80).optional(),
      caption_mode: z.enum(["name-category", "title", "none"]).optional(),
      columns: z.union([z.literal(2), z.literal(3)]).optional(),
    })
    .optional(),
});

const chromeSchema = z.object({
  show_nav: z.boolean().optional(),
  nav_style: z.enum(["sticky", "minimal", "none", "floating-glass"]).optional(),
  /**
   * `gallery` — photo-folio mode: keep hero/gallery/about chrome, hide skills /
   * experience / education / certifications / languages / resume download.
   */
  sections_mode: z.enum(["full", "gallery"]).optional(),
});

export const themeConfigSchema = z.object({
  version: z.literal(FOLIYO_THEME_VERSION),
  recipe: z.enum(THEME_RECIPES),
  skin: skinSchema.default({}),
  content: contentSchema.default({}),
  chrome: chromeSchema.default({}),
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;

export function isGallerySectionsMode(config: ThemeConfig | null | undefined): boolean {
  return config?.chrome?.sections_mode === "gallery";
}

export function defaultThemeConfig(themeSlug = "minimal"): ThemeConfig {
  const slug = CLASSIC_THEME_SLUGS.includes(themeSlug as (typeof CLASSIC_THEME_SLUGS)[number])
    ? (themeSlug as (typeof CLASSIC_THEME_SLUGS)[number])
    : "minimal";
  return {
    version: FOLIYO_THEME_VERSION,
    recipe: "classic",
    skin: { theme_slug: slug === "custom" ? "minimal" : slug },
    content: {},
    chrome: {},
  };
}

/** Parse + validate ThemeConfig; returns null for empty/invalid input. */
export function parseThemeConfig(raw: unknown): ThemeConfig | null {
  if (raw == null || raw === "") return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  const parsed = themeConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Coerce unknown AI/API JSON into a validated ThemeConfig, or throw. */
export function parseThemeConfigOrThrow(raw: unknown): ThemeConfig {
  let value: unknown = raw;
  if (typeof raw === "string") {
    value = JSON.parse(raw);
  }
  return themeConfigSchema.parse(value);
}

/** Soft coerce: fill missing version/defaults and drop unknown keys via Zod. */
export function coerceThemeConfig(raw: unknown): ThemeConfig | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (obj.version == null) obj.version = FOLIYO_THEME_VERSION;
  if (!obj.recipe || typeof obj.recipe !== "string") return null;
  if (!THEME_RECIPES.includes(obj.recipe as ThemeRecipe)) return null;
  const parsed = themeConfigSchema.safeParse(obj);
  return parsed.success ? parsed.data : null;
}

export function serializeThemeConfig(config: ThemeConfig | null | undefined): string | null {
  if (!config) return null;
  const parsed = themeConfigSchema.safeParse(config);
  if (!parsed.success) return null;
  return JSON.stringify(parsed.data);
}

export function resolveThemeConfig(
  themeConfigRaw: unknown,
  themeSlugFallback?: unknown,
): ThemeConfig {
  const parsed = parseThemeConfig(themeConfigRaw);
  if (parsed) return parsed;
  return defaultThemeConfig(String(themeSlugFallback ?? "minimal"));
}

export function googleFontsCssImport(fonts: { heading: string; body: string } | undefined): string {
  if (!fonts) return "";
  const names = [...new Set([fonts.heading, fonts.body])];
  const families = names
    .map((n) => `family=${encodeURIComponent(n).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `@import url("https://fonts.googleapis.com/css2?${families}&display=swap");`;
}

export function skinCssVars(config: ThemeConfig): string {
  const c = config.skin.colors;
  const f = config.skin.fonts;
  const g = config.skin.glass;
  const radius =
    config.skin.radius === "sharp" ? "0.25rem" : config.skin.radius === "pill" ? "1.25rem" : "0.85rem";
  const densityPad = config.skin.density === "cozy" ? "1rem" : "1.5rem";
  const blur =
    g?.blur === "sm" ? "10px" : g?.blur === "lg" ? "28px" : "18px";
  const glassAlpha =
    g?.opacity === "light" ? "0.12" : g?.opacity === "heavy" ? "0.42" : "0.22";

  const lines: string[] = [];
  if (c) {
    lines.push(`--bg:${c.bg};`);
    lines.push(`--ink:${c.ink};`);
    lines.push(`--muted:${c.muted};`);
    lines.push(`--accent:${c.accent};`);
    if (c.accentSoft) lines.push(`--accent-soft:${c.accentSoft};`);
    lines.push(`--surface:${c.bg};`);
  }
  if (f) {
    lines.push(`--font-heading:"${f.heading}",system-ui,sans-serif;`);
    lines.push(`--font-body:"${f.body}",system-ui,sans-serif;`);
  }
  lines.push(`--radius:${radius};`);
  lines.push(`--pad:${densityPad};`);
  lines.push(`--glass-blur:${blur};`);
  lines.push(`--glass-alpha:${glassAlpha};`);
  if (g?.borderGlow) lines.push(`--glass-border:rgba(255,255,255,.35);`);
  else lines.push(`--glass-border:rgba(255,255,255,.18);`);

  const fontImport = googleFontsCssImport(f);
  return `${fontImport}\n:root{${lines.join("")}}`;
}
