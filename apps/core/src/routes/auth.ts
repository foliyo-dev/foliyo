import { Hono } from "hono";
import { z } from "zod";
import { checkPassword } from "../auth/password.js";
import { bearerToken, createToken, deleteToken, getTokenUserId } from "../auth/tokens.js";
import type { FoliyoDb } from "../db.js";

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export function authRoutes(db: FoliyoDb) {
  const r = new Hono();

  r.post("/login", async (c) => {
    const body = loginSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "invalid body" }, 400);
    }
    const user = db
      .prepare(
        "SELECT id, email, password, plan, handle, onboarding_complete, email_verified FROM users WHERE email = ?",
      )
      .get(body.data.email) as {
      id: string;
      email: string;
      password: string;
      plan: string;
      handle: string | null;
      onboarding_complete: number;
      email_verified: number;
    } | undefined;
    if (!user || !checkPassword(user.password, body.data.password)) {
      return c.json({ error: "invalid credentials" }, 401);
    }
    const token = createToken(db, user.id);
    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        handle: user.handle,
        onboarding_complete: user.onboarding_complete,
        email_verified: user.email_verified ?? 1,
      },
    });
  });

  r.post("/logout", async (c) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (token) deleteToken(db, token);
    return c.json({});
  });

  r.get("/me", async (c) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const userId = getTokenUserId(db, token);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const user = db
      .prepare(
        "SELECT id, email, plan, handle, onboarding_complete, email_verified FROM users WHERE id = ?",
      )
      .get(userId) as {
      id: string;
      email: string;
      plan: string;
      handle: string | null;
      onboarding_complete: number;
      email_verified: number;
    } | undefined;
    if (!user) return c.json({ error: "not found" }, 404);
    return c.json({
      user: {
        ...user,
        email_verified: user.email_verified ?? 1,
      },
    });
  });

  return r;
}
