type ParsedJob = {
  title: string | null;
  company: string | null;
  location: string | null;
  requirements: Array<{
    type: "skill" | "experience" | "education" | "certification";
    name: string;
    importance: "required" | "preferred" | "nice_to_have";
    normalized: string;
  }>;
  parse: "llm";
};

const SYSTEM = `You extract structured requirements from a job description for Foliyo.
Return ONLY JSON matching:
{
  "title": string|null,
  "company": string|null,
  "location": string|null,
  "requirements": [
    {
      "type": "skill"|"experience"|"education"|"certification",
      "name": string,
      "importance": "required"|"preferred"|"nice_to_have"
    }
  ]
}
Rules:
- Only extract skills, tools, and credentials explicitly mentioned in the JD.
- Never invent skills, years, degrees, or employers.
- Prefer specific technology names (Kubernetes, PostgreSQL) over vague phrases.
- Deduplicate. Keep the list short (max 25 requirements).
- importance: must-have / requirements → required; preferred → preferred; nice-to-have / bonus → nice_to_have.
`;

const TYPES = new Set(["skill", "experience", "education", "certification"]);
const IMPORTANCE = new Set(["required", "preferred", "nice_to_have"]);

export type JdParseResult = {
  job: ParsedJob;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function parseJobDocumentWithOpenRouter(
  text: string,
  cloud: {
    openRouterApiKey: string;
    openRouterModel: string;
    dashboardUrl: string;
  },
): Promise<JdParseResult> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cloud.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": cloud.dashboardUrl || "https://foliyo.dev",
      "X-Title": "Foliyo JD Parse",
    },
    body: JSON.stringify({
      model: cloud.openRouterModel,
      temperature: 0,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text.slice(0, 12_000) },
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

  if (!parsed || typeof parsed !== "object") throw new Error("openrouter_invalid_shape");
  const obj = parsed as Record<string, unknown>;
  const rawReqs = Array.isArray(obj.requirements) ? obj.requirements : [];

  const seen = new Set<string>();
  const requirements: ParsedJob["requirements"] = [];
  for (const item of rawReqs) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = asString(r.name);
    if (!name) continue;
    const type = TYPES.has(String(r.type))
      ? (r.type as ParsedJob["requirements"][number]["type"])
      : "skill";
    const importance = IMPORTANCE.has(String(r.importance))
      ? (r.importance as ParsedJob["requirements"][number]["importance"])
      : "required";
    const normalized = normalizeKey(name);
    if (!normalized || seen.has(`${type}:${normalized}`)) continue;
    seen.add(`${type}:${normalized}`);
    requirements.push({ type, name, importance, normalized });
    if (requirements.length >= 25) break;
  }

  return {
    job: {
      title: asString(obj.title),
      company: asString(obj.company),
      location: asString(obj.location),
      requirements,
      parse: "llm",
    },
    model: body.model ?? cloud.openRouterModel,
    tokensIn: body.usage?.prompt_tokens ?? 0,
    tokensOut: body.usage?.completion_tokens ?? 0,
  };
}
