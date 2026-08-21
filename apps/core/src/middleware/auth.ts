import { createMiddleware } from "hono/factory";
import { bearerToken, getTokenUserId } from "../auth/tokens.js";
import { queryOne, type FoliyoDb } from "../db.js";

export type AuthUser = { id: string; email: string; plan: string; email_verified: number; mode: string };

export type AppEnv = {
  Variables: {
    userId: string;
    user: AuthUser;
  };
};

export function authMiddleware(db: FoliyoDb) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (!token) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const userId = await getTokenUserId(db, token);
    if (!userId) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const user = await queryOne<AuthUser>(
      db,
      "SELECT id, email, plan, email_verified, mode FROM users WHERE id = ?",
      [userId],
    );
    if (!user) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (user.mode === "pending_delete") {
      return c.json(
        {
          error: "pending_deletion",
          message: "This account is scheduled for deletion.",
        },
        403,
      );
    }
    if (!user.email_verified) {
      return c.json({ error: "email_not_verified" }, 403);
    }
    c.set("userId", userId);
    c.set("user", user);
    await next();
  });
}
