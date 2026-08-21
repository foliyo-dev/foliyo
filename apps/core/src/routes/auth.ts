import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "../config.js";
import { checkPasswordTimed, hashPassword } from "../auth/password.js";
import {
  bearerToken,
  createToken,
  deleteToken,
  deleteTokensForUser,
  getTokenUserId,
} from "../auth/tokens.js";
import { queryOne, run, type FoliyoDb } from "../db.js";
import {
  clearPasswordResetToken,
  createPasswordResetToken,
  findUserByResetToken,
  sendPasswordResetEmail,
} from "../email/password-reset.js";
import { rateLimitResponse } from "../auth/limit.js";
import { normalizeEmail } from "../auth/datetime.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).max(72),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});

export function authRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono();

  r.post("/login", async (c) => {
    const body = loginSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "invalid body" }, 400);
    }
    const email = normalizeEmail(body.data.email);
    const limited = rateLimitResponse(c, "login", email);
    if (limited) return limited;

    const user = await queryOne<{
      id: string;
      email: string;
      password: string;
      plan: string;
      handle: string | null;
      handle_changed_at: string | null;
      onboarding_complete: number;
      email_verified: number;
      mode: string;
    }>(
      db,
      "SELECT id, email, password, plan, handle, handle_changed_at, onboarding_complete, email_verified, mode FROM users WHERE lower(email) = ?",
      [email],
    );
    const passwordOk = checkPasswordTimed(user?.password, body.data.password);
    if (!user || !passwordOk) {
      return c.json({ error: "invalid credentials" }, 401);
    }
    if (user.mode === "pending_delete") {
      return c.json(
        {
          error: "pending_deletion",
          message:
            "This account is scheduled for deletion. Cancel deletion first, then sign in again.",
        },
        403,
      );
    }
    if (!user.email_verified) {
      return c.json(
        {
          error: "email_not_verified",
          message: "Confirm your email and choose a password from the link we sent.",
        },
        403,
      );
    }
    const token = await createToken(db, user.id);
    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        handle: user.handle,
        handle_changed_at: user.handle_changed_at,
        onboarding_complete: user.onboarding_complete,
        email_verified: user.email_verified ?? 0,
      },
    });
  });

  r.post("/logout", async (c) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (token) await deleteToken(db, token);
    return c.json({});
  });

  r.get("/me", async (c) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const userId = await getTokenUserId(db, token);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const user = await queryOne<{
      id: string;
      email: string;
      plan: string;
      handle: string | null;
      handle_changed_at: string | null;
      onboarding_complete: number;
      email_verified: number;
    }>(
      db,
      "SELECT id, email, plan, handle, handle_changed_at, onboarding_complete, email_verified FROM users WHERE id = ?",
      [userId],
    );
    if (!user) return c.json({ error: "not found" }, 404);
    return c.json({
      user: {
        ...user,
        email_verified: user.email_verified ?? 0,
      },
    });
  });

  r.post("/forgot", async (c) => {
    const body = forgotSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "invalid body" }, 400);
    }
    const email = normalizeEmail(body.data.email);
    const limited = rateLimitResponse(c, "forgot", email);
    if (limited) return limited;

    const user = await queryOne<{ id: string; email: string; email_verified: number }>(
      db,
      "SELECT id, email, email_verified FROM users WHERE lower(email) = ?",
      [email],
    );
    if (user?.email_verified) {
      const token = await createPasswordResetToken(db, user.id);
      const resetUrl = `${config.dashboardUrl.replace(/\/$/, "")}/reset?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail(config, { to: user.email, resetUrl });
    }
    return c.json({ ok: true });
  });

  r.post("/change-password", async (c) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const userId = await getTokenUserId(db, token);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const body = changePasswordSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "invalid body" }, 400);
    }

    const user = await queryOne<{ id: string; password: string; email_verified: number }>(
      db,
      "SELECT id, password, email_verified FROM users WHERE id = ?",
      [userId],
    );
    if (!user || !user.email_verified) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (!checkPasswordTimed(user.password, body.data.currentPassword)) {
      return c.json({ error: "incorrect current password" }, 401);
    }

    await run(db, "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      hashPassword(body.data.newPassword),
      userId,
    ]);
    await deleteTokensForUser(db, userId, token);

    return c.json({ ok: true });
  });

  r.post("/reset", async (c) => {
    const body = resetSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "invalid body" }, 400);
    }
    const limited = rateLimitResponse(c, "reset");
    if (limited) return limited;

    const user = await findUserByResetToken(db, body.data.token);
    if (!user) {
      return c.json({ error: "invalid or expired token" }, 400);
    }
    await run(db, "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      hashPassword(body.data.password),
      user.id,
    ]);
    await clearPasswordResetToken(db, user.id);
    await deleteTokensForUser(db, user.id);
    return c.json({ ok: true });
  });

  return r;
}
