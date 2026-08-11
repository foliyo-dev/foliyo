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

type ProfileRow = {
  name: string;
  headline: string;
  bio: string;
  avatar_url: string;
  location: string;
  email: string;
  website: string;
  github: string;
  linkedin: string;
  twitter: string;
};

export function profileRoutes(db: FoliyoDb) {
  const r = new Hono<AppEnv>();

  r.get("/", async (c) => {
    const userId = c.get("userId");
    const profile = await queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
    if (!profile) return c.json({ error: "not found" }, 404);
    return c.json(profile);
  });

  r.put("/", async (c) => {
    const userId = c.get("userId");
    const body = profileSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);

    const existing = await queryOne<ProfileRow & { id: string }>(
      db,
      "SELECT * FROM profile WHERE user_id = ?",
      [userId],
    );
    const d = body.data;
    const next: ProfileRow = {
      name: d.name ?? existing?.name ?? "",
      headline: d.headline ?? existing?.headline ?? "",
      bio: d.bio ?? existing?.bio ?? "",
      avatar_url: d.avatar_url ?? existing?.avatar_url ?? "",
      location: d.location ?? existing?.location ?? "",
      email: d.email ?? existing?.email ?? "",
      website: d.website ?? existing?.website ?? "",
      github: d.github ?? existing?.github ?? "",
      linkedin: d.linkedin ?? existing?.linkedin ?? "",
      twitter: d.twitter ?? existing?.twitter ?? "",
    };

    if (existing) {
      await run(
        db,
        `UPDATE profile SET name=?, headline=?, bio=?, avatar_url=?, location=?,
         email=?, website=?, github=?, linkedin=?, twitter=?, updated_at=CURRENT_TIMESTAMP
         WHERE user_id=?`,
        [
          next.name,
          next.headline,
          next.bio,
          next.avatar_url,
          next.location,
          next.email,
          next.website,
          next.github,
          next.linkedin,
          next.twitter,
          userId,
        ],
      );
    } else {
      await run(
        db,
        `INSERT INTO profile (user_id, name, headline, bio, avatar_url, location, email, website, github, linkedin, twitter)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          userId,
          next.name,
          next.headline,
          next.bio,
          next.avatar_url,
          next.location,
          next.email,
          next.website,
          next.github,
          next.linkedin,
          next.twitter,
        ],
      );
    }
    const profile = await queryOne(db, "SELECT * FROM profile WHERE user_id = ?", [userId]);
    return c.json(profile);
  });

  return r;
}
