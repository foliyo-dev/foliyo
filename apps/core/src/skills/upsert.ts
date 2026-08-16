import { queryOne, run, type FoliyoDb } from "../db.js";

export type SkillUpsertInput = {
  name: string;
  level: string;
  category: string;
  recency: string;
  sort_order: number;
};

/**
 * Insert-or-confirm a single skill by name (case-insensitive dedupe against the
 * `skills_user_name_lower_active` constraint). A name collision usually means
 * this skill was already auto-suggested (status='pending') — confirm/update
 * that row instead of a raw INSERT crashing on the unique index.
 */
export async function upsertSkill(
  db: FoliyoDb,
  userId: string,
  d: SkillUpsertInput,
): Promise<{ merged: boolean }> {
  const existing = await queryOne<{ id: string }>(
    db,
    "SELECT id FROM skills WHERE user_id = ? AND lower(name) = lower(?) AND status != 'dismissed' AND deleted_at IS NULL",
    [userId, d.name],
  );
  if (existing) {
    await run(
      db,
      `UPDATE skills SET name=?, level=?, category=?, status='confirmed', recency=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND user_id=?`,
      [d.name, d.level, d.category, d.recency, d.sort_order, existing.id, userId],
    );
    return { merged: true };
  }
  await run(
    db,
    `INSERT INTO skills (user_id, name, level, category, source, status, recency, sort_order)
     VALUES (?, ?, ?, ?, 'manual', 'confirmed', ?, ?)`,
    [userId, d.name, d.level, d.category, d.recency, d.sort_order],
  );
  return { merged: false };
}
