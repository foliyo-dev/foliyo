export type RequirementImportance = "required" | "preferred" | "nice_to_have";

export type RequirementType = "skill" | "experience" | "education" | "certification";

export type Requirement = {
  type: RequirementType;
  name: string;
  importance: RequirementImportance;
  normalized: string;
};

export type JobDocument = {
  title: string | null;
  company: string | null;
  location: string | null;
  rawText: string;
  requirements: Requirement[];
  parse: "heuristic" | "llm";
};

export type MatchBand = "strong" | "historical" | "weak" | "missing";

export type EvidenceRef = {
  source_type: "experience" | "project" | "education" | "certification";
  source_id: string;
  label: string;
};

export type SkillMatch = {
  requirement: Requirement;
  band: MatchBand;
  skill_id: string | null;
  skill_name: string | null;
  recency: "current" | "past" | null;
  evidence: EvidenceRef[];
  explanation: string;
};

export type ProposedChange = {
  id: string;
  action: "add_skill" | "add_project" | "add_experience" | "deemphasize_skill";
  label: string;
  detail: string;
  entity_id: string;
  entity_type: "skill" | "project" | "experience";
  default_accepted: boolean;
};

export type JobAnalysis = {
  /** Present when this analysis was persisted for the user. */
  id?: string;
  job: JobDocument;
  verdict: {
    fit: "strong" | "partial" | "weak" | "unknown";
    resume: "shows_it" | "underplays" | "no_resume";
    sentence: string;
  };
  coverage: {
    required_total: number;
    required_in_library: number;
    required_on_resume: number;
  };
  matches: SkillMatch[];
  proposed_changes: ProposedChange[];
  keep: {
    skill_ids: string[];
    project_ids: string[];
    experience_ids: string[];
  };
  baseline: { kind: "resume" | "portfolio" | "none"; id: string | null; label?: string | null };
  llm_skip_reason?: "not_requested" | "unavailable" | "not_pro" | "units" | "failed";
};

export type ApprovedContent = {
  skill_ids: string[];
  project_ids: string[];
  experience_ids: string[];
};

export type JobAnalysisSummary = {
  id: string;
  jd_hash: string;
  title: string | null;
  company: string | null;
  location: string | null;
  parse: "heuristic" | "llm";
  enhanced: boolean;
  fit: JobAnalysis["verdict"]["fit"];
  coverage: JobAnalysis["coverage"];
  created_at: string;
  updated_at: string;
};

export type SavedJobAnalysis = JobAnalysisSummary & {
  jd_text: string;
  portfolio_id: string | null;
  resume_id: string | null;
  accepted: string[];
  analysis: JobAnalysis;
};
