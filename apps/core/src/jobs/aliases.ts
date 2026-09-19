/**
 * Core re-exports browser-safe skill helpers from @foliyo/jobs-client.
 * CSV seed loading: import from `@foliyo/jobs-client/seed` (Node only).
 */
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
} from "@foliyo/jobs-client";
export type { SkillCatalog, SkillCatalogRow } from "@foliyo/jobs-client";
export {
  catalogFromSeedAliases,
  catalogFromSeedPacks,
  loadSeedPacks,
  parseCsv,
} from "@foliyo/jobs-client/seed";
export type {
  LoadedSeedPacks,
  SeedAlias,
  SeedGlobalSkill,
  SeedPack,
} from "@foliyo/jobs-client/seed";
