import { hashJdText, matchSkillsFromJd, normalizeJdText } from "@foliyo/jobs-client";

export { hashJdText, normalizeJdText, matchSkillsFromJd };

/** @deprecated Use matchSkillsFromJd — kept name for existing imports. */
export function matchSkillIdsFromJd(
  jdText: string,
  skills: Array<{ id: string; name: string }>,
): string[] {
  return matchSkillsFromJd(jdText, skills);
}

export function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let hit = 0;
  for (const id of a) {
    if (b.has(id)) hit++;
  }
  return hit / a.size;
}
