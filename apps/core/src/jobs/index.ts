export type {
  BaselineKind,
  Coverage,
  EvidenceRef,
  FitBand,
  JobAnalysis,
  JobDocument,
  JobDocumentParser,
  LlmSkipReason,
  MatchBand,
  ProposedChange,
  ProposedChangeAction,
  Requirement,
  RequirementImportance,
  RequirementType,
  ResumeBand,
  SkillMatch,
  SkillMatchType,
  Verdict,
} from "./types.js";

export {
  atsLabelFromJd,
  buildSkillCatalog,
  displaySkillName,
  matchSkillsFromJd,
  mentionedIn,
  mentionTermsFor,
  normalizeSkillKey,
  normKey,
  resolveCanonicalKey,
  skillMentionRegex,
} from "./aliases.js";
export type { SkillCatalog, SkillCatalogRow } from "./aliases.js";

/** Node-only — prefer importing from `@foliyo/jobs-client/seed` in new code. */
export {
  catalogFromSeedAliases,
  catalogFromSeedPacks,
  loadSeedPacks,
  parseCsv,
} from "./aliases.js";
export type {
  LoadedSeedPacks,
  SeedAlias,
  SeedGlobalSkill,
  SeedPack,
} from "./aliases.js";

export {
  gateJdText,
  looksLikeJobDescription,
  missingSkillHintsFromJd,
  parseJobDocument,
  MAX_JD_CHARS,
  MIN_JD_CHARS,
} from "./parse.js";
export { buildVerdict, fitBand, resumeBand } from "./verdict.js";
export { approvedFromChanges, defaultAcceptedIds, runJobAnalyze } from "./analyze.js";
export {
  deleteJobAnalysis,
  getJobAnalysis,
  hashJdText as hashJdTextSync,
  listJobAnalyses,
  normalizeJdText,
  saveJobAnalysis,
  updateJobAnalysisAccepted,
} from "./store.js";
export type { JobAnalysisSummary, SavedJobAnalysis } from "./store.js";
