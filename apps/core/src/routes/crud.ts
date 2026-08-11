import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import { queryAll, run, type FoliyoDb, type SqlValue } from "../db.js";
import { suggestSkillsFromLibrary } from "../skills/evidence.js";

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
      skills_developed: z.string().default("[]"),
      featured: z.number().int().default(0),
      sort_order: z.number().int().default(0),
    }),
    { afterWrite: (userId) => suggestSkillsFromLibrary(db, userId) },
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
      start_date: z.string().min(1),
      end_date: z.string().nullable().optional(),
      description: z.string().default(""),
      article_url: z.string().default(""),
      skills_developed: z.string().default("[]"),
      sort_order: z.number().int().default(0),
    }),
    { afterWrite: (userId) => suggestSkillsFromLibrary(db, userId) },
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
      start_date: z.string().min(1),
      end_date: z.string().nullable().optional(),
      description: z.string().default(""),
      skills_developed: z.string().default("[]"),
      sort_order: z.number().int().default(0),
    }),
    { afterWrite: (userId) => suggestSkillsFromLibrary(db, userId) },
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
    { afterWrite: (userId) => suggestSkillsFromLibrary(db, userId) },
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
  );
}

function crudRoutes(
  db: FoliyoDb,
  table: string,
  schema: z.ZodObject<z.ZodRawShape>,
  opts?: { afterWrite?: (userId: string) => Promise<unknown> },
) {
  const r = new Hono<AppEnv>();

  r.get("/", async (c) => {
    const userId = c.get("userId");
    const items = await queryAll(db, `SELECT * FROM ${table} WHERE user_id = ? ORDER BY sort_order`, [userId]);
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
    const items = await queryAll(db, `SELECT * FROM ${table} WHERE user_id = ? ORDER BY sort_order`, [userId]);
    return c.json(items, 201);
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
    await run(db, `UPDATE ${table} SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`, values);
    if (opts?.afterWrite) await opts.afterWrite(userId);
    return c.json({ ok: true });
  });

  r.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    await run(db, `DELETE FROM ${table} WHERE id=? AND user_id=?`, [id, userId]);
    if (opts?.afterWrite) await opts.afterWrite(userId);
    return c.body(null, 204);
  });

  return r;
}
