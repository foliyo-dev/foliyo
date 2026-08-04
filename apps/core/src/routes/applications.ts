import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import type { SQLInputValue } from "node:sqlite";
import { queryAll, queryOne, run, type FoliyoDb } from "../db.js";

export const APPLICATION_STATUSES = [
  "application_received",
  "viewed",
  "shortlisted",
  "interview_scheduled",
  "offer_extended",
  "hired",
  "rejected",
  "withdrawn",
  "on_hold",
] as const;

const statusEnum = z.enum(APPLICATION_STATUSES);

const createSchema = z.object({
  resume_id: z.string().nullable().optional(),
  company: z.string().min(1),
  role: z.string().default(""),
  job_id: z.string().nullable().optional(),
  ats: z.string().nullable().optional(),
  status: statusEnum.default("application_received"),
  next_step: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  applied_at: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

export function applicationsRoutes(db: FoliyoDb) {
  const r = new Hono<AppEnv>();

  r.get("/", (c) => {
    const userId = c.get("userId");
    const items = queryAll(
      db,
      `SELECT a.*, r.name AS resume_name, r.share_token AS resume_share_token
       FROM applications a
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.user_id = ?
       ORDER BY COALESCE(a.status_updated_at, a.applied_at, a.created_at) DESC`,
      [userId],
    );
    return c.json(items);
  });

  r.get("/:id", (c) => {
    const userId = c.get("userId");
    const item = queryOne(
      db,
      `SELECT a.*, r.name AS resume_name
       FROM applications a
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = ? AND a.user_id = ?`,
      [c.req.param("id"), userId],
    );
    if (!item) return c.json({ error: "not found" }, 404);
    const events = queryAll(
      db,
      "SELECT * FROM application_events WHERE application_id = ? ORDER BY created_at DESC",
      [c.req.param("id")],
    );
    return c.json({ ...item, events });
  });

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const body = createSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body", details: body.error.flatten() }, 400);
    const d = body.data;

    if (d.resume_id) {
      const resume = queryOne(db, "SELECT id FROM resumes WHERE id = ? AND user_id = ?", [
        d.resume_id,
        userId,
      ]);
      if (!resume) return c.json({ error: "resume not found" }, 400);
    }

    run(
      db,
      `INSERT INTO applications
        (user_id, resume_id, company, role, job_id, ats, status, next_step, notes, source, applied_at, status_updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,'manual', COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`,
      [
        userId,
        d.resume_id ?? null,
        d.company,
        d.role,
        d.job_id ?? null,
        d.ats ?? null,
        d.status,
        d.next_step ?? null,
        d.notes ?? null,
        d.applied_at ?? null,
      ],
    );

    const created = queryOne(
      db,
      "SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      [userId],
    );
    if (created) {
      run(
        db,
        "INSERT INTO application_events (application_id, event, status, payload_json) VALUES (?,?,?,?)",
        [
          (created as { id: string }).id,
          "application_received",
          d.status,
          JSON.stringify({ source: "manual" }),
        ],
      );
    }

    const items = queryAll(
      db,
      `SELECT a.*, r.name AS resume_name
       FROM applications a
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.user_id = ?
       ORDER BY COALESCE(a.status_updated_at, a.applied_at, a.created_at) DESC`,
      [userId],
    );
    return c.json(items, 201);
  });

  r.put("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const existing = queryOne<{ id: string; status: string }>(
      db,
      "SELECT id, status FROM applications WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (!existing) return c.json({ error: "not found" }, 404);

    const body = updateSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = body.data;

    if (d.resume_id) {
      const resume = queryOne(db, "SELECT id FROM resumes WHERE id = ? AND user_id = ?", [
        d.resume_id,
        userId,
      ]);
      if (!resume) return c.json({ error: "resume not found" }, 400);
    }

    const cols: string[] = [];
    const vals: SQLInputValue[] = [];
    for (const [key, value] of Object.entries(d)) {
      if (value === undefined) continue;
      cols.push(`${key}=?`);
      vals.push(value as SQLInputValue);
    }
    if (cols.length === 0) return c.json({ ok: true });

    if (d.status && d.status !== existing.status) {
      cols.push("status_updated_at=CURRENT_TIMESTAMP");
    }
    cols.push("updated_at=CURRENT_TIMESTAMP");

    run(db, `UPDATE applications SET ${cols.join(", ")} WHERE id=? AND user_id=?`, [
      ...vals,
      id,
      userId,
    ]);

    if (d.status && d.status !== existing.status) {
      run(
        db,
        "INSERT INTO application_events (application_id, event, status, payload_json) VALUES (?,?,?,?)",
        [id, "status_changed", d.status, JSON.stringify({ source: "manual", next_step: d.next_step ?? null })],
      );
    }

    return c.json({ ok: true });
  });

  r.delete("/:id", (c) => {
    const userId = c.get("userId");
    run(db, "DELETE FROM applications WHERE id=? AND user_id=?", [c.req.param("id"), userId]);
    return c.body(null, 204);
  });

  return r;
}
