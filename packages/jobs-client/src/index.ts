export type * from "./types.js";
export {
  approvedFromAnalysis,
  defaultAcceptedIds,
  popupBands,
} from "./client.js";
export { hashJdText, normalizeJdText } from "./hash.js";
export { formatResumeDay, suggestedTailoredResumeName } from "./names.js";
export {
  alnumKey,
  atsLabelFromJd,
  buildSkillCatalog,
  displaySkillName,
  escapeRegex,
  matchSkillsFromJd,
  mentionedIn,
  mentionTermsFor,
  normalizeSkillKey,
  normKey,
  resolveCanonicalKey,
  skillMentionRegex,
} from "./aliases.js";
export type { SkillCatalog, SkillCatalogRow } from "./aliases.js";
