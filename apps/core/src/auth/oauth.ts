import { createHmac, randomBytes, createHash } from "node:crypto";
import { allocateTempHandle, deletePendingByEmail } from "./pending-signup.js";
import { normalizeEmail } from "./datetime.js";
import { queryOne, run, type FoliyoDb } from "../db.js";

export type OAuthProvider = "google" | "github";

export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ["google", "github"] as const;

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
};

export type AuthUserRow = {
  id: string;
  email: string;
  plan: string;
  handle: string | null;
  handle_changed_at: string | null;
  onboarding_complete: number;
  email_verified: number;
  mode: string;
};

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type OAuthStatePayload = {
  nonce: string;
  verifier: string;
  provider: OAuthProvider;
  consent: boolean;
  exp: number;
};

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function signPayload(secret: string, payloadB64: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier, "utf8").digest());
  return { verifier, challenge };
}

/** Signed OAuth `state` carrying PKCE verifier (no cookies — works across Vite proxy). */
export function sealOAuthState(
  secret: string,
  data: Omit<OAuthStatePayload, "exp" | "nonce"> & { exp?: number; nonce?: string },
): string {
  const payload: OAuthStatePayload = {
    nonce: data.nonce ?? b64url(randomBytes(16)),
    verifier: data.verifier,
    provider: data.provider,
    consent: data.consent,
    exp: data.exp ?? Date.now() + OAUTH_STATE_TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = signPayload(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export function openOAuthState(secret: string, raw: string | undefined): OAuthStatePayload | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (signPayload(secret, payloadB64) !== sig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!parsed?.verifier || !isOAuthProvider(parsed.provider)) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function loadAuthUser(db: FoliyoDb, userId: string): Promise<AuthUserRow | null> {
  return (
    (await queryOne<AuthUserRow>(
      db,
      `SELECT id, email, plan, handle, handle_changed_at, onboarding_complete, email_verified, mode
       FROM users WHERE id = ?`,
      [userId],
    )) ?? null
  );
}

async function recordConsent(db: FoliyoDb, userId: string, ip: string, ua: string): Promise<void> {
  await run(
    db,
    `INSERT INTO consents (user_id, type, granted, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`,
    [userId, "privacy_policy", 1, ip, ua],
  );
}

/**
 * Resolve an OAuth profile to a Foliyo user: existing identity, email auto-link, or create.
 * Requires verified email from the provider. New users need `consent: true`.
 */
export async function findOrCreateOAuthUser(
  db: FoliyoDb,
  profile: OAuthProfile,
  opts: { consent: boolean; consentIp: string; consentUa: string },
): Promise<
  | { ok: true; user: AuthUserRow; created: boolean }
  | { ok: false; error: "email_unverified" | "consent_required" | "pending_deletion" | "create_failed" }
> {
  if (!profile.emailVerified || !profile.email) {
    return { ok: false, error: "email_unverified" };
  }
  const email = normalizeEmail(profile.email);

  const byIdentity = await queryOne<{ user_id: string }>(
    db,
    `SELECT user_id FROM oauth_identities WHERE provider = ? AND provider_user_id = ?`,
    [profile.provider, profile.providerUserId],
  );
  if (byIdentity) {
    const user = await loadAuthUser(db, byIdentity.user_id);
    if (!user) return { ok: false, error: "create_failed" };
    if (user.mode === "pending_delete") return { ok: false, error: "pending_deletion" };
    await run(
      db,
      `UPDATE oauth_identities SET email = ? WHERE provider = ? AND provider_user_id = ?`,
      [email, profile.provider, profile.providerUserId],
    );
    return { ok: true, user, created: false };
  }

  const existing = await queryOne<{ id: string; email_verified: number; mode: string }>(
    db,
    `SELECT id, email_verified, mode FROM users WHERE lower(email) = ?`,
    [email],
  );

  if (existing) {
    if (existing.mode === "pending_delete") return { ok: false, error: "pending_deletion" };
    if (!existing.email_verified) {
      await run(
        db,
        `UPDATE users SET email_verified = 1, email_verify_token = NULL, email_verify_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [existing.id],
      );
    }
    await run(
      db,
      `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email) VALUES (?, ?, ?, ?)`,
      [existing.id, profile.provider, profile.providerUserId, email],
    );
    await deletePendingByEmail(db, email);
    const user = await loadAuthUser(db, existing.id);
    if (!user) return { ok: false, error: "create_failed" };
    return { ok: true, user, created: false };
  }

  if (!opts.consent) {
    return { ok: false, error: "consent_required" };
  }

  let handle: string;
  try {
    handle = await allocateTempHandle(db);
  } catch {
    return { ok: false, error: "create_failed" };
  }

  await run(
    db,
    `INSERT INTO users (email, password, handle, email_verified) VALUES (?, NULL, ?, 1)`,
    [email, handle],
  );
  const created = await queryOne<{ id: string }>(
    db,
    `SELECT id FROM users WHERE lower(email) = ?`,
    [email],
  );
  if (!created) return { ok: false, error: "create_failed" };

  await recordConsent(db, created.id, opts.consentIp, opts.consentUa);
  const displayName = (profile.name ?? "").trim().slice(0, 120);
  await run(db, `INSERT INTO profile (user_id, name) VALUES (?, ?)`, [created.id, displayName]);
  await run(db, `INSERT INTO settings (user_id) VALUES (?)`, [created.id]);
  await run(
    db,
    `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email) VALUES (?, ?, ?, ?)`,
    [created.id, profile.provider, profile.providerUserId, email],
  );
  await deletePendingByEmail(db, email);

  const user = await loadAuthUser(db, created.id);
  if (!user) return { ok: false, error: "create_failed" };
  return { ok: true, user, created: true };
}
