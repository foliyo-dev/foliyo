/**
 * Node-only seed helpers (CSV packs + fs).
 * Do not import from dashboard/extension — use `@foliyo/jobs-client` for browser-safe APIs.
 */
export {
  catalogFromSeedAliases,
  catalogFromSeedPacks,
  loadSeedPacks,
  parseCsv,
} from "./load-seed-packs.js";
export type {
  LoadedSeedPacks,
  SeedAlias,
  SeedGlobalSkill,
  SeedPack,
} from "./load-seed-packs.js";
