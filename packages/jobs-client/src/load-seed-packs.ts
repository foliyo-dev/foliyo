/**
 * Load skill ontology seed packs from CSV under `seed/packs/`.
 * Runtime matching must use the DB — this is bootstrap / upsert only.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSkillCatalog, type SkillCatalog } from "./aliases.js";

export type SeedGlobalSkill = {
  normalized_key: string;
  canonical_name: string;
  category: string;
};

export type SeedAlias = {
  alias: string;
  normalized_key: string;
};

export type SeedPack = {
  id: string;
  globals: SeedGlobalSkill[];
  aliases: SeedAlias[];
};

export type LoadedSeedPacks = {
  packs: SeedPack[];
  globals: SeedGlobalSkill[];
  aliases: SeedAlias[];
};

function seedRootDir(): string {
  // src/load-seed-packs.ts → ../seed
  return join(dirname(fileURLToPath(import.meta.url)), "..", "seed");
}

/** Minimal RFC4180-ish CSV parse (quoted fields, commas, newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");
  while (i < s.length) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const out: Record<string, string>[] = [];
  for (const cells of rows.slice(1)) {
    const obj: Record<string, string> = {};
    let empty = true;
    for (let i = 0; i < header.length; i++) {
      const key = header[i]!;
      const val = (cells[i] ?? "").trim();
      if (val) empty = false;
      obj[key] = val;
    }
    if (!empty) out.push(obj);
  }
  return out;
}

function loadPackDir(packId: string, packDir: string): SeedPack {
  const globalsPath = join(packDir, "global_skills.csv");
  const aliasesPath = join(packDir, "skill_aliases.csv");
  if (!existsSync(globalsPath)) {
    throw new Error(`Seed pack "${packId}" missing global_skills.csv at ${globalsPath}`);
  }
  if (!existsSync(aliasesPath)) {
    throw new Error(`Seed pack "${packId}" missing skill_aliases.csv at ${aliasesPath}`);
  }

  const globalRows = rowsToObjects(parseCsv(readFileSync(globalsPath, "utf8")));
  const aliasRows = rowsToObjects(parseCsv(readFileSync(aliasesPath, "utf8")));

  const globals: SeedGlobalSkill[] = [];
  const seenKeys = new Set<string>();
  for (const r of globalRows) {
    const normalized_key = (r.normalized_key ?? "").trim().toLowerCase();
    const canonical_name = (r.canonical_name ?? "").trim();
    const category = (r.category ?? "general").trim() || "general";
    if (!normalized_key) {
      throw new Error(`Pack "${packId}": global_skills row missing normalized_key`);
    }
    if (!canonical_name) {
      throw new Error(`Pack "${packId}": global_skills "${normalized_key}" missing canonical_name`);
    }
    if (seenKeys.has(normalized_key)) {
      throw new Error(`Pack "${packId}": duplicate normalized_key "${normalized_key}"`);
    }
    seenKeys.add(normalized_key);
    globals.push({ normalized_key, canonical_name, category });
  }

  const aliases: SeedAlias[] = [];
  const seenAliases = new Set<string>();
  for (const r of aliasRows) {
    const alias = (r.alias ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const normalized_key = (r.normalized_key ?? "").trim().toLowerCase();
    if (!alias || !normalized_key) {
      throw new Error(`Pack "${packId}": skill_aliases row needs alias + normalized_key`);
    }
    if (seenAliases.has(alias)) {
      throw new Error(`Pack "${packId}": duplicate alias "${alias}"`);
    }
    seenAliases.add(alias);
    aliases.push({ alias, normalized_key });
  }

  for (const a of aliases) {
    if (!seenKeys.has(a.normalized_key)) {
      throw new Error(
        `Pack "${packId}": alias "${a.alias}" points at unknown normalized_key "${a.normalized_key}"`,
      );
    }
  }

  return { id: packId, globals, aliases };
}

/**
 * Load packs listed in seed/manifest.json (or all dirs if manifest missing packs).
 */
export function loadSeedPacks(rootDir = seedRootDir()): LoadedSeedPacks {
  const manifestPath = join(rootDir, "manifest.json");
  let packIds: string[] = [];
  if (existsSync(manifestPath)) {
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as { packs?: string[] };
    packIds = Array.isArray(raw.packs) ? raw.packs.map(String) : [];
  }
  if (!packIds.length) {
    throw new Error(`No seed packs listed in ${manifestPath}`);
  }

  const packs: SeedPack[] = [];
  const globalByKey = new Map<string, SeedGlobalSkill>();
  const aliasByKey = new Map<string, SeedAlias>();

  for (const id of packIds) {
    const pack = loadPackDir(id, join(rootDir, "packs", id));
    packs.push(pack);
    for (const g of pack.globals) {
      if (!globalByKey.has(g.normalized_key)) globalByKey.set(g.normalized_key, g);
    }
    for (const a of pack.aliases) {
      if (!aliasByKey.has(a.alias)) aliasByKey.set(a.alias, a);
    }
  }

  return {
    packs,
    globals: [...globalByKey.values()],
    aliases: [...aliasByKey.values()],
  };
}

/** Build an in-memory SkillCatalog from CSV packs (tests / Node bootstrap only). */
export function catalogFromSeedPacks(rootDir = seedRootDir()): SkillCatalog {
  const loaded = loadSeedPacks(rootDir);
  const aliasesByKey = new Map<string, string[]>();
  for (const a of loaded.aliases) {
    const list = aliasesByKey.get(a.normalized_key) ?? [];
    list.push(a.alias);
    aliasesByKey.set(a.normalized_key, list);
  }
  return buildSkillCatalog(
    loaded.globals.map((g) => ({
      normalized_key: g.normalized_key,
      canonical_name: g.canonical_name,
      aliases: aliasesByKey.get(g.normalized_key) ?? [g.normalized_key],
    })),
  );
}

/** @deprecated Use catalogFromSeedPacks */
export const catalogFromSeedAliases = catalogFromSeedPacks;
