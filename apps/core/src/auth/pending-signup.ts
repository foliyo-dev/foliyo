import { nanoid, customAlphabet } from "nanoid";
import { hashSecret } from "./secret.js";
import { normalizeEmail, sqlUtc, sqlUtcPlusHours } from "./datetime.js";
import { queryOne, run, type FoliyoDb } from "../db.js";

export const PENDING_SIGNUP_HOURS = 1;

const handleId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

export type PendingSignup = {
  email: string;
  token_hash: string;
  consent_ip: string;
  consent_ua: string;
  expires_at: string;
};

export async function sweepExpiredPending(db: FoliyoDb): Promise<void> {
  await run(db, "DELETE FROM pending_signups WHERE expires_at <= ?", [sqlUtc()]);
}

export async function upsertPendingSignup(
  db: FoliyoDb,
  opts: { email: string; consentIp: string; consentUa: string },
): Promise<string> {
  const email = normalizeEmail(opts.email);
  await sweepExpiredPending(db);
  const token = nanoid(32);
  const tokenHash = hashSecret(token);
  const expires = sqlUtcPlusHours(PENDING_SIGNUP_HOURS);
  await run(db, "DELETE FROM pending_signups WHERE lower(email) = ?", [email]);
  await run(
    db,
    `INSERT INTO pending_signups (email, token_hash, consent_ip, consent_ua, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [email, tokenHash, opts.consentIp, opts.consentUa, expires],
  );
  return token;
}

export async function findPendingByToken(db: FoliyoDb, token: string): Promise<PendingSignup | null> {
  await sweepExpiredPending(db);
  return (
    (await queryOne<PendingSignup>(
      db,
      `SELECT email, token_hash, consent_ip, consent_ua, expires_at
       FROM pending_signups WHERE token_hash = ? AND expires_at > ?`,
      [hashSecret(token), sqlUtc()],
    )) ?? null
  );
}

export async function findPendingByEmail(db: FoliyoDb, email: string): Promise<PendingSignup | null> {
  await sweepExpiredPending(db);
  return (
    (await queryOne<PendingSignup>(
      db,
      `SELECT email, token_hash, consent_ip, consent_ua, expires_at
       FROM pending_signups WHERE lower(email) = ? AND expires_at > ?`,
      [normalizeEmail(email), sqlUtc()],
    )) ?? null
  );
}

export async function deletePendingByEmail(db: FoliyoDb, email: string): Promise<void> {
  await run(db, "DELETE FROM pending_signups WHERE lower(email) = ?", [normalizeEmail(email)]);
}

export async function allocateTempHandle(db: FoliyoDb): Promise<string> {
  for (let n = 0; n < 30; n++) {
    const handle = `f-${handleId()}`;
    if (!(await queryOne(db, "SELECT id FROM users WHERE handle = ?", [handle]))) {
      return handle;
    }
  }
  throw new Error("could not allocate handle");
}
