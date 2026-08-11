import { hashPassword } from "./auth/password.js";
import type { Config } from "./config.js";
import { queryOne, run, type FoliyoDb } from "./db.js";

export async function seedAdmin(db: FoliyoDb, config: Config): Promise<void> {
  if (!config.adminEmail || !config.adminPassword) return;

  const row = await queryOne<{ count: number | string }>(db, "SELECT COUNT(*) as count FROM users");
  if (Number(row?.count ?? 0) > 0) return;

  const hash = hashPassword(config.adminPassword);
  await run(db, "INSERT INTO users (email, password, email_verified, onboarding_complete) VALUES (?, ?, 1, 1)", [
    config.adminEmail,
    hash,
  ]);

  const user = await queryOne<{ id: string }>(db, "SELECT id FROM users WHERE email = ?", [
    config.adminEmail,
  ]);
  if (!user) return;

  await run(db, "INSERT INTO profile (user_id, name) VALUES (?, ?)", [user.id, "Admin"]);
  await run(db, "INSERT INTO settings (user_id) VALUES (?)", [user.id]);
}
