import { randomBytes } from "node:crypto";
import {
  alnumKey,
  buildSkillCatalog,
  normalizeSkillKey,
  type SkillCatalog,
} from "../jobs/aliases.js";
import { queryAll, queryOne, run, type FoliyoDb, type SqlValue } from "../db.js";

function newId(): string {
  return randomBytes(16).toString("hex");
}

export type GlobalSkillRow = {
  id: string;
  canonical_name: string;
  normalized_key: string;
  category: string;
  embedding_model: string | null;
  created_at: string;
};

export type SkillAliasRow = {
  id: string;
  skill_id: string;
  alias: string;
  source: string;
  created_at: string;
  canonical_name?: string;
};

export type ReviewQueueRow = {
  id: string;
  raw_term: string;
  normalized_key: string;
  candidate_skill_id: string | null;
  similarity_score: number | null;
  llm_verdict: string | null;
  status: string;
  source: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  candidate_name?: string | null;
};

/**
 * Resolve a raw term via skill_aliases → global_skills.
 * Returns null when unresolved (candidate for review / match_log).
 */
export async function resolveGlobalSkill(
  db: FoliyoDb,
  rawTerm: string,
): Promise<GlobalSkillRow | null> {
  const key = normalizeSkillKey(rawTerm);
  if (!key) return null;
  const folded = alnumKey(rawTerm);

  const lookupAlias = async (alias: string) =>
    queryOne<GlobalSkillRow>(
      db,
      `SELECT g.* FROM skill_aliases a
       JOIN global_skills g ON g.id = a.skill_id
       WHERE a.alias = ?`,
      [alias],
    );

  const viaAlias =
    (await lookupAlias(key)) ??
    (folded && folded !== key ? await lookupAlias(folded) : null);
  if (viaAlias) return viaAlias;

  return (
    (await queryOne<GlobalSkillRow>(
      db,
      "SELECT * FROM global_skills WHERE normalized_key = ?",
      [key],
    )) ?? null
  );
}

/** Load DB ontology into an in-memory SkillCatalog for heuristic parse / ATS labels. */
export async function loadSkillCatalog(db: FoliyoDb): Promise<SkillCatalog> {
  const globals = await queryAll<{ id: string; normalized_key: string; canonical_name: string }>(
    db,
    "SELECT id, normalized_key, canonical_name FROM global_skills",
    [],
  );
  const aliases = await queryAll<{ skill_id: string; alias: string }>(
    db,
    "SELECT skill_id, alias FROM skill_aliases",
    [],
  );
  const aliasesBySkill = new Map<string, string[]>();
  for (const a of aliases) {
    const list = aliasesBySkill.get(a.skill_id) ?? [];
    list.push(a.alias);
    aliasesBySkill.set(a.skill_id, list);
  }
  return buildSkillCatalog(
    globals.map((g) => ({
      normalized_key: g.normalized_key,
      canonical_name: g.canonical_name,
      aliases: aliasesBySkill.get(g.id) ?? [g.normalized_key],
    })),
  );
}

/** Log a match attempt; enqueue review when unresolved and not already pending. */
export async function logSkillMatch(
  db: FoliyoDb,
  input: {
    userId?: string | null;
    source: "jd" | "resume_import" | "manual";
    rawTerm: string;
    matchedSkillId?: string | null;
    matchType: "alias" | "embedding" | "llm" | "unresolved";
    score?: number | null;
  },
): Promise<void> {
  const normalized = normalizeSkillKey(input.rawTerm) || null;
  await run(
    db,
    `INSERT INTO match_log (id, user_id, source, raw_term, normalized_key, matched_skill_id, match_type, score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      input.userId ?? null,
      input.source,
      input.rawTerm,
      normalized,
      input.matchedSkillId ?? null,
      input.matchType,
      input.score ?? null,
    ],
  );

  if (input.matchType !== "unresolved" || !normalized) return;

  const pending = await queryOne<{ id: string }>(
    db,
    `SELECT id FROM skill_review_queue WHERE normalized_key = ? AND status = 'pending'`,
    [normalized],
  );
  if (pending) return;

  await run(
    db,
    `INSERT INTO skill_review_queue
       (id, raw_term, normalized_key, status, source, user_id)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    [
      newId(),
      input.rawTerm,
      normalized,
      input.source,
      input.userId ?? null,
    ],
  );
}

export type LibrarySkillIndexRow = {
  id: string;
  name: string;
  recency: "current" | "past" | null;
  canonical_skill_id: string | null;
};

/**
 * Index user library skills by name key and linked global `normalized_key`
 * so JD aliases (e.g. "people management" → team leadership) hit the library row.
 */
