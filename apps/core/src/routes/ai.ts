import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "../config.js";
import { isOpenRouterConfigured, openRouterFromConfig } from "../config.js";
import type { FoliyoDb } from "../db.js";
import { queryOne } from "../db.js";
import {
  getEffectiveUserPlan,
  isProPlan,
  upgradePayload,
} from "../plan.js";
import { THEME_RECIPES } from "../spec/theme-config.js";
import type { AppEnv } from "../middleware/auth.js";
import {
  MAX_BULLET_CHARS,
  MAX_JD_CHARS,
  MIN_BULLET_CHARS,
  MIN_JD_CHARS,
  buildLibraryContext,
  gateBulletText,
  gateJdText,
  generateSummaryWithOpenRouter,
  generateThemeWithOpenRouter,
  normalizeTone,
  rewriteBulletWithOpenRouter,
  runGapCheck,
} from "../ai/index.js";

const gapSchema = z.object({
  jd_text: z.string().min(MIN_JD_CHARS).max(MAX_JD_CHARS),
});

const rewriteSchema = z.object({
  text: z.string().min(MIN_BULLET_CHARS).max(MAX_BULLET_CHARS),
  tone: z.enum(["stronger", "shorter", "metrics"]).optional(),
  jd_text: z.string().max(MAX_JD_CHARS).optional(),
});

const summarySchema = z.object({
  jd_text: z.string().min(MIN_JD_CHARS).max(MAX_JD_CHARS),
  skill_names: z.array(z.string().min(1).max(80)).max(40).optional(),
});

const themeSchema = z.object({
  prompt: z.string().min(8).max(2000),
  portfolio_id: z.string().min(1).max(64).optional(),
  preferred_recipe: z.enum(THEME_RECIPES).optional(),
});

/**
 * OSS / self-host AI routes (BYOK OpenRouter). No Foliyo unit metering.
 * Hosted cloud mounts its own metered routes instead.
 */
