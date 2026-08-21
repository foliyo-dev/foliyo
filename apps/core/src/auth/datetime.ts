/** SQLite CURRENT_TIMESTAMP is `YYYY-MM-DD HH:MM:SS` (UTC). ISO strings with `T`/`Z` never expire correctly. */
export function sqlUtc(d: Date = new Date()): string {
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

export function sqlUtcPlusMs(ms: number, from: Date = new Date()): string {
  return sqlUtc(new Date(from.getTime() + ms));
}

export function sqlUtcPlusHours(hours: number, from: Date = new Date()): string {
  return sqlUtcPlusMs(hours * 3_600_000, from);
}

export function sqlUtcPlusDays(days: number, from: Date = new Date()): string {
  return sqlUtcPlusMs(days * 86_400_000, from);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
