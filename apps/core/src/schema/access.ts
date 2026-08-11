import type { Filter, JoinPlan, QueryContext } from "meshql-core";
import type { AccessOptions } from "meshql-access";
import { queryOne, type FoliyoDb } from "../db.js";

/** Entities owned by a user (row scoped by user_id). */
export const USER_OWNED_ENTITIES = new Set([
  "profile",
  "skill",
  "project",
  "experience",
  "education",
  "certification",
  "language",
  "social_link",
  "portfolio",
  "resume",
  "post",
]);

/** Entities anonymous clients may query directly (still row-filtered). */
export const PUBLIC_ROOT_ENTITIES = new Set(["portfolio", "resume", "post"]);

function isAuthed(ctx: QueryContext): boolean {
  return Boolean(ctx.userId);
}

/** meshql-access field / entity / row rules. */
export function createAccessOptions(db: FoliyoDb): AccessOptions {
  return {
    // Strip secrets from anonymous / non-owner responses
    rules: {
      "resume.share_token": (ctx) => isAuthed(ctx),
    },
    entityAccess: {
      profile: (ctx) => isAuthed(ctx),
      skill: (ctx) => isAuthed(ctx),
      project: (ctx) => isAuthed(ctx),
      experience: (ctx) => isAuthed(ctx),
      education: (ctx) => isAuthed(ctx),
      certification: (ctx) => isAuthed(ctx),
      language: (ctx) => isAuthed(ctx),
      social_link: (ctx) => isAuthed(ctx),
      portfolio: () => true,
      resume: () => true,
      post: () => true,
    },
    rowAccess: {
      portfolio: async (ctx, id) => canReadOwnedOrPublic(db, "portfolios", id, ctx.userId),
      resume: async (ctx, id) => canReadOwnedOrPublic(db, "resumes", id, ctx.userId),
      post: async (ctx, id) => canReadPost(db, id, ctx.userId),
      profile: async (ctx, id) => canReadOwned(db, "profile", id, ctx.userId),
      skill: async (ctx, id) => canReadOwned(db, "skills", id, ctx.userId),
      project: async (ctx, id) => canReadOwned(db, "projects", id, ctx.userId),
      experience: async (ctx, id) => canReadOwned(db, "experience", id, ctx.userId),
      education: async (ctx, id) => canReadOwned(db, "education", id, ctx.userId),
      certification: async (ctx, id) => canReadOwned(db, "certifications", id, ctx.userId),
      language: async (ctx, id) => canReadOwned(db, "languages", id, ctx.userId),
      social_link: async (ctx, id) => canReadOwned(db, "social_links", id, ctx.userId),
    },
  };
}

/**
 * Inject SQL list filters so list queries cannot dump the whole table.
 * (meshql-access rowAccess only runs for point reads with entityId.)
 */
export function applyRowFilters(plan: JoinPlan): JoinPlan {
  const userId = plan.context.userId;
  const entity = plan.rootEntity;

  // Point reads are gated by rowAccess; no list filters needed.
  if (plan.context.entityId) return plan;

  const filters: Filter[] = [...(plan.list?.filter ?? [])];

  if (userId) {
    if (USER_OWNED_ENTITIES.has(entity)) {
      pushFilter(filters, { field: "user_id", op: "eq", value: userId });
    }
  } else if (entity === "portfolio" || entity === "resume") {
    pushFilter(filters, { field: "is_public", op: "eq", value: 1 });
  } else if (entity === "post") {
    pushFilter(filters, { field: "status", op: "eq", value: "published" });
  } else if (!PUBLIC_ROOT_ENTITIES.has(entity)) {
    // Should already be blocked by entityAccess; belt-and-suspenders empty result.
    pushFilter(filters, { field: "id", op: "eq", value: "__denied__" });
  }

  return {
    ...plan,
    list: {
      ...(plan.list ?? {}),
      filter: filters,
      limit: plan.list?.limit ?? 100,
    },
  };
}

function pushFilter(filters: Filter[], filter: Filter): void {
  const exists = filters.some(
    (f) => f.field === filter.field && f.op === filter.op && f.value === filter.value,
  );
  if (!exists) filters.push(filter);
}

async function canReadOwned(
  db: FoliyoDb,
  table: string,
  id: string,
  userId: string | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const row = await queryOne<{ user_id: string }>(
    db,
    `SELECT user_id FROM ${table} WHERE id = ?`,
    [id],
  );
  return row?.user_id === userId;
}

async function canReadOwnedOrPublic(
  db: FoliyoDb,
  table: "portfolios" | "resumes",
  id: string,
  userId: string | undefined,
): Promise<boolean> {
  const row = await queryOne<{ user_id: string; is_public: number }>(
    db,
    `SELECT user_id, is_public FROM ${table} WHERE id = ?`,
    [id],
  );
  if (!row) return false;
  if (userId && row.user_id === userId) return true;
  return Number(row.is_public) === 1;
}

async function canReadPost(
  db: FoliyoDb,
  id: string,
  userId: string | undefined,
): Promise<boolean> {
  const row = await queryOne<{ user_id: string; status: string }>(
    db,
    "SELECT user_id, status FROM blog_posts WHERE id = ?",
    [id],
  );
  if (!row) return false;
  if (userId && row.user_id === userId) return true;
  return row.status === "published";
}
