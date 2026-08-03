import { hashPassword } from "./auth/password.js";
import type { Config } from "./config.js";
import { queryOne, run, type FoliyoDb } from "./db.js";

export function seedAdmin(db: FoliyoDb, config: Config): void {
  if (!config.adminEmail || !config.adminPassword) return;

  const row = queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM users");
  if ((row?.count ?? 0) > 0) return;

  const hash = hashPassword(config.adminPassword);
  run(db, "INSERT INTO users (email, password, email_verified, onboarding_complete) VALUES (?, ?, 1, 1)", [
    config.adminEmail,
    hash,
  ]);

  const user = queryOne<{ id: string }>(db, "SELECT id FROM users WHERE email = ?", [
    config.adminEmail,
  ]);
  if (!user) return;

  run(db, "INSERT INTO profile (user_id, name) VALUES (?, ?)", [user.id, "Admin"]);
  run(db, "INSERT INTO settings (user_id) VALUES (?)", [user.id]);
}
