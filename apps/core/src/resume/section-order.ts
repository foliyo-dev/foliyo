/** Canonical resume section keys (contact/hero is always first and not included). */
export const RESUME_SECTION_KEYS = [
  "skills",
  "projects",
  "experience",
  "education",
  "certifications",
  "languages",
] as const;

export type ResumeSectionKey = (typeof RESUME_SECTION_KEYS)[number];

export const DEFAULT_RESUME_SECTION_ORDER: ResumeSectionKey[] = [...RESUME_SECTION_KEYS];

const KEY_SET = new Set<string>(RESUME_SECTION_KEYS);

/**
 * Normalize a stored / client section_order value into a full permutation of known keys.
 * Unknown keys are dropped; missing keys are appended in default order.
 */
export function normalizeResumeSectionOrder(raw: unknown): ResumeSectionKey[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [...DEFAULT_RESUME_SECTION_ORDER];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [...DEFAULT_RESUME_SECTION_ORDER];
    }
  }
  if (!Array.isArray(parsed)) return [...DEFAULT_RESUME_SECTION_ORDER];

  const seen = new Set<string>();
  const out: ResumeSectionKey[] = [];
  for (const item of parsed) {
    const key = String(item ?? "").trim();
    if (!KEY_SET.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key as ResumeSectionKey);
  }
  for (const key of DEFAULT_RESUME_SECTION_ORDER) {
    if (!seen.has(key)) out.push(key);
  }
  return out;
}

export function serializeResumeSectionOrder(order: ResumeSectionKey[]): string {
  return JSON.stringify(normalizeResumeSectionOrder(order));
}
