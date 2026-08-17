import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { queryAll, queryOne, run, type FoliyoDb } from "../db.js";
import type { JobAnalysis } from "./types.js";

export const JOB_ANALYSIS_LIMIT = 40;

export type JobAnalysisSummary = {
  id: string;
  jd_hash: string;
  title: string | null;
  company: string | null;
  location: string | null;
  parse: "heuristic" | "llm";
  enhanced: boolean;
  fit: JobAnalysis["verdict"]["fit"];
  coverage: JobAnalysis["coverage"];
  created_at: string;
  updated_at: string;
};

export type SavedJobAnalysis = JobAnalysisSummary & {
  jd_text: string;
  portfolio_id: string | null;
  resume_id: string | null;
  accepted: string[];
  analysis: JobAnalysis;
};

type JobAnalysisRow = {
  id: string;
  user_id: string;
  jd_hash: string;
  jd_text: string;
  title: string | null;
  company: string | null;
  location: string | null;
  parse: string;
  enhanced: number | boolean;
  fit: string;
  required_total: number;
  required_in_library: number;
  required_on_resume: number;
  portfolio_id: string | null;
  resume_id: string | null;
  analysis_json: string;
  accepted_json: string | null;
  created_at: string;
  updated_at: string;
};

const LIST_COLS = `id, jd_hash, title, company, location, parse, enhanced, fit,
  required_total, required_in_library, required_on_resume,
  created_at, updated_at`;

/** Whitespace-collapsed lowercase — must match dashboard / extension hashing. */
export function normalizeJdText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function hashJdText(text: string): string {
  return createHash("sha256").update(normalizeJdText(text), "utf8").digest("hex");
}

export function parseAcceptedJson(raw: string | null | undefined): string[] | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((id) => String(id)).filter(Boolean);
  } catch {
    return null;
  }
}

export function parseAnalysisJson(raw: string): JobAnalysis | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed as Partial<JobAnalysis>;
    if (!obj.job || !obj.verdict || !obj.coverage || !Array.isArray(obj.matches)) return null;
    return parsed as JobAnalysis;
  } catch {
    return null;
  }
}

function asParse(value: string): "heuristic" | "llm" {
  return value === "llm" ? "llm" : "heuristic";
}

