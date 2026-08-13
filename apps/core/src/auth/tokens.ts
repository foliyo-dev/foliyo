import { nanoid } from "nanoid";
import { queryOne, run, type FoliyoDb } from "../db.js";

const TOKEN_DAYS = 30;

export async function createToken(db: FoliyoDb, userId: string): Promise<string> {
  const token = nanoid(32);
  const expires = new Date();
  expires.setDate(expires.getDate() + TOKEN_DAYS);
  await run(db, "INSERT INTO tokens (id, user_id, expires_at) VALUES (?, ?, ?)", [
    token,
    userId,
    expires.toISOString(),
  ]);
  return token;
}

export async function getTokenUserId(db: FoliyoDb, token: string): Promise<string | null> {
  const row = await queryOne<{ user_id: string }>(
    db,
    "SELECT user_id FROM tokens WHERE id = ? AND expires_at > CURRENT_TIMESTAMP",
    [token],
  );
  return row?.user_id ?? null;
}

export async function deleteToken(db: FoliyoDb, token: string): Promise<void> {
  await run(db, "DELETE FROM tokens WHERE id = ?", [token]);
}

export async function deleteTokensForUser(db: FoliyoDb, userId: string): Promise<void> {
  await run(db, "DELETE FROM tokens WHERE user_id = ?", [userId]);
}

export function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
