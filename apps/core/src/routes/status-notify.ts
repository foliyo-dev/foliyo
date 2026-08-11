import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "../config.js";
import { queryOne, run, type FoliyoDb } from "../db.js";
import { APPLICATION_STATUSES } from "./applications.js";

const MAX_SKEW_SEC = 5 * 60;

const notifySchema = z.object({
  resume_token: z.string().min(1),
  event: z.enum(["application_received", "status_changed"]),
  status: z.enum(APPLICATION_STATUSES).optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  job_id: z.string().nullable().optional(),
  ats: z.string().optional(),
  next_step: z.string().nullable().optional(),
  timestamp: z.string().min(1),
  notes: z.string().nullable().optional(),
});

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function verifyHmac(rawBody: string, secret: string, providedHex: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(providedHex, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function statusNotifyRoutes(db: FoliyoDb, _config: Config) {
  const r = new Hono();

  /**
   * ATS → Foliyo application status webhook.
   * Auth: Bearer ATS API key + HMAC of raw body (X-Foliyo-Signature) + timestamp skew check.
   */
  r.post("/status/notify", async (c) => {
    const auth = c.req.header("Authorization") ?? "";
    const apiKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const signature = c.req.header("X-Foliyo-Signature") ?? "";
    const tsHeader = c.req.header("X-Foliyo-Timestamp") ?? "";

    if (!apiKey || !signature || !tsHeader) {
      return c.json({ error: "missing_auth_headers" }, 401);
    }

    const ts = Number.parseInt(tsHeader, 10);
    if (Number.isNaN(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_SKEW_SEC) {
      return c.json({ error: "timestamp_skew" }, 401);
    }

    const partner = await queryOne<{
      id: string;
      slug: string;
      hmac_secret: string;
      active: number;
    }>(db, "SELECT * FROM ats_partners WHERE api_key_hash = ? AND active = 1", [hashApiKey(apiKey)]);

    if (!partner) return c.json({ error: "invalid_api_key" }, 401);

    const rawBody = await c.req.text();
    if (!verifyHmac(rawBody, partner.hmac_secret, signature)) {
      return c.json({ error: "invalid_signature" }, 401);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    const body = notifySchema.safeParse(parsed);
    if (!body.success) {
      return c.json({ error: "invalid body", details: body.error.flatten() }, 400);
    }
    const d = body.data;

    const resume = await queryOne<{
      id: string;
      user_id: string;
      share_token: string;
      name: string;
    }>(db, "SELECT id, user_id, share_token, name FROM resumes WHERE share_token = ?", [
      d.resume_token,
    ]);
    if (!resume) return c.json({ error: "resume_not_found" }, 404);

    const status =
      d.status ??
      (d.event === "application_received" ? "application_received" : undefined);
    if (!status) return c.json({ error: "status_required" }, 400);

    const company = d.company?.trim() || "Unknown company";
    const role = d.role?.trim() || "";
    const ats = d.ats?.trim() || partner.slug;

    let application = d.job_id
      ? await queryOne<{ id: string; status: string }>(
          db,
          "SELECT id, status FROM applications WHERE user_id = ? AND job_id = ?",
          [resume.user_id, d.job_id],
        )
      : await queryOne<{ id: string; status: string }>(
          db,
          `SELECT id, status FROM applications
           WHERE user_id = ? AND resume_id = ? AND company = ? AND role = ?
           ORDER BY created_at DESC LIMIT 1`,
          [resume.user_id, resume.id, company, role],
        );

    if (!application) {
      await run(
        db,
        `INSERT INTO applications
          (user_id, resume_id, company, role, job_id, ats, status, next_step, notes, source, applied_at, status_updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,'ats', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          resume.user_id,
          resume.id,
          company,
          role,
          d.job_id ?? null,
          ats,
          status,
          d.next_step ?? null,
          d.notes ?? null,
        ],
      );
      application = await queryOne<{ id: string; status: string }>(
        db,
        "SELECT id, status FROM applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
        [resume.user_id],
      );
    } else {
      await run(
        db,
        `UPDATE applications SET
          status=?, next_step=?, notes=COALESCE(?, notes), ats=COALESCE(?, ats),
          resume_id=COALESCE(resume_id, ?),
          status_updated_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP,
          source='ats'
         WHERE id=?`,
        [
          status,
          d.next_step ?? null,
          d.notes ?? null,
          ats,
          resume.id,
          application.id,
        ],
      );
    }

    if (!application) return c.json({ error: "failed_to_upsert" }, 500);

    await run(
      db,
      "INSERT INTO application_events (application_id, event, status, payload_json) VALUES (?,?,?,?)",
      [
        application.id,
        d.event,
        status,
        JSON.stringify({
          ats,
          company,
          role,
          job_id: d.job_id ?? null,
          next_step: d.next_step ?? null,
          timestamp: d.timestamp,
          partner: partner.slug,
        }),
      ],
    );

    return c.json({
      ok: true,
      application_id: application.id,
      status,
      event: d.event,
    });
  });

  return r;
}

/** Hash helper for seeding / admin key issuance. */
export function hashAtsApiKey(key: string): string {
  return hashApiKey(key);
}
