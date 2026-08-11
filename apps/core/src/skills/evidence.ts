import { queryAll, queryOne, run, type FoliyoDb } from "../db.js";

export type SkillSourceType = "experience" | "project" | "education" | "certification";

export type TagSource = {
  name: string;
  source_type: SkillSourceType;
  source_id: string;
};

export type SoftSkillHints = {
  level: "beginner" | "intermediate" | "advanced" | "expert";
  recency: "current" | "past";
  years: number | null;
};

function parseSkillsDeveloped(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => String(t).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Collect skills_developed from the user's library entities. */
export async function collectLibraryTags(db: FoliyoDb, userId: string): Promise<TagSource[]> {
  const out: TagSource[] = [];

  const experiences = await queryAll<{ id: string; skills_developed: string }>(
    db,
    "SELECT id, skills_developed FROM experience WHERE user_id = ?",
    [userId],
  );
  for (const row of experiences) {
    for (const name of parseSkillsDeveloped(row.skills_developed)) {
      out.push({ name, source_type: "experience", source_id: row.id });
    }
  }

  const projects = await queryAll<{ id: string; skills_developed: string }>(
    db,
    "SELECT id, skills_developed FROM projects WHERE user_id = ?",
    [userId],
  );
  for (const row of projects) {
    for (const name of parseSkillsDeveloped(row.skills_developed)) {
      out.push({ name, source_type: "project", source_id: row.id });
    }
  }

  const education = await queryAll<{ id: string; skills_developed: string }>(
    db,
    "SELECT id, skills_developed FROM education WHERE user_id = ?",
    [userId],
  );
  for (const row of education) {
    for (const name of parseSkillsDeveloped(row.skills_developed)) {
      out.push({ name, source_type: "education", source_id: row.id });
    }
  }

  const certifications = await queryAll<{ id: string; skills_developed: string }>(
    db,
    "SELECT id, skills_developed FROM certifications WHERE user_id = ?",
    [userId],
  );
  for (const row of certifications) {
    for (const name of parseSkillsDeveloped(row.skills_developed)) {
      out.push({ name, source_type: "certification", source_id: row.id });
    }
  }

  return out;
}

/**
 * Recompute suggested skills + evidence from library skills_developed.
 * Does not auto-confirm. Skips dismissed names. Does not change confirmed levels/recency.
 */
export async function suggestSkillsFromLibrary(
  db: FoliyoDb,
  userId: string,
): Promise<{ found: number; pending: number }> {
  const tags = await collectLibraryTags(db, userId);

  const byKey = new Map<string, { name: string; sources: TagSource[] }>();
  for (const t of tags) {
    const key = normKey(t.name);
    const cur = byKey.get(key);
    if (cur) {
      cur.sources.push(t);
    } else {
      byKey.set(key, { name: t.name.trim(), sources: [t] });
    }
  }

  const existing = await queryAll<{
    id: string;
    name: string;
    status: string;
    source: string;
  }>(db, "SELECT id, name, status, source FROM skills WHERE user_id = ?", [userId]);

  const byExistingKey = new Map(existing.map((s) => [normKey(s.name), s]));

  let found = 0;
  let pending = 0;

  for (const [key, { name, sources }] of byKey) {
    let skill = byExistingKey.get(key);

    if (skill?.status === "dismissed") {
      continue;
    }

    if (!skill) {
      await run(
        db,
        `INSERT INTO skills (user_id, name, level, category, source, status, recency, sort_order)
         VALUES (?, ?, 'intermediate', 'general', 'suggested', 'pending', 'current', 0)`,
        [userId, name],
      );
      const created = await queryOne<{ id: string; name: string; status: string; source: string }>(
        db,
        "SELECT id, name, status, source FROM skills WHERE user_id = ? AND lower(name) = ?",
        [userId, key],
      );
      if (!created) continue;
      skill = created;
      byExistingKey.set(key, created);
      found += 1;
    }

    const unique = new Map<string, TagSource>();
    for (const s of sources) {
      unique.set(`${s.source_type}:${s.source_id}`, s);
    }

    const currentEvidence = await queryAll<{ id: string; source_type: string; source_id: string }>(
      db,
      "SELECT id, source_type, source_id FROM skill_evidence WHERE skill_id = ?",
      [skill.id],
    );
    const currentKeys = new Set(currentEvidence.map((e) => `${e.source_type}:${e.source_id}`));

    for (const s of unique.values()) {
      const ek = `${s.source_type}:${s.source_id}`;
      if (currentKeys.has(ek)) continue;
      await run(
        db,
        "INSERT INTO skill_evidence (skill_id, source_type, source_id) VALUES (?, ?, ?)",
        [skill.id, s.source_type, s.source_id],
      );
    }

    for (const e of currentEvidence) {
      const ek = `${e.source_type}:${e.source_id}`;
      if (!unique.has(ek)) {
        await run(db, "DELETE FROM skill_evidence WHERE id = ?", [e.id]);
      }
    }

    if (skill.status === "pending") pending += 1;
  }

  const pendingCount = await queryOne<{ c: number | string }>(
    db,
    "SELECT COUNT(*) as c FROM skills WHERE user_id = ? AND status = 'pending'",
    [userId],
  );
  pending = Number(pendingCount?.c ?? pending);

  return { found, pending };
}

export async function evidenceLabelsForSkills(
  db: FoliyoDb,
  skillIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!skillIds.length) return map;

  const placeholders = skillIds.map(() => "?").join(",");
  const rows = await queryAll<{
    skill_id: string;
    source_type: string;
    source_id: string;
    company: string | null;
    title: string | null;
    institution: string | null;
    cert_name: string | null;
  }>(
    db,
    `SELECT se.skill_id, se.source_type, se.source_id,
            e.company, p.title, edu.institution, c.name as cert_name
     FROM skill_evidence se
     LEFT JOIN experience e ON se.source_type = 'experience' AND e.id = se.source_id
     LEFT JOIN projects p ON se.source_type = 'project' AND p.id = se.source_id
     LEFT JOIN education edu ON se.source_type = 'education' AND edu.id = se.source_id
     LEFT JOIN certifications c ON se.source_type = 'certification' AND c.id = se.source_id
     WHERE se.skill_id IN (${placeholders})`,
    skillIds,
  );

  for (const row of rows) {
    let label = "Library";
    if (row.source_type === "experience") label = row.company ?? "Experience";
    else if (row.source_type === "project") label = row.title ?? "Project";
    else if (row.source_type === "education") label = row.institution ?? "Education";
    else if (row.source_type === "certification") label = row.cert_name ?? "Certification";
    const list = map.get(row.skill_id) ?? [];
    if (!list.includes(label)) list.push(label);
    map.set(row.skill_id, list);
  }
  return map;
}

