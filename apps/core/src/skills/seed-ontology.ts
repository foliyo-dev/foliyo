import { randomBytes } from "node:crypto";
import { loadSeedPacks } from "@foliyo/jobs-client/seed";
import { normalizeSkillKey } from "../jobs/aliases.js";
import { queryAll, queryOne, run, type FoliyoDb } from "../db.js";

function newId(): string {
  return randomBytes(16).toString("hex");
}

export type SeedOntologyResult = {
  globals_created: number;
  aliases_created: number;
  skipped: boolean;
  packs: string[];
};

/**
 * Upsert global_skills + skill_aliases from CSV seed packs.
 * Safe on every boot: inserts only missing rows (does not overwrite admin edits).
 */
export async function seedSkillOntology(db: FoliyoDb): Promise<SeedOntologyResult> {
  const loaded = loadSeedPacks();
  const byCanonical = new Map<string, string>(); // normalized_key → id
  let globals_created = 0;
  let aliases_created = 0;

  const ensureGlobal = async (
    normalizedKey: string,
    canonicalName: string,
    category: string,
  ): Promise<string> => {
    const key = normalizeSkillKey(normalizedKey) || normalizedKey;
    const cached = byCanonical.get(key);
    if (cached) return cached;

    const row = await queryOne<{ id: string }>(
      db,
      "SELECT id FROM global_skills WHERE normalized_key = ?",
      [key],
    );
    if (row) {
      byCanonical.set(key, row.id);
      return row.id;
    }

    const id = newId();
    await run(
      db,
      `INSERT INTO global_skills (id, canonical_name, normalized_key, category)
       VALUES (?, ?, ?, ?)`,
      [id, canonicalName, key, category || "general"],
    );
    byCanonical.set(key, id);
    globals_created += 1;
    return id;
  };

  const ensureAlias = async (skillId: string, aliasKey: string): Promise<void> => {
    if (!aliasKey) return;
    const hit = await queryOne<{ id: string }>(
      db,
      "SELECT id FROM skill_aliases WHERE alias = ?",
      [aliasKey],
    );
    if (hit) return;
    await run(
      db,
      `INSERT INTO skill_aliases (id, skill_id, alias, source) VALUES (?, ?, ?, 'seed')`,
      [newId(), skillId, aliasKey],
    );
    aliases_created += 1;
  };

  for (const g of loaded.globals) {
    await ensureGlobal(g.normalized_key, g.canonical_name, g.category);
  }

  for (const a of loaded.aliases) {
    const skillId = byCanonical.get(a.normalized_key);
    if (!skillId) {
      // Global may already exist from a prior boot; resolve by key.
      const row = await queryOne<{ id: string }>(
        db,
        "SELECT id FROM global_skills WHERE normalized_key = ?",
        [a.normalized_key],
      );
      if (!row) continue;
      byCanonical.set(a.normalized_key, row.id);
      await ensureAlias(row.id, a.alias);
      continue;
    }
    await ensureAlias(skillId, a.alias);
  }

  // Self-alias every global (seeded this run or pre-existing).
  const all = await queryAll<{ id: string; normalized_key: string }>(
    db,
    "SELECT id, normalized_key FROM global_skills",
    [],
  );
  for (const g of all) {
    await ensureAlias(g.id, g.normalized_key);
  }

  return {
    globals_created,
    aliases_created,
    skipped: globals_created === 0 && aliases_created === 0,
    packs: loaded.packs.map((p) => p.id),
  };
}
