import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import { queryOne, run, type FoliyoDb } from "../db.js";

const profileSchema = z.object({
  name: z.string().optional(),
  headline: z.string().optional(),
  bio: z.string().optional(),
  avatar_url: z.string().optional(),
  location: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  github: z.string().optional(),
  linkedin: z.string().optional(),
  twitter: z.string().optional(),
});

export function profileRoutes(db: FoliyoDb) {
  const r = new Hono<AppEnv>();

  r.get("/", (c) => {
    const userId = c.get("userId");
    const profile = queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
    if (!profile) return c.json({ error: "not found" }, 404);
    return c.json(profile);
  });

  r.put("/", async (c) => {
    const userId = c.get("userId");
    const body = profileSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);

    const existing = queryOne(db, "SELECT id FROM profile WHERE user_id = ?", [userId]);
    const d = body.data;
    if (existing) {
      run(
        db,
        `UPDATE profile SET name=?, headline=?, bio=?, avatar_url=?, location=?,
         email=?, website=?, github=?, linkedin=?, twitter=?, updated_at=CURRENT_TIMESTAMP
         WHERE user_id=?`,
        [
          d.name ?? "", d.headline ?? "", d.bio ?? "", d.avatar_url ?? "",
          d.location ?? "", d.email ?? "", d.website ?? "", d.github ?? "",
          d.linkedin ?? "", d.twitter ?? "", userId,
        ],
      );
    } else {
      run(
        db,
        `INSERT INTO profile (user_id, name, headline, bio, avatar_url, location, email, website, github, linkedin, twitter)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          userId, d.name ?? "", d.headline ?? "", d.bio ?? "", d.avatar_url ?? "",
          d.location ?? "", d.email ?? "", d.website ?? "", d.github ?? "",
          d.linkedin ?? "", d.twitter ?? "",
        ],
      );
    }
    const profile = queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
    return c.json(profile);
  });

  return r;
}
