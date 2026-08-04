import type { FoliyoDb } from "./db.js";
import { queryOne, run } from "./db.js";
import type { Config } from "./config.js";

export type PlanSlug = "free" | "pro" | "lifetime" | "selfhost";

export const FREE_PORTFOLIO_LIMIT = 1;

/** Hosted India pricing (execution plan). */
export const PRICING = {
  monthlyInr: 99,
  lifetimeInr: 2999,
  currency: "INR",
} as const;

export type PlanEntitlements = {
  portfolios_unlimited: boolean;
  pdf_export: boolean;
  remove_branding: boolean;
  /** Hosted Pro: AI resume → Foliyo Resume Spec draft (OpenRouter in cloud). */
  ai_resume_import: boolean;
  portfolio_limit: number | null;
};

export type UpgradePayload = {
  error: string;
  message: string;
  upgrade: true;
  feature: string;
  pricing: typeof PRICING;
  entitlements_unlocked: PlanEntitlements;
};

export function normalizePlan(plan: string | null | undefined): PlanSlug {
  const p = (plan ?? "free").toLowerCase();
  if (p === "pro" || p === "lifetime" || p === "selfhost") return p;
  return "free";
}

export function isProPlan(plan: string | null | undefined): boolean {
  const p = normalizePlan(plan);
  return p === "pro" || p === "lifetime" || p === "selfhost";
}

/**
 * Monthly Pro with a past `plan_expires` is expired.
 * Lifetime / selfhost / free / null expires never expire via this check.
 */
export function isPlanExpired(
  plan: string | null | undefined,
  planExpires: string | null | undefined,
): boolean {
  const p = normalizePlan(plan);
  if (p !== "pro") return false;
  if (!planExpires) return false;
  const expiresMs = Date.parse(planExpires.includes("T") ? planExpires : planExpires.replace(" ", "T") + "Z");
  if (Number.isNaN(expiresMs)) {
    const fallback = Date.parse(planExpires);
    if (Number.isNaN(fallback)) return false;
    return fallback <= Date.now();
  }
  return expiresMs <= Date.now();
}

/** Self-host (`FOLIYO_MODE=single`, default for OSS core) unlocks all Pro features — no paywall.
 *  Hosted cloud sets `FOLIYO_MODE=multi` and enforces Free/Pro from `users.plan` + expiry. */
export function effectivePlan(
  storedPlan: string | null | undefined,
  config?: Pick<Config, "mode">,
  planExpires?: string | null,
): PlanSlug {
  if (config?.mode === "single") return "selfhost";
  if (isPlanExpired(storedPlan, planExpires)) return "free";
  return normalizePlan(storedPlan);
}

/** Persist free when monthly Pro has lapsed so exports/admin see truthful plan. */
export function reconcileExpiredPlan(
  db: FoliyoDb,
  userId: string,
  storedPlan: string | null | undefined,
  planExpires: string | null | undefined,
): void {
  if (!isPlanExpired(storedPlan, planExpires)) return;
  const raw = storedPlan ?? "pro";
  if (normalizePlan(raw) === "free") return;
  run(
    db,
    `UPDATE users SET plan = 'free', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND plan = ?`,
    [userId, raw],
  );
}

export function getUserPlan(db: FoliyoDb, userId: string): PlanSlug {
  const user = queryOne<{ plan: string; plan_expires: string | null }>(
    db,
    "SELECT plan, plan_expires FROM users WHERE id = ?",
    [userId],
  );
  if (isPlanExpired(user?.plan, user?.plan_expires)) {
    reconcileExpiredPlan(db, userId, user?.plan, user?.plan_expires);
    return "free";
  }
  return normalizePlan(user?.plan);
}

export function getEffectiveUserPlan(
  db: FoliyoDb,
  userId: string,
  config?: Pick<Config, "mode">,
): PlanSlug {
  const user = queryOne<{ plan: string; plan_expires: string | null }>(
    db,
    "SELECT plan, plan_expires FROM users WHERE id = ?",
    [userId],
  );
  const plan = effectivePlan(user?.plan, config, user?.plan_expires);
  if (plan === "free" && isPlanExpired(user?.plan, user?.plan_expires)) {
    reconcileExpiredPlan(db, userId, user?.plan, user?.plan_expires);
  }
  return plan;
}

export function entitlementsFor(plan: string | null | undefined): PlanEntitlements {
  const paid = isProPlan(plan);
  return {
    portfolios_unlimited: paid,
    pdf_export: paid,
    remove_branding: paid,
    ai_resume_import: paid,
    portfolio_limit: paid ? null : FREE_PORTFOLIO_LIMIT,
  };
}

export function upgradePayload(feature: string, message: string): UpgradePayload {
  return {
    error: "upgrade_required",
    message,
    upgrade: true,
    feature,
    pricing: PRICING,
    entitlements_unlocked: entitlementsFor("pro"),
  };
}

export function showFoliyoBranding(plan: string | null | undefined): boolean {
  return !entitlementsFor(plan).remove_branding;
}