function parseYearMonth(raw: string | null | undefined): Date | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  // YYYY-MM or YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = m[3] ? Number(m[3]) : 1;
  const dt = new Date(Date.UTC(y, mo, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const CURRENT_WINDOW_MS = 18 * 30 * 24 * 60 * 60 * 1000; // ~18 months

type DateSpan = { start: string | null; end: string | null; ongoingIfNoEnd: boolean };

/** Soft-suggest level + recency from linked evidence dates (pending confirm only). */
export async function softHintsForSkill(db: FoliyoDb, skillId: string): Promise<SoftSkillHints> {
  const links = await queryAll<{ source_type: string; source_id: string }>(
    db,
    "SELECT source_type, source_id FROM skill_evidence WHERE skill_id = ?",
    [skillId],
  );

  const spans: DateSpan[] = [];
  for (const link of links) {
    if (link.source_type === "experience") {
      const row = await queryOne<{ start_date: string; end_date: string | null }>(
        db,
        "SELECT start_date, end_date FROM experience WHERE id = ?",
        [link.source_id],
      );
      if (row) spans.push({ start: row.start_date, end: row.end_date, ongoingIfNoEnd: true });
    } else if (link.source_type === "education") {
      const row = await queryOne<{ start_date: string; end_date: string | null }>(
        db,
        "SELECT start_date, end_date FROM education WHERE id = ?",
        [link.source_id],
      );
      if (row) spans.push({ start: row.start_date, end: row.end_date, ongoingIfNoEnd: true });
    } else if (link.source_type === "project") {
      const row = await queryOne<{ created_at: string | null }>(
        db,
        "SELECT created_at FROM projects WHERE id = ?",
        [link.source_id],
      );
      spans.push({
        start: row?.created_at ? String(row.created_at).slice(0, 10) : null,
        end: null,
        ongoingIfNoEnd: false,
      });
    } else if (link.source_type === "certification") {
      const row = await queryOne<{ issued_at: string | null; expires_at: string | null }>(
        db,
        "SELECT issued_at, expires_at FROM certifications WHERE id = ?",
        [link.source_id],
      );
      if (row) {
        spans.push({ start: row.issued_at, end: row.expires_at, ongoingIfNoEnd: false });
      }
    }
  }

  const now = Date.now();
  let earliest: number | null = null;
  let latestEnd: number | null = null;
  let hasOngoing = false;
  let hasRecent = false;

  for (const span of spans) {
    const start = parseYearMonth(span.start);
    const end = parseYearMonth(span.end);

    if (span.ongoingIfNoEnd && !end) hasOngoing = true;

    if (start) {
      const t = start.getTime();
      if (earliest === null || t < earliest) earliest = t;
    }
    if (end) {
      const t = end.getTime();
      if (latestEnd === null || t > latestEnd) latestEnd = t;
      if (now - t <= CURRENT_WINDOW_MS) hasRecent = true;
    } else if (start) {
      if (latestEnd === null || now > latestEnd) latestEnd = now;
      if (now - start.getTime() <= CURRENT_WINDOW_MS) hasRecent = true;
      if (!span.ongoingIfNoEnd) hasRecent = true; // project / open-ended point
    }
  }

  let years: number | null = null;
  if (earliest !== null) {
    const endMs = latestEnd ?? now;
    years = Math.max(0, (endMs - earliest) / (365.25 * 24 * 60 * 60 * 1000));
  }

  let level: SoftSkillHints["level"] = "intermediate";
  if (years !== null) {
    if (years < 1) level = "beginner";
    else if (years < 3) level = "intermediate";
    else if (years < 5) level = "advanced";
    else level = "expert";
  }

  const recency: SoftSkillHints["recency"] = hasOngoing || hasRecent ? "current" : "past";

  return { level, recency, years: years === null ? null : Math.round(years * 10) / 10 };
}
