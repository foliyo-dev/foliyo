/**
 * Turn a resume/import URL into an href-safe absolute URL.
 * Bare hosts like `github.com/foo` become `https://github.com/foo`.
 * Dangerous schemes (`javascript:`, `data:`, …) are dropped.
 */
const BLOCKED_SCHEME = /^(javascript|data|vbscript|file|about):/i;
const UPLOAD_PATH = /^\/uploads\/[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/i;

export function absoluteHttpUrl(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().replace(/^<|>$/g, "");
  if (!v) return "";
  if (BLOCKED_SCHEME.test(v)) return "";
  if (/^(mailto|tel):/i.test(v)) return v;
  if (v.startsWith("//")) return absoluteHttpUrl(`https:${v}`);
  if (v.startsWith("/")) {
    return UPLOAD_PATH.test(v) ? v : "";
  }
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.href;
    } catch {
      return "";
    }
  }
  if (looksLikeBareHost(v)) return `https://${v}`;
  return "";
}

/** True when the value is a host/path, not a username handle. */
export function looksLikeBareHost(value: string): boolean {
  const v = value.trim();
  if (!v || /[\s]/.test(v)) return false;
  if (/^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)+)/i.test(v)) return true;
  return false;
}
