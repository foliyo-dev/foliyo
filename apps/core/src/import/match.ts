/**
 * Stable identity keys so resume import can skip rows already in the library.
 * Keep in sync with apps/dashboard/src/lib/utils/importMatch.ts
 */

export function normText(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** YYYY or YYYY-MM from a resume date; empty when missing. */
export function normDate(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  const m = t.match(/^(\d{4}(?:-\d{2})?)/);
  return m ? m[1]! : "";
}

/** Host + path, no scheme / www / trailing slash — so github.com/x matches https://github.com/x/. */
export function normUrl(s: string | null | undefined): string {
  const v = (s ?? "").trim().toLowerCase().replace(/\/+$/, "");
  if (!v) return "";
  return v.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

export function skillKey(name: string): string {
  return `skill:${normText(name)}`;
}

export function experienceKey(
  company: string,
  role: string,
  start: string | null | undefined,
): string {
  return `exp:${normText(company)}|${normText(role)}|${normDate(start)}`;
}

export function educationKey(
  institution: string,
  degree: string | null | undefined,
): string {
  return `edu:${normText(institution)}|${normText(degree)}`;
}

export function projectKey(
  title: string,
  url: string | null | undefined,
  repoUrl: string | null | undefined,
): string {
  const u = normUrl(url) || normUrl(repoUrl);
  if (u) return `proj:url:${u}`;
  return `proj:title:${normText(title)}`;
}

export function certificationKey(
  name: string,
  issuer: string | null | undefined,
): string {
  return `cert:${normText(name)}|${normText(issuer)}`;
}

export function languageKey(name: string): string {
  return `lang:${normText(name)}`;
}

/**
 * One link can be stored as a handle or a URL. Any of these identities matching
 * an existing row counts as the same link.
 */
export function linkIdentities(provider: string, value: string): string[] {
  const p = normText(provider);
  const raw = (value ?? "").trim().toLowerCase().replace(/\/+$/, "");
  if (!p || !raw) return [];
  const ids = new Set<string>([`${p}|${raw}`]);
  const hostPath = normUrl(raw);
  if (hostPath) ids.add(`${p}|${hostPath}`);
  const last = hostPath.split("/").filter(Boolean).pop();
  if (last) ids.add(`${p}|${last.replace(/^@/, "")}`);
  return [...ids];
}

export function linkMatchesExisting(
  existing: Set<string>,
  provider: string,
  value: string,
): boolean {
  return linkIdentities(provider, value).some((id) => existing.has(id));
}

export function rememberLink(
  existing: Set<string>,
  provider: string,
  value: string,
): void {
  for (const id of linkIdentities(provider, value)) existing.add(id);
}
