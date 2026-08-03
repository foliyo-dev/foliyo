import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { Config } from "./config.js";

export type FoliyoDb = DatabaseSync;

export function openDatabase(config: Config): FoliyoDb {
  if (config.dbDriver !== "sqlite") {
    throw new Error("Only sqlite is supported in this scaffold. Set FOLIYO_DB_DRIVER=sqlite.");
  }
  mkdirSync(dirname(config.dbPath), { recursive: true });
  mkdirSync(config.dataDir, { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export function queryAll<T extends Record<string, unknown>>(
  db: FoliyoDb,
  sql: string,
  params: SQLInputValue[] = [],
): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function queryOne<T extends Record<string, unknown>>(
  db: FoliyoDb,
  sql: string,
  params: SQLInputValue[] = [],
): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(db: FoliyoDb, sql: string, params: SQLInputValue[] = []): void {
  db.prepare(sql).run(...params);
}
