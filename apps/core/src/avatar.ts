import { createHash } from "node:crypto";

/** Gravatar URL for an email (identicon when no Gravatar is set). */
export function gravatarUrl(email: string, size = 200): string {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

/**
 * Prefer an explicit avatar URL; otherwise Gravatar from public email.
 * Does not invent a URL when both are empty.
 */
export function resolveAvatarUrl(
  avatarUrl: string | null | undefined,
  email: string | null | undefined,
  size = 200,
): string {
  const explicit = String(avatarUrl ?? "").trim();
  if (explicit) return explicit;
  const mail = String(email ?? "").trim();
  if (!mail) return "";
  return gravatarUrl(mail, size);
}