export async function buildLibrarySkillIndex(
  db: FoliyoDb,
  skills: LibrarySkillIndexRow[],
): Promise<Map<string, LibrarySkillIndexRow>> {
  const map = new Map<string, LibrarySkillIndexRow>();
  const globalIds = [
    ...new Set(
      skills
        .map((s) => s.canonical_skill_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const globalById = new Map<string, GlobalSkillRow>();
  if (globalIds.length) {
    const rows = await queryAll<GlobalSkillRow>(
      db,
      `SELECT * FROM global_skills WHERE id IN (${globalIds.map(() => "?").join(",")})`,
      globalIds,
    );
    for (const g of rows) globalById.set(g.id, g);
  }

  for (const s of skills) {
    const nameKey = normalizeSkillKey(s.name);
    if (nameKey && !map.has(nameKey)) map.set(nameKey, s);
    if (s.canonical_skill_id) {
      const g = globalById.get(s.canonical_skill_id);
      if (g?.normalized_key && !map.has(g.normalized_key)) {
        map.set(g.normalized_key, s);
      }
    }
  }
  return map;
}

/** Lazy-link a library skill to a global when an alias match proves the bridge. */
export async function linkUserSkillCanonical(
  db: FoliyoDb,
  skillId: string,
  canonicalSkillId: string,
): Promise<void> {
  await run(
    db,
    `UPDATE skills SET canonical_skill_id = ? WHERE id = ? AND (canonical_skill_id IS NULL OR canonical_skill_id = '')`,
    [canonicalSkillId, skillId],
  );
}

export type ResolveJdTermResult = {
  global: GlobalSkillRow | null;
  library: LibrarySkillIndexRow | null;
  /** Key for requirement.normalized / library lookup. */
  normalized: string;
  /** Ontology resolution type for match_log + SkillMatch. */
  matchType: "alias" | "unresolved";
};

/**
 * Resolve a JD skill term against DB ontology, then the library index.
 * Does not write match_log — caller logs once per term.
 */
export async function resolveJdTermAgainstLibrary(
  db: FoliyoDb,
  rawTerm: string,
  libraryByKey: Map<string, LibrarySkillIndexRow>,
): Promise<ResolveJdTermResult> {
  const staticKey = normalizeSkillKey(rawTerm);
  const global = await resolveGlobalSkill(db, rawTerm);
  const normalized =
    global?.normalized_key || staticKey || rawTerm.trim().toLowerCase();

  const library =
    (global ? libraryByKey.get(global.normalized_key) : undefined) ||
    (staticKey ? libraryByKey.get(staticKey) : undefined) ||
    (normalized && normalized !== staticKey ? libraryByKey.get(normalized) : undefined) ||
    null;

  // Deterministic hit (ontology or library name) → alias; else unresolved → review.
  const matchType: "alias" | "unresolved" =
    global || library ? "alias" : "unresolved";

  return { global, library, normalized, matchType };
}

/**
 * After JD extract / analyze: resolve each skill requirement; log + enqueue unresolved.
 * Prefer calling from `runJobAnalyze` (single path) rather than the LLM parser alone.
 */
export async function recordJdExtractedSkills(
  db: FoliyoDb,
  userId: string | null,
  requirements: Array<{ name: string; type?: string }>,
): Promise<{ resolved: number; unresolved: number }> {
  let resolved = 0;
  let unresolved = 0;
  for (const r of requirements) {
    if (r.type && r.type !== "skill") continue;
    const name = (r.name ?? "").trim();
    if (!name) continue;
    const hit = await resolveGlobalSkill(db, name);
    if (hit) {
      resolved += 1;
      await logSkillMatch(db, {
        userId,
        source: "jd",
        rawTerm: name,
        matchedSkillId: hit.id,
        matchType: "alias",
      });
    } else {
      unresolved += 1;
      await logSkillMatch(db, {
        userId,
        source: "jd",
        rawTerm: name,
        matchType: "unresolved",
      });
    }
  }
  return { resolved, unresolved };
}

/**
 * After a resume/fio import skill row exists: resolve via ontology, lazy-link,
 * and log (source=resume_import). Unresolved terms enqueue review.
 */
export async function resolveImportedSkill(
  db: FoliyoDb,
  userId: string,
  skillId: string,
  rawName: string,
): Promise<{ matchType: "alias" | "unresolved"; globalId: string | null }> {
  const global = await resolveGlobalSkill(db, rawName);
  if (global) {
    try {
      await linkUserSkillCanonical(db, skillId, global.id);
    } catch (err) {
      console.error(
        "[skills:import] link canonical failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  try {
    await logSkillMatch(db, {
      userId,
      source: "resume_import",
      rawTerm: rawName,
      matchedSkillId: global?.id ?? null,
      matchType: global ? "alias" : "unresolved",
    });
  } catch (err) {
    console.error(
      "[skills:import] match_log failed:",
      err instanceof Error ? err.message : err,
    );
  }
  return {
    matchType: global ? "alias" : "unresolved",
    globalId: global?.id ?? null,
  };
}

export async function listGlobalSkills(
  db: FoliyoDb,
  q?: string,
  limit = 100,
  offset = 0,
  category?: string,
): Promise<GlobalSkillRow[]> {
  const term = (q ?? "").trim().toLowerCase();
  const cat = (category ?? "").trim().toLowerCase();
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (term) {
    where.push(`(lower(canonical_name) LIKE ? OR lower(normalized_key) LIKE ?)`);
    const like = `%${term}%`;
    params.push(like, like);
  }
  if (cat) {
    where.push(`lower(category) = ?`);
    params.push(cat);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return queryAll<GlobalSkillRow>(
    db,
    `SELECT * FROM global_skills ${clause} ORDER BY canonical_name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
}

export async function countGlobalSkills(
  db: FoliyoDb,
  q?: string,
  category?: string,
): Promise<number> {
  const term = (q ?? "").trim().toLowerCase();
  const cat = (category ?? "").trim().toLowerCase();
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (term) {
    where.push(`(lower(canonical_name) LIKE ? OR lower(normalized_key) LIKE ?)`);
    const like = `%${term}%`;
    params.push(like, like);
  }
  if (cat) {
    where.push(`lower(category) = ?`);
    params.push(cat);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const row = await queryOne<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM global_skills ${clause}`,
    params,
  );
  return Number(row?.n ?? 0);
}

export async function listSkillCategories(
  db: FoliyoDb,
): Promise<{ category: string; cnt: number }[]> {
  const rows = await queryAll<{ category: string; cnt: number }>(
    db,
    `SELECT category, COUNT(*) AS cnt
     FROM global_skills
     GROUP BY category
     ORDER BY category ASC`,
    [],
  );
  return rows.map((r) => ({ category: r.category, cnt: Number(r.cnt) }));
}

/** Rename a category across all global skills. Returns rows updated. */
export async function renameSkillCategory(
  db: FoliyoDb,
  from: string,
  to: string,
): Promise<number> {
  const src = from.trim();
  const dest = to.trim() || "general";
  if (!src || src.toLowerCase() === dest.toLowerCase()) return 0;
  const before = await queryOne<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM global_skills WHERE lower(category) = lower(?)`,
    [src],
  );
  const n = Number(before?.n ?? 0);
  if (n === 0) return 0;
  await run(db, `UPDATE global_skills SET category = ? WHERE lower(category) = lower(?)`, [
    dest,
    src,
  ]);
  return n;
}

export async function listAliases(
  db: FoliyoDb,
  q?: string,
  limit = 200,
  offset = 0,
): Promise<SkillAliasRow[]> {
  const term = (q ?? "").trim().toLowerCase();
  if (!term) {
    return queryAll<SkillAliasRow>(
      db,
      `SELECT a.*, g.canonical_name FROM skill_aliases a
       JOIN global_skills g ON g.id = a.skill_id
       ORDER BY a.alias ASC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
  }
  const like = `%${term}%`;
  return queryAll<SkillAliasRow>(
    db,
    `SELECT a.*, g.canonical_name FROM skill_aliases a
     JOIN global_skills g ON g.id = a.skill_id
     WHERE lower(a.alias) LIKE ? OR lower(g.canonical_name) LIKE ?
     ORDER BY a.alias ASC LIMIT ? OFFSET ?`,
    [like, like, limit, offset],
  );
}

export async function countAliases(db: FoliyoDb, q?: string): Promise<number> {
  const term = (q ?? "").trim().toLowerCase();
  if (!term) {
    const row = await queryOne<{ n: number }>(db, `SELECT COUNT(*) AS n FROM skill_aliases`, []);
    return Number(row?.n ?? 0);
  }
  const like = `%${term}%`;
  const row = await queryOne<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM skill_aliases a
     JOIN global_skills g ON g.id = a.skill_id
     WHERE lower(a.alias) LIKE ? OR lower(g.canonical_name) LIKE ?`,
    [like, like],
  );
  return Number(row?.n ?? 0);
}

/** Mark historical unresolved match_log rows as resolved after an alias/global is approved. */
export async function resolveMatchLogForKey(
  db: FoliyoDb,
  normalizedKey: string,
  skillId: string,
  userAction = "approved",
): Promise<void> {
  await run(
    db,
    `UPDATE match_log
     SET match_type = 'alias', matched_skill_id = ?, user_action = ?
     WHERE normalized_key = ? AND match_type = 'unresolved'`,
    [skillId, userAction, normalizedKey],
  );
}

export async function adminOverviewCounts(db: FoliyoDb): Promise<{
  global_skills: number;
  aliases: number;
  pending_reviews: number;
  unresolved_matches: number;
}> {
  const one = async (sql: string) => {
    const row = await queryOne<{ n: number }>(db, sql, []);
    return Number(row?.n ?? 0);
  };
  return {
    global_skills: await one("SELECT COUNT(*) AS n FROM global_skills"),
    aliases: await one("SELECT COUNT(*) AS n FROM skill_aliases"),
    pending_reviews: await one(
      `SELECT COUNT(*) AS n FROM skill_review_queue WHERE status = 'pending'`,
    ),
    // Distinct still-open keys (exclude terms already in the alias table).
    unresolved_matches: await one(
      `SELECT COUNT(*) AS n FROM (
         SELECT m.normalized_key
         FROM match_log m
         WHERE m.match_type = 'unresolved'
           AND m.normalized_key IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM skill_aliases a WHERE a.alias = m.normalized_key
           )
         GROUP BY m.normalized_key
       )`,
    ),
  };
}
