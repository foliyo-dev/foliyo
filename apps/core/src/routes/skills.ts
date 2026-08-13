import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import { queryAll, queryOne, run, type FoliyoDb } from "../db.js";
import {
  evidenceLabelsForSkills,
  softHintsForSkill,
  suggestSkillsFromLibrary,
} from "../skills/evidence.js";

const levels = z.enum(["beginner", "intermediate", "advanced", "expert"]);
const recency = z.enum(["current", "past"]);

const createSchema = z.object({
  name: z.string().min(1),
  level: levels.default("intermediate"),
  category: z.string().default("general"),
  recency: recency.default("current"),
  sort_order: z.number().int().default(0),
});

const updateSchema = createSchema.partial();

const confirmSchema = z.object({
  level: levels.optional(),
  category: z.string().optional(),
  recency: recency.optional(),
});

async function enrichSkills(db: FoliyoDb, rows: Record<string, unknown>[]) {
  const ids = rows.map((r) => String(r.id));
  const labels = await evidenceLabelsForSkills(db, ids);
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const evidence = labels.get(String(r.id)) ?? [];
    const hints =
      r.status === "pending" ? await softHintsForSkill(db, String(r.id)) : null;
    out.push({
      ...r,
      evidence,
      suggested_level: hints?.level ?? undefined,
      suggested_recency: hints?.recency ?? undefined,
      suggested_years: hints?.years ?? undefined,
    });
  }
  return out;
}

/**
 * Insert-or-confirm a single skill by name (case-insensitive dedupe against the
 * `skills_user_name_lower_active` constraint). Shared by the single-item and bulk routes.
 */
async function upsertSkill(
  db: FoliyoDb,
  userId: string,
  d: z.infer<typeof createSchema>,
): Promise<{ merged: boolean }> {
  const existing = await queryOne<{ id: string }>(
    db,
    "SELECT id FROM skills WHERE user_id = ? AND lower(name) = lower(?) AND status != 'dismissed'",
    [userId, d.name],
  );
  if (existing) {
    await run(
      db,
      `UPDATE skills SET name=?, level=?, category=?, status='confirmed', recency=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND user_id=?`,
      [d.name, d.level, d.category, d.recency, d.sort_order, existing.id, userId],
    );
    return { merged: true };
  }
  await run(
    db,
    `INSERT INTO skills (user_id, name, level, category, source, status, recency, sort_order)
     VALUES (?, ?, ?, ?, 'manual', 'confirmed', ?, ?)`,
    [userId, d.name, d.level, d.category, d.recency, d.sort_order],
  );
  return { merged: false };
}

export function skillsRoutes(db: FoliyoDb) {
  const r = new Hono<AppEnv>();

  r.get("/", async (c) => {
    const userId = c.get("userId");
    const status = c.req.query("status");
    let sql = "SELECT * FROM skills WHERE user_id = ?";
    const params: string[] = [userId];
    if (status && status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }
    sql += " ORDER BY sort_order, name";
    const items = await queryAll(db, sql, params);
    return c.json(await enrichSkills(db, items));
  });

  r.post("/suggest-from-library", async (c) => {
    const userId = c.get("userId");
    const result = await suggestSkillsFromLibrary(db, userId);
    return c.json(result);
  });

  r.post("/:id/confirm", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = confirmSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: "invalid body" }, 400);

    const skill = await queryOne<{ id: string; status: string }>(
      db,
      "SELECT id, status FROM skills WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (!skill) return c.json({ error: "not found" }, 404);

    const hints = skill.status === "pending" ? await softHintsForSkill(db, id) : null;
    const level = body.data.level ?? hints?.level ?? "intermediate";
    const rec = body.data.recency ?? hints?.recency ?? "current";

    const sets = [
      "status='confirmed'",
      "level=?",
      "recency=?",
      "updated_at=CURRENT_TIMESTAMP",
    ];
    const values: (string | number)[] = [level, rec];
    if (body.data.category) {
      sets.push("category=?");
      values.push(body.data.category);
    }
    values.push(id, userId);
    await run(db, `UPDATE skills SET ${sets.join(", ")} WHERE id=? AND user_id=?`, values);
    const updated = await queryOne(db, "SELECT * FROM skills WHERE id = ?", [id]);
    const [enriched] = await enrichSkills(db, updated ? [updated] : []);
    return c.json(enriched);
  });

  r.post("/:id/dismiss", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const skill = await queryOne(db, "SELECT id FROM skills WHERE id = ? AND user_id = ?", [id, userId]);
    if (!skill) return c.json({ error: "not found" }, 404);
    await run(
      db,
      "UPDATE skills SET status='dismissed', updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
      [id, userId],
    );
    return c.json({ ok: true });
  });

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const body = createSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);

    // One active (non-dismissed) skill name per user, case-insensitive (DB constraint).
    // A name collision usually means this skill was already auto-suggested (status='pending')
    // — confirm/update that row instead of a raw INSERT crashing on the unique index.
    const { merged } = await upsertSkill(db, userId, body.data);
    const items = await queryAll(db, "SELECT * FROM skills WHERE user_id = ? ORDER BY sort_order, name", [userId]);
    return c.json(await enrichSkills(db, items), merged ? 200 : 201);
  });

  // Bulk import (e.g. AI resume "Save to library"): one HTTP round trip for the whole
  // batch. Partial failures (bad rows) don't abort the rest.
  r.post("/bulk", async (c) => {
    const userId = c.get("userId");
    const payload = await c.req.json().catch(() => null);
    const rawItems = Array.isArray((payload as { items?: unknown[] } | null)?.items)
      ? (payload as { items: unknown[] }).items
      : [];
    const failed: { index: number; error: string }[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const body = createSchema.safeParse(rawItems[i]);
      if (!body.success) {
        failed.push({ index: i, error: "invalid body" });
        continue;
      }
      try {
        await upsertSkill(db, userId, body.data);
      } catch (err) {
        failed.push({ index: i, error: err instanceof Error ? err.message : "insert failed" });
      }
    }
    const items = await queryAll(db, "SELECT * FROM skills WHERE user_id = ? ORDER BY sort_order, name", [userId]);
    return c.json({ items: await enrichSkills(db, items), failed }, 201);
  });

  r.put("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = updateSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const cols = Object.keys(body.data);
    if (cols.length === 0) return c.json({ ok: true });
    const sets = cols.map((col) => `${col}=?`).join(", ");
    await run(db, `UPDATE skills SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`, [
      ...Object.values(body.data),
      id,
      userId,
    ]);
    return c.json({ ok: true });
  });

  r.delete("/:id", async (c) => {
    const userId = c.get("userId");
    await run(db, "DELETE FROM skills WHERE id=? AND user_id=?", [c.req.param("id"), userId]);
    return c.body(null, 204);
  });

  return r;
}
