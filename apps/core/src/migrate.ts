import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveCoreMigrationsDir } from "./assets.js";
import { execSql, queryAll, run, type FoliyoDb } from "./db.js";
import { sqliteMigrationForSqlite, sqliteMigrationToPostgres } from "./sql-dialect.js";

const migrationsDir = resolveCoreMigrationsDir(import.meta.url);

/**
 * Apply dialect sections first (markers are `--` comments), then strip remaining
 * line comments and split on `;`. Filtering after comment-strip would leak
 * postgres-only DDL into SQLite (and vice versa).
 */
function splitStatements(sql: string, driver: FoliyoDb["driver"]): string[] {
  const dialected =
    driver === "postgres" ? sqliteMigrationToPostgres(sql) : sqliteMigrationForSqlite(sql);

  const withoutLineComments = dialected
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");

  return withoutLineComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isIgnorableMigrationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /duplicate column name/i.test(msg) ||
    /already exists/i.test(msg) ||
    /no such column/i.test(msg) || // RENAME source already gone
    /cannot rename.*no such column/i.test(msg) ||
    /column .* of relation .* already exists/i.test(msg) || // Postgres ADD COLUMN
    /column ".*" does not exist/i.test(msg) // Postgres RENAME missing source
  );
}

export async function runMigrations(db: FoliyoDb): Promise<void> {
  await execSql(
    db,
    `
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  );

  const applied = new Set(
    (await queryAll<{ name: string }>(db, "SELECT name FROM _migrations")).map((r) => r.name),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const statements = splitStatements(sql, db.driver);
    for (const stmt of statements) {
      try {
        await execSql(db, stmt + ";");
      } catch (err) {
        if (isIgnorableMigrationError(err)) continue;
        throw err;
      }
    }
    await run(db, "INSERT INTO _migrations (name) VALUES (?)", [file]);
  }
}