function asFit(value: string): JobAnalysis["verdict"]["fit"] {
  if (value === "strong" || value === "partial" || value === "weak" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function toSummary(row: Pick<
  JobAnalysisRow,
  | "id"
  | "jd_hash"
  | "title"
  | "company"
  | "location"
  | "parse"
  | "enhanced"
  | "fit"
  | "required_total"
  | "required_in_library"
  | "required_on_resume"
  | "created_at"
  | "updated_at"
>): JobAnalysisSummary {
  return {
    id: row.id,
    jd_hash: row.jd_hash,
    title: row.title,
    company: row.company,
    location: row.location,
    parse: asParse(row.parse),
    enhanced: Number(row.enhanced) === 1,
    fit: asFit(row.fit),
    coverage: {
      required_total: Number(row.required_total) || 0,
      required_in_library: Number(row.required_in_library) || 0,
      required_on_resume: Number(row.required_on_resume) || 0,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toSaved(row: JobAnalysisRow): SavedJobAnalysis | null {
  const analysis = parseAnalysisJson(row.analysis_json);
  if (!analysis) return null;
  const accepted = parseAcceptedJson(row.accepted_json) ?? [];
  return {
    ...toSummary(row),
    jd_text: row.jd_text,
    portfolio_id: row.portfolio_id,
    resume_id: row.resume_id,
    accepted,
    analysis: { ...analysis, id: row.id },
  };
}

async function enforceLimit(db: FoliyoDb, userId: string): Promise<void> {
  const rows = await queryAll<{ id: string }>(
    db,
    `SELECT id FROM job_analyses WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC`,
    [userId],
  );
  const excess = rows.slice(JOB_ANALYSIS_LIMIT);
  for (const row of excess) {
    await run(db, "DELETE FROM job_analyses WHERE id = ? AND user_id = ?", [row.id, userId]);
  }
}

export async function saveJobAnalysis(
  db: FoliyoDb,
  userId: string,
  input: {
    jdText: string;
    analysis: JobAnalysis;
    accepted: string[];
    enhanced: boolean;
    portfolioId?: string | null;
    resumeId?: string | null;
  },
): Promise<SavedJobAnalysis> {
  const jd_hash = hashJdText(input.jdText);
  const analysisJson = JSON.stringify(input.analysis);
  const acceptedJson = JSON.stringify(input.accepted);
  const existing = await queryOne<{ id: string }>(
    db,
    "SELECT id FROM job_analyses WHERE user_id = ? AND jd_hash = ?",
    [userId, jd_hash],
  );

  const id = existing?.id ?? nanoid();
  if (existing) {
    await run(
      db,
      `UPDATE job_analyses SET
         jd_text = ?, title = ?, company = ?, location = ?, parse = ?, enhanced = ?,
         fit = ?, required_total = ?, required_in_library = ?, required_on_resume = ?,
         portfolio_id = ?, resume_id = ?, analysis_json = ?, accepted_json = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        input.jdText,
        input.analysis.job.title,
        input.analysis.job.company,
        input.analysis.job.location,
        input.analysis.job.parse,
        input.enhanced ? 1 : 0,
        input.analysis.verdict.fit,
        input.analysis.coverage.required_total,
        input.analysis.coverage.required_in_library,
        input.analysis.coverage.required_on_resume,
        input.portfolioId ?? (input.analysis.baseline.kind === "portfolio" ? input.analysis.baseline.id : null),
        input.resumeId ?? (input.analysis.baseline.kind === "resume" ? input.analysis.baseline.id : null),
        analysisJson,
        acceptedJson,
        id,
        userId,
      ],
    );
  } else {
    await run(
      db,
      `INSERT INTO job_analyses (
         id, user_id, jd_hash, jd_text, title, company, location, parse, enhanced,
         fit, required_total, required_in_library, required_on_resume,
         portfolio_id, resume_id, analysis_json, accepted_json
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        userId,
        jd_hash,
        input.jdText,
        input.analysis.job.title,
        input.analysis.job.company,
        input.analysis.job.location,
        input.analysis.job.parse,
        input.enhanced ? 1 : 0,
        input.analysis.verdict.fit,
        input.analysis.coverage.required_total,
        input.analysis.coverage.required_in_library,
        input.analysis.coverage.required_on_resume,
        input.portfolioId ?? (input.analysis.baseline.kind === "portfolio" ? input.analysis.baseline.id : null),
        input.resumeId ?? (input.analysis.baseline.kind === "resume" ? input.analysis.baseline.id : null),
        analysisJson,
        acceptedJson,
      ],
    );
    await enforceLimit(db, userId);
  }

  const saved = await getJobAnalysis(db, userId, id);
  if (!saved) throw new Error("Failed to persist job analysis");
  return saved;
}

export async function listJobAnalyses(db: FoliyoDb, userId: string): Promise<JobAnalysisSummary[]> {
  const rows = await queryAll<JobAnalysisRow>(
    db,
    `SELECT ${LIST_COLS} FROM job_analyses WHERE user_id = ?
     ORDER BY updated_at DESC, created_at DESC LIMIT ?`,
    [userId, JOB_ANALYSIS_LIMIT],
  );
  return rows.map(toSummary);
}

export async function getJobAnalysis(
  db: FoliyoDb,
  userId: string,
  id: string,
): Promise<SavedJobAnalysis | null> {
  const row = await queryOne<JobAnalysisRow>(
    db,
    "SELECT * FROM job_analyses WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!row) return null;
  return toSaved(row);
}

export async function updateJobAnalysisAccepted(
  db: FoliyoDb,
  userId: string,
  id: string,
  accepted: string[],
): Promise<SavedJobAnalysis | null> {
  const existing = await queryOne<{ id: string }>(
    db,
    "SELECT id FROM job_analyses WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!existing) return null;
  await run(
    db,
    `UPDATE job_analyses SET accepted_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [JSON.stringify(accepted), id, userId],
  );
  return getJobAnalysis(db, userId, id);
}

export async function deleteJobAnalysis(db: FoliyoDb, userId: string, id: string): Promise<boolean> {
  const existing = await queryOne<{ id: string }>(
    db,
    "SELECT id FROM job_analyses WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!existing) return false;
  await run(db, "DELETE FROM job_analyses WHERE id = ? AND user_id = ?", [id, userId]);
  return true;
}
