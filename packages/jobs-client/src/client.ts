import type { JobAnalysis, SkillMatch, ApprovedContent } from "./types.js";

export function defaultAcceptedIds(analysis: JobAnalysis): Set<string> {
  return new Set(analysis.proposed_changes.filter((c) => c.default_accepted).map((c) => c.id));
}

/** Same rules as core `approvedFromChanges`. Never includes missing JD skills. */
export function approvedFromAnalysis(
  analysis: JobAnalysis,
  acceptedIds: Iterable<string>,
): ApprovedContent {
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

export function popupBands(matches: SkillMatch[]) {
  return {
    strong: matches.filter((m) => m.band === "strong"),
    partial: matches.filter((m) => m.band === "historical" || m.band === "weak"),
    missing: matches.filter((m) => m.band === "missing"),
  };
}
