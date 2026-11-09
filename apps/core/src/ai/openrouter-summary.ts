import { queryAll, queryOne, type FoliyoDb } from "../db.js";
import type { OpenRouterClientConfig } from "./types.js";

const SYSTEM = `You write a short resume headline and professional summary tailored to a job description.
Return ONLY JSON: {"headline":"...","bio":"..."} with no markdown.
Rules:
- Use ONLY facts from the candidate library context. Do not invent employers, titles, degrees, metrics, tools, or years.
- Prefer skills and experience that overlap the JD; do not claim JD skills that are absent from the library.
- Headline: one line, max ~12 words, role-oriented (not a full sentence with "I").
- Bio/summary: 2–4 sentences, ~40–80 words, resume third-person-implied style (no "I am…").
- No URLs. No buzzword stuffing.`;

export type SummaryResult = {
  headline: string;
  bio: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

type LibraryContext = {
  name: string;
  existingHeadline: string;
  existingBio: string;
  skills: string[];
  focusSkills: string[];
  experience: Array<{
    role: string;
    company: string;
    span: string;
    skills: string[];
    blurb: string;
  }>;
  projects: Array<{ title: string; skills: string[]; blurb: string }>;
};

function parseTags(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => String(t).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function truncate(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function dateSpan(start: string | null | undefined, end: string | null | undefined): string {
  const a = String(start ?? "").trim().slice(0, 7);
  const b = end ? String(end).trim().slice(0, 7) : "present";
  if (!a) return "";
  return `${a}–${b}`;
}

/** Pull grounded library facts for summary generation (server-side only). */
export async function buildLibraryContext(
  db: FoliyoDb,
  userId: string,
  focusSkillNames: string[] = [],
): Promise<LibraryContext> {
  const profile = await queryOne<{ name: string; headline: string; bio: string }>(
    db,
    "SELECT name, headline, bio FROM profile WHERE user_id = ?",
    [userId],
  );

  const skills = await queryAll<{ name: string }>(
    db,
    `SELECT name FROM skills
     WHERE user_id = ? AND status = 'confirmed' AND deleted_at IS NULL
     ORDER BY sort_order, name LIMIT 40`,
    [userId],
  );

  const experience = await queryAll<{
    role: string;
    company: string;
    start_date: string;
    end_date: string | null;
    description: string;
    skills_developed: string;
  }>(
    db,
    `SELECT role, company, start_date, end_date, description, skills_developed
     FROM experience WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY start_date DESC LIMIT 6`,
    [userId],
  );

  const projects = await queryAll<{
    title: string;
    description: string;
    skills_developed: string;
  }>(
    db,
    `SELECT title, description, skills_developed
     FROM projects WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY featured DESC, sort_order, created_at DESC LIMIT 4`,
    [userId],
  );

  const focus = focusSkillNames.map((s) => s.trim()).filter(Boolean).slice(0, 24);

  return {
    name: String(profile?.name ?? "").trim(),
    existingHeadline: String(profile?.headline ?? "").trim(),
    existingBio: String(profile?.bio ?? "").trim(),
    skills: skills.map((s) => s.name.trim()).filter(Boolean),
    focusSkills: focus,
    experience: experience.map((e) => ({
      role: e.role,
      company: e.company,
      span: dateSpan(e.start_date, e.end_date),
      skills: parseTags(e.skills_developed).slice(0, 12),
      blurb: truncate(e.description ?? "", 220),
    })),
    projects: projects.map((p) => ({
      title: p.title,
      skills: parseTags(p.skills_developed).slice(0, 10),
      blurb: truncate(p.description ?? "", 160),
    })),
  };
}

function formatContext(ctx: LibraryContext): string {
  const lines: string[] = [];
  if (ctx.name) lines.push(`Name: ${ctx.name}`);
  if (ctx.existingHeadline) lines.push(`Current headline: ${ctx.existingHeadline}`);
  if (ctx.existingBio) lines.push(`Current summary: ${truncate(ctx.existingBio, 400)}`);
  if (ctx.focusSkills.length) {
    lines.push(`JD-matched library skills (prefer these): ${ctx.focusSkills.join(", ")}`);
  }
  if (ctx.skills.length) lines.push(`Confirmed skills: ${ctx.skills.join(", ")}`);
  if (ctx.experience.length) {
    lines.push("Experience:");
    for (const e of ctx.experience) {
      const skills = e.skills.length ? ` [${e.skills.join(", ")}]` : "";
      const blurb = e.blurb ? ` — ${e.blurb}` : "";
      lines.push(`- ${e.role} @ ${e.company} (${e.span})${skills}${blurb}`);
    }
  }
  if (ctx.projects.length) {
    lines.push("Projects:");
    for (const p of ctx.projects) {
      const skills = p.skills.length ? ` [${p.skills.join(", ")}]` : "";
      const blurb = p.blurb ? ` — ${p.blurb}` : "";
      lines.push(`- ${p.title}${skills}${blurb}`);
    }
  }
  return lines.join("\n");
}

export async function generateSummaryWithOpenRouter(
  input: { jdSnippet: string; library: LibraryContext },
  cloud: OpenRouterClientConfig,
): Promise<SummaryResult> {
  const libraryBlock = formatContext(input.library);
  if (!libraryBlock.trim()) {
    throw new Error("library_empty");
  }
  const rewriteMax = cloud.aiRewriteMaxTokens && cloud.aiRewriteMaxTokens > 64
    ? cloud.aiRewriteMaxTokens
    : 400;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cloud.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": cloud.dashboardUrl || "https://foliyo.dev",
      "X-Title": "Foliyo AI Resume Summary",
    },
    body: JSON.stringify({
      model: cloud.openRouterModel,
      temperature: 0.25,
      max_tokens: Math.max(rewriteMax, 500),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content:
            `Job description (for alignment only — do not invent from this):\n${input.jdSnippet.slice(0, 2500)}\n\n` +
            `Candidate library (only source of truth):\n${libraryBlock}\n\n` +
            `Write headline and bio.`,
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

  const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const headline = String(obj.headline ?? "").trim();
  const bio = String(obj.bio ?? obj.summary ?? "").trim();
  if (headline.length < 4 || bio.length < 24) throw new Error("openrouter_empty_summary");

  return {
    headline: headline.slice(0, 160),
    bio: bio.slice(0, 1200),
    model: body.model ?? cloud.openRouterModel,
    tokensIn: body.usage?.prompt_tokens ?? 0,
    tokensOut: body.usage?.completion_tokens ?? 0,
  };
}
