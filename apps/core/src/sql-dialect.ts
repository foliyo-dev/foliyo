/** Convert app SQL `?` placeholders to Postgres `$1..$n`. */
export function toPgPlaceholders(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

/**
 * Rewrite SQLite migration DDL into Postgres-compatible SQL.
 * Application SQL stays SQLite-shaped (`?`, INTEGER flags); only migrations are rewritten.
 *
 * Dialect sections (optional):
 *   -- foliyo:sqlite-only ... -- foliyo:end
 *   -- foliyo:postgres-only ... -- foliyo:end
 */
export function sqliteMigrationToPostgres(sql: string): string {
  let out = sql;

  // Drop sqlite-only blocks; unwrap postgres-only blocks
  out = out.replace(/--\s*foliyo:sqlite-only[\s\S]*?--\s*foliyo:end/gi, "");
  out = out.replace(/--\s*foliyo:postgres-only\s*\n([\s\S]*?)--\s*foliyo:end/gi, "$1");

  // Strip SQLite-only pragmas
  out = out.replace(/^\s*PRAGMA\b[^;]*;/gim, "");

  // INSERT OR IGNORE → ON CONFLICT DO NOTHING
  out = out.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT INTO");
  out = out.replace(
    /(INSERT\s+INTO\s+\w+\s*\([^)]+\)\s*SELECT\b[^;]+);/gi,
    "$1 ON CONFLICT DO NOTHING;",
  );

  // randomblob(N) hex defaults → pgcrypto
  out = out.replace(
    /DEFAULT\s*\(\s*lower\s*\(\s*hex\s*\(\s*randomblob\s*\(\s*(\d+)\s*\)\s*\)\s*\)\s*\)/gi,
    (_m, bytes: string) => `DEFAULT encode(gen_random_bytes(${bytes}), 'hex')`,
  );

  // SQLite DATETIME affinity → timestamptz
  out = out.replace(/\bDATETIME\b/gi, "TIMESTAMPTZ");

  return out;
}

/** Strip postgres-only blocks for SQLite execution. */
export function sqliteMigrationForSqlite(sql: string): string {
  let out = sql;
  out = out.replace(/--\s*foliyo:postgres-only[\s\S]*?--\s*foliyo:end/gi, "");
  out = out.replace(/--\s*foliyo:sqlite-only\s*\n([\s\S]*?)--\s*foliyo:end/gi, "$1");
  return out;
}
