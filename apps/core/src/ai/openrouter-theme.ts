import { coerceThemeConfig, type ThemeConfig } from "../spec/theme-config.js";
import type { OpenRouterClientConfig } from "./types.js";

const SYSTEM = `You design Foliyo portfolio ThemeConfig JSON for curated layout recipes.
Return ONLY a JSON object matching Foliyo ThemeConfig v1. No markdown.

Recipes (pick exactly one):
- "classic": standard Foliyo site; set skin.theme_slug to one of minimal|modern|creative|noir|atelier|editorial
- "photo-hero": dark cinematic photography hero (split copy + portrait, stats, features, about)
- "gallery-grid": cream minimalist centered brand + image grid
- "glassmorphic": frosted glass panels over a vivid atmospheric background

Rules:
- version must be 1
- Only use allowlisted fonts: Inter, Outfit, DM Sans, Space Grotesk, Sora, Manrope, Cormorant Garamond, Playfair Display, Libre Baskerville, Lora, Source Serif 4, Instrument Serif, Fraunces, IBM Plex Sans, IBM Plex Serif, JetBrains Mono
- Colors must be #hex (3/6/8 digit)
- Feature icons only: spark, camera, clock, edit, globe, star, heart, layers, zap, frame
- Do NOT invent freeform HTML/CSS
- Prefer filling content.hero, stats, features, about, gallery overlays from the user prompt
- For glassmorphic set skin.glass and chrome.nav_style "floating-glass"
- For gallery-grid set content.gallery.columns to 3 and caption_mode "name-category" unless asked otherwise
- Keep copy concise and brand-appropriate

Few-shot shape examples (adapt, do not copy blindly):
photo-hero: {"version":1,"recipe":"photo-hero","skin":{"colors":{"bg":"#0A0E17","ink":"#F8FAFC","muted":"#94A3B8","accent":"#3B82F6"},"fonts":{"heading":"Space Grotesk","body":"Outfit"}},"content":{"hero":{"title":"Light, framed into","title_accent":"stories that last.","subtitle":"Editorial photography with cinematic direction.","cta_primary":"View Portfolio","cta_secondary":"Book a Shoot","badges":[{"label":"Booking 2026"}]},"stats":[{"value":"12+","label":"Years behind the lens"},{"value":"480+","label":"Shoots delivered"}],"features":[{"title":"Cinematic direction","description":"Mood, light, and motion.","icon":"camera"},{"title":"48-hour previews","description":"Fast gallery delivery.","icon":"clock"}]}}
gallery-grid: {"version":1,"recipe":"gallery-grid","skin":{"colors":{"bg":"#F5F2E9","ink":"#1C1A17","muted":"#6B6358","accent":"#C45C26"},"fonts":{"heading":"Cormorant Garamond","body":"Outfit"}},"content":{"brand":{"monogram":"Rs"},"hero":{"title":"Hello, I am Rio!","subtitle":"Print and digital designs about minimalism and elegance.","cta_primary":"Contact me"},"gallery":{"title":"Project Gallery","columns":3,"caption_mode":"name-category"}}}
glassmorphic: {"version":1,"recipe":"glassmorphic","skin":{"colors":{"bg":"#0B1224","ink":"#F8FAFC","muted":"#B6C2D9","accent":"#38BDF8","accentSoft":"#818CF8"},"fonts":{"heading":"Sora","body":"DM Sans"},"glass":{"blur":"lg","opacity":"medium","borderGlow":true},"radius":"pill"},"content":{"hero":{"title":"Build in the open","title_accent":"with clarity.","subtitle":"A glassy personal site for product makers.","cta_primary":"See work"}},"chrome":{"nav_style":"floating-glass"}}`;

export type ThemeGenerateResult = {
  theme_config: ThemeConfig;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

export async function generateThemeWithOpenRouter(
  input: {
    prompt: string;
    profileHint?: { name?: string; headline?: string; bio?: string };
    preferredRecipe?: string;
  },
  cloud: OpenRouterClientConfig,
): Promise<ThemeGenerateResult> {
  const hintBits: string[] = [];
  if (input.profileHint?.name) hintBits.push(`Name: ${input.profileHint.name}`);
  if (input.profileHint?.headline) hintBits.push(`Headline: ${input.profileHint.headline}`);
  if (input.profileHint?.bio) hintBits.push(`Bio: ${input.profileHint.bio.slice(0, 400)}`);
  if (input.preferredRecipe) hintBits.push(`Preferred recipe: ${input.preferredRecipe}`);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cloud.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": cloud.dashboardUrl || "https://foliyo.dev",
      "X-Title": "Foliyo AI Theme",
    },
    body: JSON.stringify({
      model: cloud.openRouterModel,
      temperature: 0.4,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `${hintBits.length ? `Portfolio context:\n${hintBits.join("\n")}\n\n` : ""}User request:\n${input.prompt}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`openrouter_http_${res.status}:${errText.slice(0, 400)}`);
  }

  const body = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("openrouter_empty_response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("openrouter_invalid_json");
    parsed = JSON.parse(match[0]);
  }

  const theme = coerceThemeConfig(parsed);
  if (!theme) throw new Error("openrouter_invalid_theme_config");

  return {
    theme_config: theme,
    model: body.model ?? cloud.openRouterModel,
    tokensIn: body.usage?.prompt_tokens ?? 0,
    tokensOut: body.usage?.completion_tokens ?? 0,
  };
}
