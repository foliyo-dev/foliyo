export type RequirementImportance = "required" | "preferred" | "nice_to_have";

export type RequirementType = "skill" | "experience" | "education" | "certification";

export type Requirement = {
  type: RequirementType;
  name: string;
  importance: RequirementImportance;
  /** Alias-normalized key, e.g. "kubernetes" for "K8s". */
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

export type Coverage = {
  required_total: number;
  required_in_library: number;
  required_on_resume: number;
};

export type FitBand = "strong" | "partial" | "weak" | "unknown";
export type ResumeBand = "shows_it" | "underplays" | "no_resume";

export type Verdict = {
  fit: FitBand;
  resume: ResumeBand;
  sentence: string;
};

export type ProposedChangeAction =
  | "add_skill"
  | "add_project"
  | "add_experience"
  | "deemphasize_skill";

export type ProposedChange = {
  id: string;
  action: ProposedChangeAction;
  label: string;
  detail: string;
  entity_id: string;
  entity_type: "skill" | "project" | "experience";
  default_accepted: boolean;
};

export type BaselineKind = "resume" | "portfolio" | "none";

export type JobAnalysis = {
  /** Present when this analysis was persisted for the user. */
  id?: string;
  job: JobDocument;
  verdict: Verdict;
  coverage: Coverage;
  matches: SkillMatch[];
  proposed_changes: ProposedChange[];
  /** Matched Library items already on the baseline resume/folio — kept unless deemphasized. */
  keep: {
    skill_ids: string[];
    project_ids: string[];
    experience_ids: string[];
  };
  baseline: {
    kind: BaselineKind;
    id: string | null;
    /** Resume or folio name when we compared against one. */
    label?: string | null;
  };
  llm_skip_reason?: "not_requested" | "unavailable" | "not_pro" | "units" | "failed";
};

export type LlmSkipReason = NonNullable<JobAnalysis["llm_skip_reason"]>;

/** Optional cloud hook — never required for a useful heuristic analysis. */
export type JobDocumentParser = (input: {
  userId: string;
  text: string;
  enhance: boolean;
}) => Promise<
  | { ok: true; job: Pick<JobDocument, "title" | "company" | "location" | "requirements" | "parse"> }
  | { ok: false; reason: LlmSkipReason }
>;
