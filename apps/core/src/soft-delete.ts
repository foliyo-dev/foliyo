import { queryAll, queryOne, run, type FoliyoDb } from "./db.js";

/** Soft-deleted library rows older than this are purged when trash is listed. */
export const TRASH_RETENTION_DAYS = 30;

const ACTIVE = "deleted_at IS NULL";

export async function purgeExpiredTrash(
  db: FoliyoDb,
  table: string,
  userId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  await run(
    db,
    `DELETE FROM ${table}
     WHERE user_id = ?
       AND deleted_at IS NOT NULL
       AND deleted_at < ?`,
    [userId, cutoff],
  );
}

export async function listTrash(
  db: FoliyoDb,
  table: string,
  userId: string,
  orderBy = "deleted_at DESC",
): Promise<Record<string, unknown>[]> {
  await purgeExpiredTrash(db, table, userId);
  return queryAll(
    db,
    `SELECT * FROM ${table}
     WHERE user_id = ? AND deleted_at IS NOT NULL
     ORDER BY ${orderBy}`,
    [userId],
  );
}

export async function softDeleteRow(
  db: FoliyoDb,
  table: string,
  id: string,
  userId: string,
): Promise<boolean> {
  const existing = await queryOne(
    db,
    `SELECT id FROM ${table} WHERE id = ? AND user_id = ? AND ${ACTIVE}`,
    [id, userId],
  );
  if (!existing) return false;
  await run(
    db,
    `UPDATE ${table}
     SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ? AND ${ACTIVE}`,
    [id, userId],
  );
  return true;
}

export async function restoreRow(
  db: FoliyoDb,
  table: string,
  id: string,
  userId: string,
): Promise<"ok" | "not_found" | "conflict"> {
  const row = await queryOne(
    db,
    `SELECT id FROM ${table} WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
    [id, userId],
  );
  if (!row) return "not_found";

  if (table === "skills") {
    const skill = await queryOne<{ name: string }>(
      db,
      `SELECT name FROM skills WHERE id = ? AND user_id = ?`,
      [id, userId],
    );
    if (skill?.name) {
      const clash = await queryOne(
        db,
        `SELECT id FROM skills
         WHERE user_id = ? AND lower(name) = lower(?) AND ${ACTIVE} AND id != ?`,
        [userId, skill.name, id],
      );
      if (clash) return "conflict";
    }
  }

  await run(
    db,
    `UPDATE ${table}
     SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
    [id, userId],
  );
  return "ok";
}

export async function purgeRow(
  db: FoliyoDb,
  table: string,
  id: string,
  userId: string,
): Promise<boolean> {
  const existing = await queryOne(
    db,
    `SELECT id FROM ${table} WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
    [id, userId],
  );
  if (!existing) return false;
  await run(db, `DELETE FROM ${table} WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`, [
    id,
    userId,
  ]);
  return true;
}

export async function listActive(
  db: FoliyoDb,
  table: string,
  userId: string,
  orderBy = "sort_order",
): Promise<Record<string, unknown>[]> {
  return queryAll(
    db,
    `SELECT * FROM ${table} WHERE user_id = ? AND ${ACTIVE} ORDER BY ${orderBy}`,
    [userId],
  );
}
