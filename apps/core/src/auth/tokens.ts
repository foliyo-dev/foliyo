import { nanoid } from "nanoid";
import { queryOne, run, type FoliyoDb } from "../db.js";
import { hashSecret } from "./secret.js";
import { sqlUtc, sqlUtcPlusDays } from "./datetime.js";

const TOKEN_DAYS = 30;

export async function createToken(db: FoliyoDb, userId: string): Promise<string> {
  const token = nanoid(32);
  await run(db, "INSERT INTO tokens (id, user_id, expires_at) VALUES (?, ?, ?)", [
    hashSecret(token),
    userId,
    sqlUtcPlusDays(TOKEN_DAYS),
  ]);
  return token;
}

export async function getTokenUserId(db: FoliyoDb, token: string): Promise<string | null> {
  const hashed = hashSecret(token);
  const now = sqlUtc();
  const row = await queryOne<{ user_id: string }>(
    db,
    "SELECT user_id FROM tokens WHERE id = ? AND expires_at > ?",
    [hashed, now],
  );
  if (row) return row.user_id;

  // Legacy plaintext session ids (pre-hashing). Upgrade in place.
  const legacy = await queryOne<{ user_id: string; expires_at: string }>(
    db,
    "SELECT user_id, expires_at FROM tokens WHERE id = ? AND expires_at > ?",
    [token, now],
  );
  if (!legacy) return null;
  await run(db, "DELETE FROM tokens WHERE id = ?", [token]);
  await run(db, "INSERT INTO tokens (id, user_id, expires_at) VALUES (?, ?, ?)", [
    hashed,
    legacy.user_id,
    legacy.expires_at,
  ]);
  return legacy.user_id;
}

export async function deleteToken(db: FoliyoDb, token: string): Promise<void> {
  const hashed = hashSecret(token);
  await run(db, "DELETE FROM tokens WHERE id = ? OR id = ?", [hashed, token]);
}

/** Deletes all tokens for a user, optionally keeping one (e.g. the caller's current session). */
export async function deleteTokensForUser(
  db: FoliyoDb,
  userId: string,
  exceptToken?: string,
): Promise<void> {
  if (exceptToken) {
    const hashed = hashSecret(exceptToken);
    await run(db, "DELETE FROM tokens WHERE user_id = ? AND id != ? AND id != ?", [
      userId,
      hashed,
      exceptToken,
    ]);
  } else {
    await run(db, "DELETE FROM tokens WHERE user_id = ?", [userId]);
  }
}

export function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
