import type { OpenRouterClientConfig } from "./types.js";

export type ResumeImportDraft = {
  candidate: {
    name: string;
    headline: string | null;
    bio: string | null;
    email: string | null;
    location: string | null;
    links: Record<string, string>;
  };
  skills: Array<{ name: string; level: string | null; category: string | null }>;
  experience: Array<{
    company: string;
    role: string;
    location: string | null;
    start: string | null;
    end: string | null;
    current: boolean;
    description: string | null;
  }>;
  education: Array<{
    institution: string;
    degree: string | null;
    field: string | null;
    start: string | null;
    end: string | null;
    description: string | null;
  }>;
  projects: Array<{
    title: string;
    description: string | null;
    url: string | null;
    repo_url: string | null;
    tags: string[];
    featured: boolean;
  }>;
  certifications: Array<{
    name: string;
    issuer: string | null;
    credential_id: string | null;
    credential_url: string | null;
    issued_at: string | null;
    expires_at: string | null;
    description: string | null;
  }>;
  languages: Array<{ language: string; proficiency: string | null }>;
};

const SYSTEM_PROMPT = `You extract structured resume data for the Foliyo Resume Spec (foliyo/resume v0.1).
Return ONLY valid JSON matching this shape (no markdown, no commentary):
{
  "candidate": {
    "name": string,
    "headline": string|null,
    "bio": string|null,
    "email": string|null,
    "location": string|null,
    "links": { "<provider>": "<url or handle>" }
  },
  "skills": [{ "name": string, "level": "beginner"|"intermediate"|"advanced"|"expert"|null, "category": string|null }],
  "experience": [{ "company": string, "role": string, "location": string|null, "start": "YYYY-MM"|null, "end": "YYYY-MM"|null, "current": boolean, "description": string|null }],
  "education": [{ "institution": string, "degree": string|null, "field": string|null, "start": "YYYY-MM"|null, "end": "YYYY-MM"|null, "description": string|null }],
  "projects": [{ "title": string, "description": string|null, "url": string|null, "repo_url": string|null, "tags": string[], "featured": boolean }],
  "certifications": [{ "name": string, "issuer": string|null, "credential_id": string|null, "credential_url": string|null, "issued_at": "YYYY-MM"|null, "expires_at": "YYYY-MM"|null, "description": string|null }],
  "languages": [{ "language": string, "proficiency": "native"|"fluent"|"conversational"|"basic"|null }]
}
Rules:
- Omit invented employers, degrees, or skills not supported by the text.
- Prefer YYYY-MM dates; use null when unknown.
- links providers: github, linkedin, twitter, website, youtube, medium, or other.
- URLs (candidate.links when they are URLs, project url/repo_url, credential_url) MUST include https://. If the resume has github.com/user, emit https://github.com/user. Bare usernames for github/linkedin/twitter are ok.
- Empty arrays are fine when a section is missing.
- Keep descriptions concise (a few sentences max).
- Prefer short free-form skill categories the person would use (e.g. "Backend", "Design", "Leadership") — do not invent a rigid taxonomy. Use null when unclear.`;

const LEVELS = new Set(["beginner", "intermediate", "advanced", "expert"]);
const PROFICIENCIES = new Set(["native", "fluent", "conversational", "basic"]);

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === "true";
}

function asUrl(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  if (/^https?:\/\//i.test(s) || /^(mailto|tel):/i.test(s)) return s;
  if (/^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)+)/i.test(s)) return `https://${s}`;
  return s;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function normalizeDraft(raw: unknown): ResumeImportDraft {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const candidate = (o.candidate && typeof o.candidate === "object"
    ? o.candidate
    : {}) as Record<string, unknown>;
  const linksRaw =
    candidate.links && typeof candidate.links === "object"
      ? (candidate.links as Record<string, unknown>)
      : {};
  const links: Record<string, string> = {};
  for (const [k, v] of Object.entries(linksRaw)) {
    const s = asString(v);
    if (s) links[k.toLowerCase()] = asUrl(s) ?? s;
  }

  const skills = Array.isArray(o.skills) ? o.skills : [];
  const experience = Array.isArray(o.experience) ? o.experience : [];
  const education = Array.isArray(o.education) ? o.education : [];
  const projects = Array.isArray(o.projects) ? o.projects : [];
  const certifications = Array.isArray(o.certifications) ? o.certifications : [];
  const languages = Array.isArray(o.languages) ? o.languages : [];

  return {
    candidate: {
      name: asString(candidate.name) ?? "",
      headline: asString(candidate.headline),
      bio: asString(candidate.bio),
      email: asString(candidate.email),
      location: asString(candidate.location),
      links,
    },
    skills: skills
      .map((row) => {
        const r = row as Record<string, unknown>;
        const level = asString(r.level);
        return {
          name: asString(r.name) ?? "",
          level: level && LEVELS.has(level) ? level : null,
          category: asString(r.category),
        };
      })
      .filter((s) => s.name),
    experience: experience
      .map((row) => {
        const r = row as Record<string, unknown>;
        const end = asString(r.end);
        return {
          company: asString(r.company) ?? "",
          role: asString(r.role) ?? "",
          location: asString(r.location),
          start: asString(r.start),
          end,
          current: asBool(r.current) || !end,
          description: asString(r.description),
        };
      })
      .filter((e) => e.company || e.role),
    education: education
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          institution: asString(r.institution) ?? "",
          degree: asString(r.degree),
          field: asString(r.field),
          start: asString(r.start),
          end: asString(r.end),
          description: asString(r.description),
        };
      })
      .filter((e) => e.institution),
    projects: projects
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          title: asString(r.title) ?? "",
          description: asString(r.description),
          url: asUrl(r.url),
          repo_url: asUrl(r.repo_url),
          tags: asStringArray(r.tags),
          featured: asBool(r.featured),
        };
      })
      .filter((p) => p.title),
    certifications: certifications
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          name: asString(r.name) ?? "",
          issuer: asString(r.issuer),
          credential_id: asString(r.credential_id),
          credential_url: asUrl(r.credential_url),
          issued_at: asString(r.issued_at),
          expires_at: asString(r.expires_at),
          description: asString(r.description),
        };
      })
      .filter((c) => c.name),
    languages: languages
      .map((row) => {
        const r = row as Record<string, unknown>;
        const proficiency = asString(r.proficiency);
        return {
          language: asString(r.language) ?? asString(r.name) ?? "",
          proficiency: proficiency && PROFICIENCIES.has(proficiency) ? proficiency : null,
        };
      })
      .filter((l) => l.language),
  };
}

export type OpenRouterResult = {
  draft: ResumeImportDraft;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

export async function extractResumeWithOpenRouter(
  resumeText: string,
  cloud: OpenRouterClientConfig,
): Promise<OpenRouterResult> {
  const truncated =
    resumeText.length > 48000 ? `${resumeText.slice(0, 48000)}\n\n[truncated]` : resumeText;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cloud.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": cloud.dashboardUrl || "https://foliyo.dev",
      "X-Title": "Foliyo Resume Import",
    },
    body: JSON.stringify({
      model: cloud.openRouterModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract a Foliyo Resume Spec draft from this resume text:\n\n${truncated}`,
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

  return {
    draft: normalizeDraft(parsed),
    model: body.model ?? cloud.openRouterModel,
    tokensIn: body.usage?.prompt_tokens ?? 0,
    tokensOut: body.usage?.completion_tokens ?? 0,
  };
}
