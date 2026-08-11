import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import { queryOne, type FoliyoDb } from "../db.js";
import {
  PRICING,
  effectivePlan,
  entitlementsFor,
  reconcileExpiredPlan,
  type PlanSlug,
} from "../plan.js";

export function planRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();

  r.get("/", async (c) => {
    const userId = c.get("userId");
    const user = await queryOne<{ plan: string; plan_expires: string | null }>(
      db,
      "SELECT plan, plan_expires FROM users WHERE id = ?",
      [userId],
    );
    if (!user) return c.json({ error: "not found" }, 404);

    const plan: PlanSlug = effectivePlan(user.plan, config, user.plan_expires);
    await reconcileExpiredPlan(db, userId, user.plan, user.plan_expires);
    return c.json({
      plan,
      stored_plan: user.plan,
      plan_expires: user.plan_expires,
      billing_available: false,
      pricing: PRICING,
      entitlements: entitlementsFor(plan),
    });
  });

  return r;
}
