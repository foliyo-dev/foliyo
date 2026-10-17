import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import { queryAll, queryOne, run, type FoliyoDb, type SqlValue } from "../db.js";
import {
  entitlementsFor,
  getEffectiveUserPlan,
  upgradePayload,
} from "../plan.js";

const postSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).max(120),
  content: z.string().default(""),
  excerpt: z.string().default(""),
  cover_image: z.string().default(""),
  tags: z.string().default("[]"),
  status: z.enum(["draft", "published"]).default("draft"),
  published_at: z.string().nullable().optional(),
});

export function blogRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();

  r.get("/posts", async (c) => {
    const userId = c.get("userId");
    const items = await queryAll(
      db,
      "SELECT * FROM blog_posts WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    );
    return c.json(items);
  });

  r.get("/posts/:id", async (c) => {
    const userId = c.get("userId");
    const post = await queryOne(
      db,
      "SELECT * FROM blog_posts WHERE id = ? AND user_id = ?",
      [c.req.param("id"), userId],
    );
    if (!post) return c.json({ error: "not found" }, 404);
    return c.json(post);
  });

  r.post("/posts", async (c) => {
    const userId = c.get("userId");
    const plan = await getEffectiveUserPlan(db, userId, config);
    if (!entitlementsFor(plan).user_blog) {
      return c.json(
        upgradePayload(
          "user_blog",
          "Blog writing is a Pro feature. Upgrade to publish posts on your Foliyo site.",
        ),
        402,
      );
    }

    const body = postSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = body.data;

    const publishedAt =
      d.status === "published" ? (d.published_at ?? new Date().toISOString()) : null;

    try {
      await run(
        db,
        `INSERT INTO blog_posts (user_id, title, slug, content, excerpt, cover_image, tags, status, published_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          userId,
          d.title,
          d.slug,
          d.content,
          d.excerpt,
          d.cover_image,
          d.tags,
          d.status,
          publishedAt,
        ],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE/i.test(msg) || (err as { code?: string }).code === "23505") {
        return c.json({ error: "duplicate", message: "That slug is already used." }, 409);
      }
      throw err;
    }

    const items = await queryAll(
      db,
      "SELECT * FROM blog_posts WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    );
    return c.json(items, 201);
  });

  r.put("/posts/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const existing = await queryOne<{ id: string; status: string; published_at: string | null }>(
      db,
      "SELECT id, status, published_at FROM blog_posts WHERE id=? AND user_id=?",
      [id, userId],
    );
    if (!existing) return c.json({ error: "not found" }, 404);

    const body = postSchema.partial().safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = { ...body.data };

    const publishing =
      d.status === "published" && existing.status !== "published";
    if (publishing || d.status === "published") {
      const plan = await getEffectiveUserPlan(db, userId, config);
      if (!entitlementsFor(plan).user_blog) {
        return c.json(
          upgradePayload(
            "user_blog",
            "Publishing blog posts requires Pro. Upgrade to unlock blogging.",
          ),
          402,
        );
      }
    }

    // Preserve original publish time: first publish sets it; updates/republish keep it.
    // Unpublish (draft) keeps published_at for history when the client omits a null wipe.
    if (d.status === "published") {
      if (existing.published_at) {
        d.published_at = existing.published_at;
      } else {
        d.published_at = d.published_at ?? new Date().toISOString();
      }
    } else if (d.status === "draft" && d.published_at === null && existing.published_at) {
      d.published_at = existing.published_at;
    }

    const cols = Object.keys(d);
    if (cols.length === 0) return c.json({ ok: true });

    try {
      const sets = cols.map((col) => `${col}=?`).join(", ");
      await run(db, `UPDATE blog_posts SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`, [
        ...Object.values(d) as SqlValue[],
        id,
        userId,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE/i.test(msg) || (err as { code?: string }).code === "23505") {
        return c.json({ error: "duplicate", message: "That slug is already used." }, 409);
      }
      throw err;
    }

    return c.json({ ok: true });
  });

  r.delete("/posts/:id", async (c) => {
    const userId = c.get("userId");
    await run(db, "DELETE FROM blog_posts WHERE id=? AND user_id=?", [c.req.param("id"), userId]);
    return c.body(null, 204);
  });

  return r;
}
