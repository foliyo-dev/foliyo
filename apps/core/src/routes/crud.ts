import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import { run, type FoliyoDb, type SqlValue } from "../db.js";
import { suggestSkillsFromLibrary } from "../skills/evidence.js";
import {
  listActive,
  listTrash,
  purgeRow,
  restoreRow,
  softDeleteRow,
} from "../soft-delete.js";

export function projectsRoutes(db: FoliyoDb) {
  return crudRoutes(
    db,
    "projects",
    z.object({
      title: z.string().min(1),
      description: z.string().default(""),
      url: z.string().default(""),
      repo_url: z.string().default(""),
      article_url: z.string().default(""),
      image_url: z.string().default(""),
      url_label: z.string().max(40).default(""),
      repo_url_label: z.string().max(40).default(""),
      article_url_label: z.string().max(40).default(""),
      skills_developed: z.string().default("[]"),
      featured: z.number().int().default(0),
      sort_order: z.number().int().default(0),
    }),
    { afterWrite: (userId) => suggestSkillsFromLibrary(db, userId), orderBy: "sort_order" },
  );
}

export function experienceRoutes(db: FoliyoDb) {
  return crudRoutes(
    db,
    "experience",
    z.object({
      company: z.string().min(1),
      role: z.string().min(1),
      location: z.string().default(""),
      // Not `min(1)`: AI/bulk import can't always pin an exact start date — better to
      // save with a blank date (editable later) than hard-fail the whole import.
      start_date: z.string().default(""),
      end_date: z.string().nullable().optional(),
      description: z.string().default(""),
      article_url: z.string().default(""),
      article_url_label: z.string().max(40).default(""),
      skills_developed: z.string().default("[]"),
      sort_order: z.number().int().default(0),
    }),
    { afterWrite: (userId) => suggestSkillsFromLibrary(db, userId), orderBy: "sort_order" },
  );
}

export function educationRoutes(db: FoliyoDb) {
  return crudRoutes(
    db,
    "education",
    z.object({
      institution: z.string().min(1),
      degree: z.string().default(""),
      field: z.string().default(""),
      start_date: z.string().default(""),
      end_date: z.string().nullable().optional(),
      description: z.string().default(""),
      skills_developed: z.string().default("[]"),
      sort_order: z.number().int().default(0),
    }),
    { afterWrite: (userId) => suggestSkillsFromLibrary(db, userId), orderBy: "sort_order" },
  );
}

export function certificationsRoutes(db: FoliyoDb) {
  return crudRoutes(
    db,
    "certifications",
    z.object({
      name: z.string().min(1),
      issuer: z.string().default(""),
      credential_id: z.string().default(""),
      credential_url: z.string().default(""),
      issued_at: z.string().nullable().optional(),
      expires_at: z.string().nullable().optional(),
      description: z.string().default(""),
      skills_developed: z.string().default("[]"),
      sort_order: z.number().int().default(0),
    }),
    { afterWrite: (userId) => suggestSkillsFromLibrary(db, userId), orderBy: "sort_order" },
  );
}

export function languagesRoutes(db: FoliyoDb) {
  return crudRoutes(db, "languages", z.object({
    name: z.string().min(1),
    proficiency: z.enum(["native", "fluent", "conversational", "basic"]).default("conversational"),
    sort_order: z.number().int().default(0),
  }));
}

const socialProviders = [
  "github",
  "linkedin",
  "twitter",
  "youtube",
  "instagram",
  "dribbble",
  "behance",
  "medium",
  "bluesky",
  "mastodon",
  "website",
  "other",
] as const;

export function socialLinksRoutes(db: FoliyoDb) {
  return crudRoutes(
    db,
    "social_links",
    z.object({
      provider: z.enum(socialProviders),
      label: z.string().default(""),
      value: z.string().min(1),
      sort_order: z.number().int().default(0),
    }),
    { orderBy: "sort_order, provider" },
  );
}