export function aiRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();
  const openRouter = openRouterFromConfig(config);

  r.get("/usage", async (c) => {
    return c.json({
      day: new Date().toISOString().slice(0, 10),
      units: 0,
      limit: 0,
      remaining: 0,
      costs: { import: 0, rewrite: 0, analyze: 0, summary: 0, theme: 0 },
      tokens_in: 0,
      tokens_out: 0,
      import_count: 0,
      rewrite_count: 0,
      openrouter: isOpenRouterConfigured(config),
      byok: true,
    });
  });

  r.post("/gap-check", async (c) => {
    const userId = c.get("userId");
    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json({ error: "Send JSON { jd_text }." }, 400);
    }
    const parsed = gapSchema.safeParse(json);
    if (!parsed.success) {
      return c.json(
        { error: `jd_text must be ${MIN_JD_CHARS}–${MAX_JD_CHARS.toLocaleString()} characters.` },
        400,
      );
    }
    const gated = gateJdText(parsed.data.jd_text);
    if ("error" in gated) return c.json({ error: gated.error }, gated.status);

    const result = await runGapCheck(db, userId, gated.text);
    return c.json(result);
  });

  r.post("/rewrite", async (c) => {
    const userId = c.get("userId");
    const plan = await getEffectiveUserPlan(db, userId, config);

    if (!isProPlan(plan)) {
      return c.json(
        upgradePayload(
          "ai_assist",
          "AI rewrite is a Pro feature (₹99/mo). Upgrade to polish experience and project bullets.",
        ),
        402,
      );
    }

    if (!isOpenRouterConfigured(config)) {
      return c.json(
        {
          error: "ai_unavailable",
          message:
            "OpenRouter is not configured. Set OPENROUTER_API_KEY on this server to enable AI (BYOK).",
        },
        503,
      );
    }

    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json({ error: "Send JSON { text, tone? }." }, 400);
    }
    const parsed = rewriteSchema.safeParse(json);
    if (!parsed.success) {
      return c.json(
        {
          error: `text must be ${MIN_BULLET_CHARS}–${MAX_BULLET_CHARS.toLocaleString()} characters.`,
        },
        400,
      );
    }

    const gated = gateBulletText(parsed.data.text);
    if ("error" in gated) return c.json({ error: gated.error }, gated.status);

    let jdSnippet: string | undefined;
    if (parsed.data.jd_text?.trim()) {
      const jd = gateJdText(parsed.data.jd_text);
      if ("error" in jd) return c.json({ error: jd.error }, jd.status);
      jdSnippet = jd.text.slice(0, 1500);
    }

    const tone = normalizeTone(parsed.data.tone);

    try {
      const result = await rewriteBulletWithOpenRouter(
        { text: gated.text, tone, jdSnippet },
        openRouter,
      );
      return c.json({
        text: result.text,
        tone,
        meta: {
          model: result.model,
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
          units_spent: 0,
          units_remaining: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ai:rewrite] failed:", message);
      return c.json(
        { error: "rewrite_failed", message: "Could not rewrite text. Try a shorter bullet." },
        502,
      );
    }
  });

  r.post("/summary", async (c) => {
    const userId = c.get("userId");
    const plan = await getEffectiveUserPlan(db, userId, config);

    if (!isProPlan(plan)) {
      return c.json(
        upgradePayload(
          "ai_assist",
          "AI resume summary is a Pro feature (₹99/mo). Upgrade to generate a tailored headline and summary.",
        ),
        402,
      );
    }

    if (!isOpenRouterConfigured(config)) {
      return c.json(
        {
          error: "ai_unavailable",
          message:
            "OpenRouter is not configured. Set OPENROUTER_API_KEY on this server to enable AI (BYOK).",
        },
        503,
      );
    }

    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json({ error: "Send JSON { jd_text, skill_names? }." }, 400);
    }
    const parsed = summarySchema.safeParse(json);
    if (!parsed.success) {
      return c.json(
        {
          error: `jd_text must be ${MIN_JD_CHARS}–${MAX_JD_CHARS.toLocaleString()} characters.`,
        },
        400,
      );
    }

    const gated = gateJdText(parsed.data.jd_text);
    if ("error" in gated) return c.json({ error: gated.error }, gated.status);

    const library = await buildLibraryContext(db, userId, parsed.data.skill_names ?? []);
    if (!library.skills.length && !library.experience.length && !library.projects.length) {
      return c.json(
        {
          error: "library_empty",
          message: "Add confirmed skills or experience to your library before generating a summary.",
        },
        400,
      );
    }

    try {
      const result = await generateSummaryWithOpenRouter(
        { jdSnippet: gated.text.slice(0, 2500), library },
        openRouter,
      );
      return c.json({
        headline: result.headline,
        bio: result.bio,
        meta: {
          model: result.model,
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
          units_spent: 0,
          units_remaining: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ai:summary] failed:", message);
      if (message === "library_empty") {
        return c.json(
          {
            error: "library_empty",
            message: "Add confirmed skills or experience to your library before generating a summary.",
          },
          400,
        );
      }
      return c.json(
        {
          error: "summary_failed",
          message: "Could not generate a summary. Try again with a clearer JD.",
        },
        502,
      );
    }
  });

  r.post("/theme", async (c) => {
    const userId = c.get("userId");
    const plan = await getEffectiveUserPlan(db, userId, config);

    if (!isProPlan(plan)) {
      return c.json(
        upgradePayload(
          "ai_assist",
          "AI theme design is a Pro feature (₹99/mo). Upgrade to generate exotic portfolio layouts.",
        ),
        402,
      );
    }

    if (!isOpenRouterConfigured(config)) {
      return c.json(
        {
          error: "ai_unavailable",
          message:
            "OpenRouter is not configured. Set OPENROUTER_API_KEY on this server to enable AI (BYOK).",
        },
        503,
      );
    }

    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json({ error: "Send JSON { prompt, portfolio_id?, preferred_recipe? }." }, 400);
    }
    const parsed = themeSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: "prompt must be 8–2000 characters." }, 400);
    }

    if (parsed.data.portfolio_id) {
      const owned = await queryOne<{ id: string }>(
        db,
        "SELECT id FROM portfolios WHERE id = ? AND user_id = ?",
        [parsed.data.portfolio_id, userId],
      );
      if (!owned) return c.json({ error: "portfolio not found" }, 404);
    }

    const profile = await queryOne<{ name: string; headline: string; bio: string }>(
      db,
      "SELECT name, headline, bio FROM profile WHERE user_id = ?",
      [userId],
    );
    const profileHint = profile
      ? {
          name: String(profile.name ?? ""),
          headline: String(profile.headline ?? ""),
          bio: String(profile.bio ?? ""),
        }
      : undefined;

    try {
      const result = await generateThemeWithOpenRouter(
        {
          prompt: parsed.data.prompt.trim(),
          profileHint,
          preferredRecipe: parsed.data.preferred_recipe,
        },
        openRouter,
      );
      return c.json({
        theme_config: result.theme_config,
        meta: {
          model: result.model,
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
          units_spent: 0,
          units_remaining: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ai:theme] failed:", message);
      return c.json(
        {
          error: "theme_failed",
          message: "Could not generate a theme. Try a clearer design prompt.",
        },
        502,
      );
    }
  });

  return r;
}
