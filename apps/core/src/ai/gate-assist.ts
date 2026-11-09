/**
 * Guardrails for lightweight AI assist (rewrite / JD-related).
 * Reject junk before any OpenRouter call.
 */

export const MIN_BULLET_CHARS = 24;
export const MAX_BULLET_CHARS = 2_000;
export const MIN_JD_CHARS = 40;
export const MAX_JD_CHARS = 12_000;

export type GateError = { error: string; status: 400 };

function fail(error: string): GateError {
  return { error, status: 400 };
}

export function sanitizeAssistText(raw: string): string {
  let t = raw.replace(/\u0000/g, "");
  t = t.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  t = t.replace(/\n{4,}/g, "\n\n\n");
  t = t.replace(/[ \t]{3,}/g, "  ");
  return t.trim();
}

const JD_SIGNALS = [
  /\b(responsibilit|requirement|qualificat|experience|years?)\b/i,
  /\b(role|position|engineer|developer|designer|manager|analyst)\b/i,
  /\b(skill|must\s*have|nice\s*to\s*have|preferred)\b/i,
  /\b(job|opening|we\s+are\s+looking|about\s+the\s+role)\b/i,
];

export function gateBulletText(raw: string): { text: string } | GateError {
  const text = sanitizeAssistText(raw);
  if (text.length < MIN_BULLET_CHARS) {
    return fail(`Text is too short (min ${MIN_BULLET_CHARS} characters).`);
  }
  if (text.length > MAX_BULLET_CHARS) {
    return fail(`Text is too long (max ${MAX_BULLET_CHARS.toLocaleString()} characters).`);
  }
  const urlCount = (text.match(/https?:\/\//gi) ?? []).length;
  if (urlCount > 8) return fail("Too many links for a bullet rewrite.");
  return { text };
}

export function gateJdText(raw: string): { text: string } | GateError {
  const text = sanitizeAssistText(raw);
  if (text.length < MIN_JD_CHARS) {
    return fail(`Job description is too short (min ${MIN_JD_CHARS} characters).`);
  }
  if (text.length > MAX_JD_CHARS) {
    return fail(`Job description is too long (max ${MAX_JD_CHARS.toLocaleString()} characters).`);
  }
  const hits = JD_SIGNALS.filter((re) => re.test(text)).length;
  if (hits < 1) {
    return fail("Paste a real job description (role, requirements, or responsibilities).");
  }
  const urlCount = (text.match(/https?:\/\//gi) ?? []).length;
  if (urlCount > 40) return fail("Too many links for a job description.");
  return { text };
}

export type RewriteTone = "stronger" | "shorter" | "metrics";

export function normalizeTone(raw: unknown): RewriteTone {
  if (raw === "shorter" || raw === "metrics") return raw;
  return "stronger";
}
