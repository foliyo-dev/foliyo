import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import { queryAll, run, type FoliyoDb } from "../db.js";

const postSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  content: z.string().default(""),
  excerpt: z.string().default(""),
  cover_image: z.string().default(""),
  tags: z.string().default("[]"),
  status: z.enum(["draft", "published"]).default("draft"),
  published_at: z.string().nullable().optional(),
});

export function blogRoutes(db: FoliyoDb) {
  const r = new Hono<AppEnv>();

  r.get("/posts", (c) => {
    const userId = c.get("userId");
    const items = queryAll(db, "SELECT * FROM blog_posts WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return c.json(items);
  });

  r.post("/posts", async (c) => {
    const userId = c.get("userId");
    const body = postSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = body.data;
    run(
      db,
      `INSERT INTO blog_posts (user_id, title, slug, content, excerpt, cover_image, tags, status, published_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [userId, d.title, d.slug, d.content, d.excerpt, d.cover_image, d.tags, d.status, d.published_at ?? null],
    );
    const items = queryAll(db, "SELECT * FROM blog_posts WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return c.json(items, 201);
  });

  r.put("/posts/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = postSchema.partial().safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const cols = Object.keys(body.data);
    if (cols.length === 0) return c.json({ ok: true });
    const sets = cols.map((col) => `${col}=?`).join(", ");
    run(db, `UPDATE blog_posts SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`, [
      ...Object.values(body.data), id, userId,
    ]);
    return c.json({ ok: true });
  });

  r.delete("/posts/:id", (c) => {
    const userId = c.get("userId");
    run(db, "DELETE FROM blog_posts WHERE id=? AND user_id=?", [c.req.param("id"), userId]);
    return c.body(null, 204);
  });

  return r;
}
