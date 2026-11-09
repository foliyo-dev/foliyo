import type { RewriteTone } from "./gate-assist.js";
import type { OpenRouterClientConfig } from "./types.js";

const SYSTEM = `You rewrite ONE resume/experience bullet or short paragraph for a job application.
Return ONLY JSON: {"text":"..."} with no markdown.
Rules:
- Do not invent employers, titles, degrees, metrics, or tools not implied by the input.
- Keep first person implied / resume style (no "I am a...").
- Preserve factual meaning; improve clarity and impact.
- Max ~60 words unless tone is "shorter" (then aim ≤35 words).
- No URLs unless present in the input.`;

const TONE_HINT: Record<RewriteTone, string> = {
  stronger: "Make it stronger and more action-oriented.",
  shorter: "Make it shorter and tighter.",
  metrics: "Prefer measurable impact wording only when numbers already exist in the input.",
};

export type RewriteResult = {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

export async function rewriteBulletWithOpenRouter(
  input: { text: string; tone: RewriteTone; jdSnippet?: string },
  cloud: OpenRouterClientConfig,
): Promise<RewriteResult> {
  const jd =
    input.jdSnippet && input.jdSnippet.trim()
      ? `\nOptional JD context (do not invent from this):\n${input.jdSnippet.slice(0, 1500)}\n`
      : "";
  const maxTokens = cloud.aiRewriteMaxTokens && cloud.aiRewriteMaxTokens > 64
    ? cloud.aiRewriteMaxTokens
    : 400;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cloud.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": cloud.dashboardUrl || "https://foliyo.dev",
      "X-Title": "Foliyo AI Rewrite",
    },
    body: JSON.stringify({
      model: cloud.openRouterModel,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content:
            `${TONE_HINT[input.tone]}\n${jd}\nRewrite this text:\n\n${input.text}`,
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

  const text =
    parsed && typeof parsed === "object" && "text" in parsed
      ? String((parsed as { text: unknown }).text ?? "").trim()
      : "";
  if (text.length < 8) throw new Error("openrouter_empty_rewrite");

  return {
    text: text.slice(0, 2500),
    model: body.model ?? cloud.openRouterModel,
    tokensIn: body.usage?.prompt_tokens ?? 0,
    tokensOut: body.usage?.completion_tokens ?? 0,
  };
}
