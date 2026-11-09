import { queryAll, type FoliyoDb } from "../db.js";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchSkillNames(jdText: string, skills: Array<{ id: string; name: string }>): string[] {
  const matched: string[] = [];
  for (const skill of skills) {
    const name = skill.name.trim();
    if (!name) continue;
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
    if (re.test(jdText)) matched.push(skill.id);
  }
  return matched;
}

export type GapFinding = {
  id: string;
  severity: "info" | "warn" | "ok";
  title: string;
  detail: string;
};

export type GapCheckResult = {
  matched_skills: Array<{ id: string; name: string }>;
  missing_skill_hints: string[];
  findings: GapFinding[];
  /** Zero LLM — always true for this endpoint. */
  llm: false;
};

/** Common JD tech tokens we surface when not in the user's library (heuristic, not LLM). */
const HINT_TOKENS = [
  "typescript",
  "javascript",
  "python",
  "java",
  "golang",
  "go",
  "rust",
  "react",
  "next.js",
  "node.js",
  "nodejs",
  "postgresql",
  "postgres",
  "mysql",
  "mongodb",
  "redis",
  "aws",
  "gcp",
  "azure",
  "kubernetes",
  "docker",
  "graphql",
  "rest",
  "kafka",
  "spark",
  "tensorflow",
  "pytorch",
  "figma",
  "swift",
  "kotlin",
];

/**
 * Local gap analysis: JD vs library. No OpenRouter call.
 */
export async function runGapCheck(
  db: FoliyoDb,
  userId: string,
  jdText: string,
): Promise<GapCheckResult> {
  const skills = await queryAll<{ id: string; name: string; status: string }>(
    db,
    "SELECT id, name, status FROM skills WHERE user_id = ?",
    [userId],
  );
  const confirmed = skills.filter((s) => s.status === "confirmed" || !s.status);
  const matchedIds = new Set(matchSkillNames(jdText, confirmed));
  const matched_skills = confirmed
    .filter((s) => matchedIds.has(s.id))
    .map((s) => ({ id: s.id, name: s.name }));

  const libraryNames = new Set(skills.map((s) => s.name.trim().toLowerCase()).filter(Boolean));
  const jdLower = jdText.toLowerCase();
  const missing_skill_hints = HINT_TOKENS.filter((t) => {
    const re = new RegExp(`\\b${escapeRegex(t.replace(".", "\\."))}\\b`, "i");
    return re.test(jdLower) && !libraryNames.has(t) && !libraryNames.has(t.replace(".js", ""));
  }).slice(0, 12);

  const [expCount] = await queryAll<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM experience WHERE user_id = ?",
    [userId],
  );
  const [projCount] = await queryAll<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM projects WHERE user_id = ?",
    [userId],
  );
  const [eduCount] = await queryAll<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM education WHERE user_id = ?",
    [userId],
  );

  const findings: GapFinding[] = [];

  if (matched_skills.length === 0) {
    findings.push({
      id: "skills_none",
      severity: "warn",
      title: "No confirmed skills matched this JD",
      detail: "Add or confirm skills in your library that appear in the posting, then tailor again.",
    });
  } else {
    findings.push({
      id: "skills_ok",
      severity: "ok",
      title: `${matched_skills.length} skill${matched_skills.length === 1 ? "" : "s"} matched`,
      detail: matched_skills.map((s) => s.name).join(", "),
    });
  }

  if (missing_skill_hints.length) {
    findings.push({
      id: "skills_missing",
      severity: "info",
      title: "JD mentions skills not in your library",
      detail: missing_skill_hints.join(", "),
    });
  }

  const exps = Number(expCount?.n ?? 0);
  const projs = Number(projCount?.n ?? 0);
  const edus = Number(eduCount?.n ?? 0);

  if (exps === 0) {
    findings.push({
      id: "experience_empty",
      severity: "warn",
      title: "No experience entries",
      detail: "Add at least one role so tailored resumes have work history.",
    });
  }
  if (projs === 0) {
    findings.push({
      id: "projects_empty",
      severity: "info",
      title: "No projects yet",
      detail: "A couple of strong projects help when experience is thin.",
    });
  }
  if (edus === 0) {
    findings.push({
      id: "education_empty",
      severity: "info",
      title: "No education entries",
      detail: "Optional for seniors; useful for early-career applications.",
    });
  }

  if (!/\d\+?\s*years?/i.test(jdText) && !/\b(senior|staff|principal|junior|intern)\b/i.test(jdText)) {
    findings.push({
      id: "level_unclear",
      severity: "info",
      title: "JD seniority is unclear",
      detail: "Skim for level (junior/senior) before rewriting bullets.",
    });
  }

  return { matched_skills, missing_skill_hints, findings, llm: false };
}
