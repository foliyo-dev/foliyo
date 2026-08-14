/**
 * Turn a resume/import URL into an href-safe absolute URL.
 * Bare hosts like `github.com/foo` become `https://github.com/foo`.
 * Usernames, mailto:, and empty values are left unchanged.
 */
export function absoluteHttpUrl(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().replace(/^<|>$/g, "");
  if (!v) return "";
  if (/^(mailto|tel):/i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("//")) return `https:${v}`;
  if (looksLikeBareHost(v)) return `https://${v}`;
  return v;
}

/** True when the value is a host/path, not a username handle. */
export function looksLikeBareHost(value: string): boolean {
  const v = value.trim();
  if (!v || /[\s]/.test(v)) return false;
  if (/^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)+)/i.test(v)) return true;
  return false;
}
