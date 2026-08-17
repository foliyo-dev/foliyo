import {
  CATALOG_SKILLS,
  displaySkillName,
  mentionedIn,
  mentionTermsFor,
  normalizeSkillKey,
} from "./aliases.js";
import type { JobDocument, Requirement, RequirementImportance } from "./types.js";

export const MIN_JD_CHARS = 40;
export const MAX_JD_CHARS = 12_000;

const JD_SIGNALS = [
  /\b(responsibilit|requirement|qualificat|experience|years?)\b/i,
  /\b(role|position|engineer|developer|designer|manager|analyst)\b/i,
  /\b(skill|must\s*have|nice\s*to\s*have|preferred)\b/i,
  /\b(job|opening|we\s+are\s+looking|about\s+the\s+role)\b/i,
];

export function looksLikeJobDescription(text: string): boolean {
  return JD_SIGNALS.filter((re) => re.test(text)).length >= 1;
}

export function gateJdText(raw: string): { ok: true; text: string } | { ok: false; error: string } {
  const text = raw.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (text.length < MIN_JD_CHARS) {
    return { ok: false, error: `Job description is too short (min ${MIN_JD_CHARS} characters).` };
  }
  if (text.length > MAX_JD_CHARS) {
    return { ok: false, error: `Job description is too long (max ${MAX_JD_CHARS.toLocaleString()} characters).` };
  }
  if (!looksLikeJobDescription(text)) {
    return { ok: false, error: "Paste a real job description (role, requirements, or responsibilities)." };
  }
  return { ok: true, text };
}

type SectionKind = RequirementImportance | "other";

const SECTION_HEADERS: Array<{ re: RegExp; kind: SectionKind }> = [
  { re: /^\s*(nice\s*to\s*have|bonus|plus(?:es)?|optional)\b/i, kind: "nice_to_have" },
  { re: /^\s*(preferred|good\s*to\s*have|what(?:'s| is) nice)\b/i, kind: "preferred" },
  {
    re: /^\s*(must\s*have|required|requirements|qualifications|minimum|what you.?ll need|you have)\b/i,
    kind: "required",
  },
  { re: /^\s*(responsibilit|about the role|what you.?ll do|the role)\b/i, kind: "other" },
];

function labeledLine(text: string, labels: string[]): string | null {
  const re = new RegExp(
    `^(?:${labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*[:\\-–]\\s*(.+)$`,
    "im",
  );
  const m = re.exec(text);
  const v = m?.[1]?.trim();
  return v && v.length < 120 ? v : null;
}

function firstTitleLine(text: string): string | null {
  const labeled = labeledLine(text, ["job title", "title", "role", "position"]);
  if (labeled) return labeled;
  const first = text.split("\n").map((l) => l.trim()).find((l) => l.length > 2 && l.length < 80);
  if (!first) return null;
  if (/^(about|we are|company|job description|overview)\b/i.test(first)) return null;
  return first;
}

function importanceAt(text: string, index: number): RequirementImportance {
  const before = text.slice(0, Math.max(0, index));
  const lines = before.split("\n");
  let kind: SectionKind = "other";
  for (const line of lines) {
    for (const h of SECTION_HEADERS) {
      if (h.re.test(line)) {
        kind = h.kind;
        break;
      }
    }
  }
  if (kind === "preferred" || kind === "nice_to_have" || kind === "required") return kind;
  return "required";
}

function firstIndex(text: string, terms: string[]): number {
  let best = -1;
  const lower = text;
  for (const term of terms) {
    if (!term.trim()) continue;
    const re = new RegExp(
      `(?:^|[^A-Za-z0-9+])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\./g, "\\.")}(?:[^A-Za-z0-9+]|$)`,
      "i",
    );
    const m = re.exec(lower);
    if (m && (best < 0 || m.index < best)) best = m.index;
  }
  return best;
}

/**
 * Heuristic JD → JobDocument. Library names are included so user-specific skills match.
 * Does not invent skills that are not mentioned in the text.
 */
export function parseJobDocument(rawText: string, librarySkillNames: string[] = []): JobDocument {
  const title = firstTitleLine(rawText);
  const company = labeledLine(rawText, ["company", "employer", "organization"]);
  const location = labeledLine(rawText, ["location", "where", "city"]);

  const byCanonical = new Map<string, { terms: string[]; display: string }>();

  const add = (name: string, display?: string) => {
    const key = normalizeSkillKey(name);
    if (!key || key.length < 2) return;
    const cur = byCanonical.get(key);
    const terms = mentionTermsFor(key);
    terms.push(name);
    if (cur) {
      for (const t of terms) cur.terms.push(t);
      return;
    }
    byCanonical.set(key, {
      terms: [...new Set(terms.map((t) => t.trim()).filter(Boolean))],
      display: display ?? displaySkillName(name),
    });
  };

  for (const token of CATALOG_SKILLS) add(token);
  for (const name of librarySkillNames) add(name, name.trim());

  const requirements: Requirement[] = [];
  for (const [normalized, { terms, display }] of byCanonical) {
    const idx = firstIndex(rawText, terms);
    if (idx < 0) continue;
    if (!terms.some((t) => mentionedIn(rawText, t))) continue;
    requirements.push({
      type: "skill",
      name: display,
      importance: importanceAt(rawText, idx),
      normalized,
    });
  }

  requirements.sort((a, b) => {
    const rank = (i: RequirementImportance) =>
      i === "required" ? 0 : i === "preferred" ? 1 : 2;
    const r = rank(a.importance) - rank(b.importance);
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });

  return {
    title,
    company,
    location,
    rawText,
    requirements,
    parse: "heuristic",
  };
}
