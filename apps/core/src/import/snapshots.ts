import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { Config } from "../config.js";
import { queryAll, queryOne, run, type FoliyoDb } from "../db.js";
import { loadLibraryPreview } from "../public/pages.js";
import { buildFioFromPortfolio, parseAndVerifyFio, type FioImportDraft } from "../spec/fio.js";
import { applyImportDraft, type ApplyDraftResult } from "./apply-draft.js";

export const IMPORT_SNAPSHOT_LIMIT = 5;

export type ImportSnapshotMeta = {
  id: string;
  user_id: string;
  label: string;
  filename: string;
  content_hash: string;
  byte_size: number;
  created_at: string;
};

function snapshotDir(config: Config, userId: string): string {
  return join(config.dataDir, "import-snapshots", userId);
}

function snapshotPath(config: Config, userId: string, filename: string): string {
  return join(snapshotDir(config, userId), filename);
}

async function enforceLimit(db: FoliyoDb, config: Config, userId: string): Promise<void> {
  const rows = await queryAll<ImportSnapshotMeta>(
    db,
    `SELECT * FROM import_snapshots WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    [userId],
  );
  const excess = rows.slice(IMPORT_SNAPSHOT_LIMIT);
  for (const row of excess) {
    await deleteSnapshot(db, config, userId, row.id);
  }
}

/**
 * Capture active library (+ profile) as a signed .fio before an import apply.
 * Keeps at most IMPORT_SNAPSHOT_LIMIT per user (oldest dropped).
 */
export async function captureLibrarySnapshot(
  db: FoliyoDb,
  config: Config,
  userId: string,
  label = "Before import",
): Promise<ImportSnapshotMeta | null> {
  const data = await loadLibraryPreview(db, userId);
  if (!data) return null;

  const fio = buildFioFromPortfolio(
    data,
    {
      name: "library-before-import",
      theme_slug: String(data.portfolio.theme_slug ?? "minimal"),
      share_token: "",
      is_public: 0,
    },
    { siteUrl: config.siteUrl, integritySecret: config.integritySecret },
  );

  const id = randomBytes(16).toString("hex");
  const filename = `${id}.fio`;
  const dir = snapshotDir(config, userId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(snapshotPath(config, userId, filename), fio.bytes);

  await run(
    db,
    `INSERT INTO import_snapshots (id, user_id, label, filename, content_hash, byte_size)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, label.slice(0, 120), filename, fio.manifest.content_hash, fio.bytes.byteLength],
  );

  await enforceLimit(db, config, userId);

  const row = await queryOne<ImportSnapshotMeta>(
    db,
    `SELECT * FROM import_snapshots WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
  return row ?? null;
}

export async function listSnapshots(
  db: FoliyoDb,
  userId: string,
): Promise<ImportSnapshotMeta[]> {
  return queryAll<ImportSnapshotMeta>(
    db,
    `SELECT * FROM import_snapshots WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    [userId],
  );
}

export async function getSnapshot(
  db: FoliyoDb,
  userId: string,
  id: string,
): Promise<ImportSnapshotMeta | null> {
  return (
    (await queryOne<ImportSnapshotMeta>(
      db,
      `SELECT * FROM import_snapshots WHERE id = ? AND user_id = ?`,
      [id, userId],
    )) ?? null
  );
}

export async function deleteSnapshot(
  db: FoliyoDb,
  config: Config,
  userId: string,
  id: string,
): Promise<boolean> {
  const row = await getSnapshot(db, userId, id);
  if (!row) return false;
  const path = snapshotPath(config, userId, row.filename);
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      /* ignore missing file */
    }
  }
  await run(db, `DELETE FROM import_snapshots WHERE id = ? AND user_id = ?`, [id, userId]);
  return true;
}

/** Hard-delete active library rows only (leaves Recently deleted trash alone). */
async function clearActiveLibrary(db: FoliyoDb, userId: string): Promise<void> {
  const tables = [
    "skills",
    "projects",
    "experience",
    "education",
    "certifications",
    "languages",
    "social_links",
  ] as const;
  for (const table of tables) {
    await run(db, `DELETE FROM ${table} WHERE user_id = ? AND deleted_at IS NULL`, [userId]);
  }
}

/**
 * Replace active library with the snapshot's contents.
 * Portfolios / resumes are kept; junction rows to deleted library items simply go empty in public views.
 */
export async function restoreSnapshot(
  db: FoliyoDb,
  config: Config,
  userId: string,
  id: string,
): Promise<{ ok: true; apply: ApplyDraftResult } | { ok: false; error: string; message: string }> {
  const row = await getSnapshot(db, userId, id);
  if (!row) return { ok: false, error: "not_found", message: "Snapshot not found." };

  const path = snapshotPath(config, userId, row.filename);
  if (!existsSync(path)) {
    return { ok: false, error: "missing_file", message: "Snapshot file is missing on disk." };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(path));
  } catch {
    return { ok: false, error: "read_failed", message: "Could not read snapshot file." };
  }

  const parsed = parseAndVerifyFio(bytes, config.integritySecret);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, message: parsed.message };
  }

  await clearActiveLibrary(db, userId);
  const apply = await applyImportDraft(db, userId, parsed.draft as FioImportDraft);
  return { ok: true, apply };
}
