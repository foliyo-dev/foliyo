import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type pg from "pg";
import type { Config } from "./config.js";
import { sqliteMigrationForSqlite, sqliteMigrationToPostgres, toPgPlaceholders } from "./sql-dialect.js";

export type SqlValue = null | string | number | bigint | boolean | Uint8Array;

export type FoliyoDb =
  | { readonly driver: "sqlite"; readonly _sqlite: DatabaseSync }
  | { readonly driver: "postgres"; readonly _pg: pg.Pool };

const pgTx = new AsyncLocalStorage<pg.PoolClient>();

export async function openDatabase(config: Config): Promise<FoliyoDb> {
  mkdirSync(config.dataDir, { recursive: true });

  if (config.dbDriver === "postgres") {
    if (!config.dbUrl) {
      throw new Error("FOLIYO_DB_URL is required when FOLIYO_DB_DRIVER=postgres");
    }
    const { default: pgDriver, types } = await import("pg");
    // Keep timestamps as strings (SQLite-compatible) instead of Date objects.
    types.setTypeParser(types.builtins.TIMESTAMP, (v) => v);
    types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => v);
    types.setTypeParser(types.builtins.DATE, (v) => v);
    // COUNT(*) etc. come back as string by default; coerce to number for app code.
    types.setTypeParser(types.builtins.INT8, (v) => Number(v));

    const pool = new pgDriver.Pool({ connectionString: config.dbUrl });
    await pool.query("SELECT 1");
    // gen_random_bytes used by migrated DDL defaults
    await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    return { driver: "postgres", _pg: pool };
  }

  if (config.dbDriver !== "sqlite") {
    throw new Error(
      `Unsupported FOLIYO_DB_DRIVER=${String(config.dbDriver)}. Use sqlite or postgres.`,
    );
  }

  const { DatabaseSync } = await import("node:sqlite");
  mkdirSync(dirname(config.dbPath), { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  return { driver: "sqlite", _sqlite: db };
}

export async function closeDatabase(db: FoliyoDb): Promise<void> {
  if (db.driver === "sqlite") {
    db._sqlite.close();
    return;
  }
  await db._pg.end();
}

/** Run raw SQL (migrations / multi-statement). Rewrites SQLite DDL for Postgres. */
export async function execSql(db: FoliyoDb, sql: string): Promise<void> {
  if (db.driver === "sqlite") {
    db._sqlite.exec(sqliteMigrationForSqlite(sql));
    return;
  }
  const rewritten = sqliteMigrationToPostgres(sql).trim();
  if (!rewritten) return;
  const client = pgTx.getStore() ?? db._pg;
  await client.query(rewritten);
}

export async function queryAll<T extends Record<string, unknown>>(
  db: FoliyoDb,
  sql: string,
  params: SqlValue[] = [],
): Promise<T[]> {
  if (db.driver === "sqlite") {
    return db._sqlite.prepare(sql).all(...(params as SQLInputValue[])) as T[];
  }
  const text = toPgPlaceholders(sql);
  const client = pgTx.getStore() ?? db._pg;
  const res = await client.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T extends Record<string, unknown>>(
  db: FoliyoDb,
  sql: string,
  params: SqlValue[] = [],
): Promise<T | undefined> {
  if (db.driver === "sqlite") {
    return db._sqlite.prepare(sql).get(...(params as SQLInputValue[])) as T | undefined;
  }
  const text = toPgPlaceholders(sql);
  const client = pgTx.getStore() ?? db._pg;
  const res = await client.query(text, params);
  return res.rows[0] as T | undefined;
}

export async function run(db: FoliyoDb, sql: string, params: SqlValue[] = []): Promise<void> {
  if (db.driver === "sqlite") {
    db._sqlite.prepare(sql).run(...(params as SQLInputValue[]));
    return;
  }
  const text = toPgPlaceholders(sql);
  const client = pgTx.getStore() ?? db._pg;
  await client.query(text, params);
}

export async function withTransaction<T>(db: FoliyoDb, fn: () => Promise<T>): Promise<T> {
  if (db.driver === "sqlite") {
    db._sqlite.exec("BEGIN");
    try {
      const result = await fn();
      db._sqlite.exec("COMMIT");
      return result;
    } catch (err) {
      db._sqlite.exec("ROLLBACK");
      throw err;
    }
  }

  const client = await db._pg.connect();
  try {
    await client.query("BEGIN");
    const result = await pgTx.run(client, fn);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback errors */
    }
    throw err;
  } finally {
    client.release();
  }
}
