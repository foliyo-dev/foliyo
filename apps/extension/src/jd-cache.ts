import { hashJdText, normalizeJdText } from "@foliyo/jobs-client";

export { hashJdText, normalizeJdText };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Client-side JD skill match (same word-boundary logic as core tailor). */
export function matchSkillIdsFromJd(
  jdText: string,
  skills: Array<{ id: string; name: string }>,
): string[] {
  const matched: string[] = [];
  for (const skill of skills) {
    const name = skill.name.trim();
    if (!name) continue;
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
    if (re.test(jdText)) matched.push(skill.id);
  }
  return matched;
}

export function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let hit = 0;
  for (const id of a) {
    if (b.has(id)) hit++;
  }
  return hit / a.size;
}
