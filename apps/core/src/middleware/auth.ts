import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { bearerToken, getTokenUserId } from "../auth/tokens.js";
import type { FoliyoDb } from "../db.js";

export type AuthUser = { id: string; email: string; plan: string };

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
      throw new HTTPException(401, { message: JSON.stringify({ error: "unauthorized" }) });
    }
    const userId = getTokenUserId(db, token);
    if (!userId) {
      throw new HTTPException(401, { message: JSON.stringify({ error: "unauthorized" }) });
    }
    const user = db
      .prepare("SELECT id, email, plan FROM users WHERE id = ?")
      .get(userId) as AuthUser | undefined;
    if (!user) {
      throw new HTTPException(401, { message: JSON.stringify({ error: "unauthorized" }) });
    }
    c.set("userId", userId);
    c.set("user", user);
    await next();
  });
}
