import { queryAll, queryOne, type FoliyoDb } from "../db.js";
import { getResumeContentIds, type ResumeContentIds } from "../resume/content.js";
import { displaySkillName, normalizeSkillKey } from "./aliases.js";
import { parseJobDocument } from "./parse.js";
import type {
  BaselineKind,
  EvidenceRef,
  JobAnalysis,
  JobDocument,
  JobDocumentParser,
  MatchBand,
  ProposedChange,
  SkillMatch,
} from "./types.js";
import { buildVerdict } from "./verdict.js";

export type AnalyzeInput = {
  jdText: string;
  resumeId?: string;
  portfolioId?: string;
  enhance?: boolean;
  parser?: JobDocumentParser;
};

type LibrarySkill = {
  id: string;
  name: string;
  recency: "current" | "past" | null;
};

function emptyContent(): ResumeContentIds {
  return {
    skill_ids: [],
    project_ids: [],
    experience_ids: [],
    education_ids: [],
    certification_ids: [],
    language_ids: [],
  };
}

async function getPortfolioContentIds(db: FoliyoDb, portfolioId: string): Promise<ResumeContentIds> {
  const skill_ids = (
    await queryAll<{ skill_id: string }>(
      db,
      "SELECT skill_id FROM portfolio_skills WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.skill_id);
  const project_ids = (
    await queryAll<{ project_id: string }>(
      db,
      "SELECT project_id FROM portfolio_projects WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.project_id);
  const experience_ids = (
    await queryAll<{ experience_id: string }>(
      db,
      "SELECT experience_id FROM portfolio_experience WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.experience_id);
  const education_ids = (
    await queryAll<{ education_id: string }>(
      db,
      "SELECT education_id FROM portfolio_education WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.education_id);
  const certification_ids = (
    await queryAll<{ certification_id: string }>(
      db,
      "SELECT certification_id FROM portfolio_certifications WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.certification_id);
  const language_ids = (
    await queryAll<{ language_id: string }>(
      db,
      "SELECT language_id FROM portfolio_languages WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.language_id);
  return {
    skill_ids,
    project_ids,
    experience_ids,
    education_ids,
    certification_ids,
    language_ids,
  };
}

async function resolveBaseline(
  db: FoliyoDb,
  userId: string,
  resumeId?: string,
  portfolioId?: string,
): Promise<{
  kind: BaselineKind;
  id: string | null;
  label: string | null;
  content: ResumeContentIds;
}> {
  if (resumeId) {
    const row = await queryOne<{ id: string; name: string }>(
      db,
      "SELECT id, name FROM resumes WHERE id = ? AND user_id = ?",
      [resumeId, userId],
    );
    if (row) {
      return {
        kind: "resume",
        id: row.id,
        label: row.name,
        content: await getResumeContentIds(db, row.id),
      };
    }
  }

  if (portfolioId) {
    const folio = await queryOne<{ id: string; name: string }>(
      db,
      "SELECT id, name FROM portfolios WHERE id = ? AND user_id = ?",
      [portfolioId, userId],
    );
    if (folio) {
      return {
        kind: "portfolio",
        id: folio.id,
        label: folio.name,
        content: await getPortfolioContentIds(db, folio.id),
      };
    }
  }

  /** No resume_id / portfolio_id → full-library baseline (empty selection). */
  return { kind: "none", id: null, label: null, content: emptyContent() };
}

function bandFor(skill: LibrarySkill | undefined, evidenceCount: number): MatchBand {
  if (!skill) return "missing";
  if (evidenceCount === 0) return "weak";
  if (skill.recency === "past") return "historical";
  return "strong";
}

function explanationFor(match: {
  band: MatchBand;
  skillName: string | null;
  evidence: EvidenceRef[];
  recency: "current" | "past" | null;
}): string {
  if (match.band === "missing") {
    return "Not in your library.";
  }
  if (match.band === "weak") {
    return "In Skills, no project or experience proof.";
  }
  const counts = new Map<string, number>();
  for (const e of match.evidence) {
    const label = e.label.trim() || "Library";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const labels = [...counts.entries()].map(([label, count]) =>
    count > 1 ? `${label} ×${count}` : label,
  );
  const from = labels.length ? `Found in: ${labels.join(", ")}.` : "Found in your Skills library.";
  if (match.band === "historical") {
    return `${from} Marked as a past skill — strong historical match, lower current confidence.`;
  }
  return from;
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

/**
 * Analyze a pasted JD against the user's Library. Never invents skills.
 * LLM parse is optional (cloud hook); heuristic always works.
 */
export async function runJobAnalyze(
  db: FoliyoDb,
  userId: string,
  input: AnalyzeInput,
): Promise<JobAnalysis> {
  const confirmed = await queryAll<LibrarySkill>(
    db,
    `SELECT id, name, recency FROM skills
     WHERE user_id = ? AND status = 'confirmed' AND deleted_at IS NULL`,
    [userId],
  );

  let job: JobDocument = parseJobDocument(
    input.jdText,
    confirmed.map((s) => s.name),
  );
  let llm_skip_reason: JobAnalysis["llm_skip_reason"] = "not_requested";

  if (input.parser) {
    const parsed = await input.parser({
      userId,
      text: input.jdText,
      enhance: Boolean(input.enhance),
    });
    if (parsed.ok && parsed.job.requirements.length > 0) {
      job = {
        ...parsed.job,
        rawText: input.jdText,
        parse: "llm",
        requirements: parsed.job.requirements.map((r) => ({
          ...r,
          normalized: normalizeSkillKey(r.name) || r.normalized,
        })),
      };
      llm_skip_reason = undefined;
    } else if (!parsed.ok) {
      llm_skip_reason = parsed.reason;
    } else {
      llm_skip_reason = "failed";
    }
  } else if (input.enhance) {
    llm_skip_reason = "unavailable";
  }

  const byCanonical = new Map<string, LibrarySkill>();
  for (const s of confirmed) {
    const key = normalizeSkillKey(s.name);
    if (!byCanonical.has(key)) byCanonical.set(key, s);
  }

  const skillReqs = job.requirements.filter((r) => r.type === "skill");
  const matchSkillIds = skillReqs
    .map((r) => byCanonical.get(r.normalized)?.id)
    .filter((id): id is string => Boolean(id));

  const evidenceBySkill = new Map<string, EvidenceRef[]>();
  if (matchSkillIds.length) {
    const evidenceRows = await queryAll<{
      skill_id: string;
      source_type: EvidenceRef["source_type"];
      source_id: string;
      company: string | null;
      title: string | null;
      institution: string | null;
      cert_name: string | null;
    }>(
      db,
      `SELECT se.skill_id, se.source_type, se.source_id,
              e.company, p.title, edu.institution, c.name as cert_name
       FROM skill_evidence se
       LEFT JOIN experience e ON se.source_type = 'experience' AND e.id = se.source_id
       LEFT JOIN projects p ON se.source_type = 'project' AND p.id = se.source_id
       LEFT JOIN education edu ON se.source_type = 'education' AND edu.id = se.source_id
       LEFT JOIN certifications c ON se.source_type = 'certification' AND c.id = se.source_id
       WHERE se.skill_id IN (${matchSkillIds.map(() => "?").join(",")})`,
      matchSkillIds,
    );
    for (const row of evidenceRows) {
      let label = "Library";
      if (row.source_type === "experience") label = row.company ?? "Experience";
      else if (row.source_type === "project") label = row.title ?? "Project";
      else if (row.source_type === "education") label = row.institution ?? "Education";
      else if (row.source_type === "certification") label = row.cert_name ?? "Certification";
      const list = evidenceBySkill.get(row.skill_id) ?? [];
      if (!list.some((e) => e.source_type === row.source_type && e.source_id === row.source_id)) {
        list.push({ source_type: row.source_type, source_id: row.source_id, label });
      }
      evidenceBySkill.set(row.skill_id, list);
    }
  }

  const baseline = await resolveBaseline(db, userId, input.resumeId, input.portfolioId);
  const baselineSkillSet = new Set(baseline.content.skill_ids);
  const baselineProjectSet = new Set(baseline.content.project_ids);
  const baselineExperienceSet = new Set(baseline.content.experience_ids);

  const matches: SkillMatch[] = skillReqs.map((requirement) => {
    const skill = byCanonical.get(requirement.normalized);
    const evidence = skill ? (evidenceBySkill.get(skill.id) ?? []) : [];
    const band = bandFor(skill, evidence.length);
    const recency = skill?.recency ?? null;
    return {
      requirement: {
        ...requirement,
        name: skill?.name ?? displaySkillName(requirement.name),
      },
      band,
      skill_id: skill?.id ?? null,
      skill_name: skill?.name ?? null,
      recency,
      evidence,
      explanation: explanationFor({
        band,
        skillName: skill?.name ?? null,
        evidence,
        recency,
      }),
    };
  });

  const requiredTotal = matches.length;
  const requiredInLibrary = matches.filter((m) => m.band !== "missing").length;
  const requiredOnResume = matches.filter(
    (m) => m.skill_id && m.band !== "missing" && baselineSkillSet.has(m.skill_id),
  ).length;

  const coverage = {
    required_total: requiredTotal,
    required_in_library: requiredInLibrary,
    required_on_resume: requiredOnResume,
  };

  const verdict = buildVerdict(coverage, baseline.kind !== "none", baseline.kind, baseline.label);

  const matchedCanonical = new Set(
    matches.filter((m) => m.band !== "missing" && m.skill_id).map((m) => m.requirement.normalized),
  );

  const proposed_changes: ProposedChange[] = [];

  for (const m of matches) {
    if (!m.skill_id || m.band === "missing") continue;
    if (baselineSkillSet.has(m.skill_id)) continue;
    proposed_changes.push({
      id: `add_skill:${m.skill_id}`,
      action: "add_skill",
      label: m.skill_name ?? m.requirement.name,
      detail:
        m.band === "weak"
          ? "In your Library (self-reported). Include only if you want it on this resume."
          : `Add from Library (${m.band}).`,
      entity_id: m.skill_id,
      entity_type: "skill",
      default_accepted: m.band !== "weak",
    });
  }

  const keepSkillIds = matches
    .filter((m) => m.skill_id && m.band !== "missing" && baselineSkillSet.has(m.skill_id))
    .map((m) => m.skill_id!);
  const keepProjectIds: string[] = [];
  const keepExperienceIds: string[] = [];

  const projects = await queryAll<{ id: string; title: string; skills_developed: string }>(
    db,
    "SELECT id, title, skills_developed FROM projects WHERE user_id = ? AND deleted_at IS NULL",
    [userId],
  );
  for (const p of projects) {
    const tags = parseTags(p.skills_developed).map((t) => normalizeSkillKey(t));
    if (!tags.some((t) => matchedCanonical.has(t))) continue;
    if (baselineProjectSet.has(p.id)) {
      keepProjectIds.push(p.id);
      continue;
    }
    proposed_changes.push({
      id: `add_project:${p.id}`,
      action: "add_project",
      label: p.title,
      detail: "Project tagged with skills this JD asks for.",
      entity_id: p.id,
      entity_type: "project",
      default_accepted: true,
    });
  }

  const experiences = await queryAll<{
    id: string;
    company: string;
    role: string;
    skills_developed: string;
  }>(
    db,
    "SELECT id, company, role, skills_developed FROM experience WHERE user_id = ? AND deleted_at IS NULL",
    [userId],
  );
  for (const e of experiences) {
    const tags = parseTags(e.skills_developed).map((t) => normalizeSkillKey(t));
    if (!tags.some((t) => matchedCanonical.has(t))) continue;
    if (baselineExperienceSet.has(e.id)) {
      keepExperienceIds.push(e.id);
      continue;
    }
    proposed_changes.push({
      id: `add_experience:${e.id}`,
      action: "add_experience",
      label: `${e.role} — ${e.company}`,
      detail: "Role tagged with skills this JD asks for.",
      entity_id: e.id,
      entity_type: "experience",
      default_accepted: true,
    });
  }

  const confirmedById = new Map(confirmed.map((s) => [s.id, s]));
  for (const skillId of baseline.content.skill_ids) {
    const skill = confirmedById.get(skillId);
    if (!skill) continue;
    const key = normalizeSkillKey(skill.name);
    if (matchedCanonical.has(key)) continue;
    proposed_changes.push({
      id: `deemphasize_skill:${skillId}`,
      action: "deemphasize_skill",
      label: skill.name,
      detail: "On this version, but not in the JD.",
      entity_id: skillId,
      entity_type: "skill",
      default_accepted: true,
    });
  }

  return {
    job: {
      title: job.title,
      company: job.company,
      location: job.location,
      rawText: job.rawText,
      requirements: job.requirements,
      parse: job.parse,
    },
    verdict,
    coverage,
    matches,
    proposed_changes,
    keep: {
      skill_ids: keepSkillIds,
      project_ids: keepProjectIds,
      experience_ids: keepExperienceIds,
    },
    baseline: { kind: baseline.kind, id: baseline.id, label: baseline.label },
    ...(llm_skip_reason ? { llm_skip_reason } : {}),
  };
}

export function defaultAcceptedIds(analysis: JobAnalysis): Set<string> {
  return new Set(analysis.proposed_changes.filter((c) => c.default_accepted).map((c) => c.id));
}

/** Map reviewed checkboxes to tailor `approved` payload. Never includes missing JD skills. */
export function approvedFromChanges(
  analysis: JobAnalysis,
  acceptedIds: Iterable<string>,
): {
  skill_ids: string[];
  project_ids: string[];
  experience_ids: string[];
} {
  const accepted = new Set(acceptedIds);
  const skill_ids = new Set<string>(analysis.keep.skill_ids);
  const project_ids = new Set<string>(analysis.keep.project_ids);
  const experience_ids = new Set<string>(analysis.keep.experience_ids);

  for (const m of analysis.matches) {
    if (!m.skill_id || m.band === "missing") continue;
    const addId = `add_skill:${m.skill_id}`;
    const hasAdd = analysis.proposed_changes.some((c) => c.id === addId);
    if (hasAdd) {
      if (accepted.has(addId)) skill_ids.add(m.skill_id);
      else skill_ids.delete(m.skill_id);
    }
  }

  for (const c of analysis.proposed_changes) {
    if (c.action === "add_project") {
      if (accepted.has(c.id)) project_ids.add(c.entity_id);
      else project_ids.delete(c.entity_id);
    }
    if (c.action === "add_experience") {
      if (accepted.has(c.id)) experience_ids.add(c.entity_id);
      else experience_ids.delete(c.entity_id);
    }
    if (c.action === "deemphasize_skill") {
      if (accepted.has(c.id)) skill_ids.delete(c.entity_id);
      else skill_ids.add(c.entity_id);
    }
  }

  return {
    skill_ids: [...skill_ids],
    project_ids: [...project_ids],
    experience_ids: [...experience_ids],
  };
}
