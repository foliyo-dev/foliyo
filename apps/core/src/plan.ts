import type { FoliyoDb } from "./db.js";
import { queryOne } from "./db.js";
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

/** Self-host (`FOLIYO_MODE=single`, default for OSS core) unlocks all Pro features — no paywall.
 *  Hosted cloud sets `FOLIYO_MODE=multi` and enforces Free/Pro from `users.plan`. */
export function effectivePlan(
  storedPlan: string | null | undefined,
  config?: Pick<Config, "mode">,
): PlanSlug {
  if (config?.mode === "single") return "selfhost";
  return normalizePlan(storedPlan);
}

export function getUserPlan(db: FoliyoDb, userId: string): PlanSlug {
  const user = queryOne<{ plan: string }>(db, "SELECT plan FROM users WHERE id = ?", [userId]);
  return normalizePlan(user?.plan);
}

export function getEffectiveUserPlan(
  db: FoliyoDb,
  userId: string,
  config?: Pick<Config, "mode">,
): PlanSlug {
  const user = queryOne<{ plan: string }>(db, "SELECT plan FROM users WHERE id = ?", [userId]);
  return effectivePlan(user?.plan, config);
}

export function entitlementsFor(plan: string | null | undefined): PlanEntitlements {
  const paid = isProPlan(plan);
  return {
    portfolios_unlimited: paid,
    pdf_export: paid,
    remove_branding: paid,
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
