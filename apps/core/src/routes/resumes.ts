import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import { queryAll, run, type FoliyoDb } from "../db.js";
import { nanoid } from "nanoid";

const resumeSchema = z.object({
  portfolio_id: z.string().min(1),
  name: z.string().min(1),
  theme_slug: z.string().default("classic"),
  is_public: z.number().int().default(0),
});

export function resumesRoutes(db: FoliyoDb) {
  const r = new Hono<AppEnv>();

  r.get("/", (c) => {
    const userId = c.get("userId");
    const items = queryAll(db, "SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return c.json(items);
  });

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const body = resumeSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = body.data;
    run(
      db,
      "INSERT INTO resumes (portfolio_id, user_id, name, theme_slug, is_public, share_token) VALUES (?,?,?,?,?,?)",
      [d.portfolio_id, userId, d.name, d.theme_slug, d.is_public, nanoid(16)],
    );
    const items = queryAll(db, "SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    return c.json(items, 201);
  });

  r.put("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = resumeSchema.partial().safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const cols = Object.keys(body.data);
    if (cols.length === 0) return c.json({ ok: true });
    const sets = cols.map((col) => `${col}=?`).join(", ");
    run(db, `UPDATE resumes SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`, [
      ...Object.values(body.data), id, userId,
    ]);
    return c.json({ ok: true });
  });

  r.delete("/:id", (c) => {
    const userId = c.get("userId");
    run(db, "DELETE FROM resumes WHERE id=? AND user_id=?", [c.req.param("id"), userId]);
    return c.body(null, 204);
  });

  r.post("/:id/regenerate-token", (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const token = nanoid(16);
    run(db, "UPDATE resumes SET share_token=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?", [
      token, id, userId,
    ]);
    return c.json({ share_token: token });
  });

  return r;
}