function crudRoutes(
  db: FoliyoDb,
  table: string,
  schema: z.ZodObject<z.ZodRawShape>,
  opts?: {
    afterWrite?: (userId: string) => Promise<unknown>;
    orderBy?: string;
  },
) {
  const r = new Hono<AppEnv>();
  const orderBy = opts?.orderBy ?? "sort_order";

  r.get("/", async (c) => {
    const userId = c.get("userId");
    const items = await listActive(db, table, userId, orderBy);
    return c.json(items);
  });

  r.get("/deleted", async (c) => {
    const userId = c.get("userId");
    const items = await listTrash(db, table, userId);
    return c.json(items);
  });

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const body = schema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const cols = Object.keys(body.data);
    const placeholders = cols.map(() => "?").join(", ");
    const values = [...Object.values(body.data), userId] as SqlValue[];
    await run(db, `INSERT INTO ${table} (${cols.join(", ")}, user_id) VALUES (${placeholders}, ?)`, values);
    if (opts?.afterWrite) await opts.afterWrite(userId);
    const items = await listActive(db, table, userId, orderBy);
    return c.json(items, 201);
  });

  // Bulk import (e.g. AI resume "Save to library"): one HTTP round trip and one
  // afterWrite recompute for the whole batch, instead of N of each. Partial failures
  // (e.g. a row that fails validation) don't abort the rest of the batch.
  r.post("/bulk", async (c) => {
    const userId = c.get("userId");
    const payload = await c.req.json().catch(() => null);
    const rawItems = Array.isArray((payload as { items?: unknown[] } | null)?.items)
      ? (payload as { items: unknown[] }).items
      : [];
    const failed: { index: number; error: string }[] = [];
    let insertedCount = 0;
    for (let i = 0; i < rawItems.length; i++) {
      const body = schema.safeParse(rawItems[i]);
      if (!body.success) {
        failed.push({ index: i, error: "invalid body" });
        continue;
      }
      const cols = Object.keys(body.data);
      const placeholders = cols.map(() => "?").join(", ");
      const values = [...Object.values(body.data), userId] as SqlValue[];
      try {
        await run(db, `INSERT INTO ${table} (${cols.join(", ")}, user_id) VALUES (${placeholders}, ?)`, values);
        insertedCount += 1;
      } catch (err) {
        failed.push({ index: i, error: err instanceof Error ? err.message : "insert failed" });
      }
    }
    if (opts?.afterWrite && insertedCount > 0) await opts.afterWrite(userId);
    const items = await listActive(db, table, userId, orderBy);
    return c.json({ items, failed }, 201);
  });

  r.post("/:id/restore", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const result = await restoreRow(db, table, id, userId);
    if (result === "not_found") return c.json({ error: "not found" }, 404);
    if (result === "conflict") {
      return c.json({ error: "conflict", message: "An active item with the same name already exists" }, 409);
    }
    if (opts?.afterWrite) await opts.afterWrite(userId);
    return c.json({ ok: true });
  });

  r.put("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = schema.partial().safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const cols = Object.keys(body.data);
    if (cols.length === 0) return c.json({ ok: true });
    const sets = cols.map((col) => `${col}=?`).join(", ");
    const values = [...Object.values(body.data), id, userId] as SqlValue[];
    await run(
      db,
      `UPDATE ${table} SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND deleted_at IS NULL`,
      values,
    );
    if (opts?.afterWrite) await opts.afterWrite(userId);
    return c.json({ ok: true });
  });

  r.delete("/:id/purge", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const ok = await purgeRow(db, table, id, userId);
    if (!ok) return c.json({ error: "not found" }, 404);
    if (opts?.afterWrite) await opts.afterWrite(userId);
    return c.body(null, 204);
  });

  r.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const ok = await softDeleteRow(db, table, id, userId);
    if (!ok) return c.json({ error: "not found" }, 404);
    if (opts?.afterWrite) await opts.afterWrite(userId);
    return c.body(null, 204);
  });

  return r;
}
