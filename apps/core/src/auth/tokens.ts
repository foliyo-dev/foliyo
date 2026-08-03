import { nanoid } from "nanoid";
import { queryOne, run, type FoliyoDb } from "../db.js";

const TOKEN_DAYS = 30;

export function createToken(db: FoliyoDb, userId: string): string {
  const token = nanoid(32);
  const expires = new Date();
  expires.setDate(expires.getDate() + TOKEN_DAYS);
  run(db, "INSERT INTO tokens (id, user_id, expires_at) VALUES (?, ?, ?)", [
    token,
    userId,
    expires.toISOString(),
  ]);
  return token;
}

export function getTokenUserId(db: FoliyoDb, token: string): string | null {
  const row = queryOne<{ user_id: string }>(
    db,
    "SELECT user_id FROM tokens WHERE id = ? AND expires_at > CURRENT_TIMESTAMP",
    [token],
  );
  return row?.user_id ?? null;
}

export function deleteToken(db: FoliyoDb, token: string): void {
  run(db, "DELETE FROM tokens WHERE id = ?", [token]);
}

export function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
