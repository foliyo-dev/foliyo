import { queryAll, queryOne, type FoliyoDb } from "../db.js";
import type { ResumeContentIds } from "../resume/content.js";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

/** Match confirmed skills whose names appear in JD text (word-boundary, case-insensitive). */
export function matchSkillsFromJd(
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

/**
 * Compute tailored content IDs from the library (does not mutate portfolio or resume).
 * Callers persist via setResumeContent.
 */
export async function computeTailorSelection(
  db: FoliyoDb,
  userId: string,
  skillIds: string[],
  includeMatching: boolean,
): Promise<ResumeContentIds> {
  const ownedSkills = await queryAll<{ id: string; name: string; status: string }>(
    db,
    "SELECT id, name, status FROM skills WHERE user_id = ? AND status = 'confirmed' AND deleted_at IS NULL",
    [userId],
  );
  const allowed = new Set(ownedSkills.map((s) => s.id));
  const skill_ids = skillIds.filter((id) => allowed.has(id));
  const skillNames = new Set(
    ownedSkills.filter((s) => skill_ids.includes(s.id)).map((s) => s.name.trim().toLowerCase()),
  );

  let project_ids: string[] = [];
  let experience_ids: string[] = [];

  if (includeMatching && skillNames.size > 0) {
    const projects = await queryAll<{ id: string; skills_developed: string }>(
      db,
      "SELECT id, skills_developed FROM projects WHERE user_id = ? AND deleted_at IS NULL",
      [userId],
    );
    project_ids = projects
      .filter((p) =>
        parseTags(p.skills_developed).some((t) => skillNames.has(t.toLowerCase())),
      )
      .map((p) => p.id);

    const experiences = await queryAll<{ id: string; skills_developed: string }>(
      db,
      "SELECT id, skills_developed FROM experience WHERE user_id = ? AND deleted_at IS NULL",
      [userId],
    );
    experience_ids = experiences
      .filter((e) =>
        parseTags(e.skills_developed).some((t) => skillNames.has(t.toLowerCase())),
      )
      .map((e) => e.id);
  }

  const education_ids = (
    await queryAll<{ id: string }>(db, "SELECT id FROM education WHERE user_id = ?", [userId])
  ).map((r) => r.id);
  const certification_ids = (
    await queryAll<{ id: string }>(db, "SELECT id FROM certifications WHERE user_id = ?", [userId])
  ).map((r) => r.id);
  const language_ids = (
    await queryAll<{ id: string }>(db, "SELECT id FROM languages WHERE user_id = ?", [userId])
  ).map((r) => r.id);

  return {
    skill_ids,
    project_ids,
    experience_ids,
    education_ids,
    certification_ids,
    language_ids,
  };
}

/** @deprecated Use computeTailorSelection + setResumeContent — kept name for any leftover imports. */
export async function applyTailorSelection(
  db: FoliyoDb,
  userId: string,
  portfolioId: string,
  skillIds: string[],
  includeMatching: boolean,
): Promise<ResumeContentIds> {
  const portfolio = await queryOne(db, "SELECT id FROM portfolios WHERE id = ? AND user_id = ?", [
    portfolioId,
    userId,
  ]);
  if (!portfolio) throw new Error("portfolio_not_found");
  return computeTailorSelection(db, userId, skillIds, includeMatching);
}

export type TailorSkillRef = { id: string; name: string };

export type TailorAnalysis = {
  source: "jd" | "skills" | "both";
  confirmed_skill_total: number;
  matched_from_jd: TailorSkillRef[];
  selected_by_user: TailorSkillRef[];
  applied_skills: TailorSkillRef[];
  not_in_jd: TailorSkillRef[];
  attached: {
    projects: number;
    experience: number;
    education: number;
    certifications: number;
    languages: number;
  };
  coverage_pct: number;
};

function refsFor(ids: string[], byId: Map<string, string>): TailorSkillRef[] {
  return ids.filter((id) => byId.has(id)).map((id) => ({ id, name: byId.get(id)! }));
}

/** Build post-tailor match report from JD/selection inputs and applied content. */
export function buildTailorAnalysis(input: {
  confirmed: Array<{ id: string; name: string }>;
  selectedIds: string[];
  fromJdIds: string[];
  content: ResumeContentIds;
  hadJd: boolean;
  hadSelection: boolean;
}): TailorAnalysis {
  const byId = new Map(input.confirmed.map((s) => [s.id, s.name]));
  const fromJdSet = new Set(input.fromJdIds);
  const selectedIds = input.selectedIds.filter((id) => byId.has(id));
  const fromJdIds = input.fromJdIds.filter((id) => byId.has(id));
  const applied = input.content.skill_ids.filter((id) => byId.has(id));

  let source: TailorAnalysis["source"] = "skills";
  if (input.hadJd && input.hadSelection) source = "both";
  else if (input.hadJd) source = "jd";

  const confirmedTotal = input.confirmed.length;
  const coverage_pct =
    confirmedTotal === 0 ? 0 : Math.round((applied.length / confirmedTotal) * 100);

  return {
    source,
    confirmed_skill_total: confirmedTotal,
    matched_from_jd: refsFor(fromJdIds, byId),
    selected_by_user: refsFor(selectedIds, byId),
    applied_skills: refsFor(applied, byId),
    not_in_jd: input.hadJd
      ? input.confirmed.filter((s) => !fromJdSet.has(s.id)).map((s) => ({ id: s.id, name: s.name }))
      : [],
    attached: {
      projects: input.content.project_ids.length,
      experience: input.content.experience_ids.length,
      education: input.content.education_ids.length,
      certifications: input.content.certification_ids.length,
      languages: input.content.language_ids.length,
    },
    coverage_pct,
  };
}
