import { createMesh, type MeshSchema } from "meshql-core";
import { buildSelectSql as buildSelectSqlSqlite } from "meshql-sqlite";
import { buildSelectSql as buildSelectSqlPostgres } from "meshql-postgres";
import { createHttpHandler, toErrorResponse } from "meshql-http";
import { withAccess } from "meshql-access";
import {
  createAuthHandler,
  InMemoryTokenStore,
  issueToken,
  type IntegrityConfig,
} from "meshql-integrity";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import type { Config } from "../config.js";
import { checkPassword } from "../auth/password.js";
import { bearerToken, getTokenUserId } from "../auth/tokens.js";
import { queryAll, queryOne, type FoliyoDb, type SqlValue } from "../db.js";
import { applyRowFilters, createAccessOptions } from "./access.js";
import { foliyoMeshAuthPlugin } from "./auth-plugin.js";
import { foliyoSchema } from "./entities.js";

export type CreateMeshRouterOptions = {
  /** Require signed Mesh queries (disables anonymous / Bearer-only mesh reads). */
  requireSigned?: boolean;
};

export function createMeshRouter(
  db: FoliyoDb,
  config: Config,
  options: CreateMeshRouterOptions = {},
) {
  const schema: MeshSchema = foliyoSchema;
  const buildSelectSql = db.driver === "postgres" ? buildSelectSqlPostgres : buildSelectSqlSqlite;

  const integrity = createIntegrityConfig(db, config);
  const mesh = createMesh(schema);

  // Optional Mesh integrity OR Foliyo Bearer OR anonymous — not mandatory signed-only.
  mesh.use(
    foliyoMeshAuthPlugin({
      db,
      integrity,
      requireSigned: options.requireSigned ?? envFlag("FOLIYO_MESH_REQUIRE_SIGNED"),
    }),
  );
  withAccess(mesh, createAccessOptions(db));

  mesh.resolve("*", async (plan) => {
    const secured = applyRowFilters(plan);
    const { sql, params } = buildSelectSql(secured, schema);
    return queryAll(db, sql, params as SqlValue[]);
  });

  return buildMeshHonoApp(mesh, integrity);
}

function createIntegrityConfig(db: FoliyoDb, config: Config): IntegrityConfig {
  return {
    secret: config.integritySecret,
    tokenTTL: "12h",
    store: new InMemoryTokenStore(),
    authenticate: async (credentials) => authenticateForMesh(db, credentials),
  };
}

async function authenticateForMesh(
  db: FoliyoDb,
  credentials: unknown,
): Promise<{ userId: string; sessionId: string; role?: string }> {
  const body = (credentials ?? {}) as Record<string, unknown>;

  const bearer =
    (typeof body.bearer === "string" && body.bearer) ||
    (typeof body.token === "string" && body.token) ||
    "";
  if (bearer) {
    const userId = await getTokenUserId(db, bearer);
    if (!userId) throw new Error("unauthorized");
    return { userId, sessionId: nanoid(24), role: "user" };
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) throw new Error("unauthorized");

  const user = await queryOne<{ id: string; password: string; mode: string }>(
    db,
    "SELECT id, password, mode FROM users WHERE email = ?",
    [email],
  );
  if (!user || !checkPassword(user.password, password)) throw new Error("unauthorized");
  if (user.mode === "pending_delete") throw new Error("unauthorized");

  return { userId: user.id, sessionId: nanoid(24), role: "user" };
}

function buildMeshHonoApp(
  mesh: ReturnType<typeof createMesh>,
  integrity: IntegrityConfig,
) {
  const basePath = "/mesh";
  const app = new Hono();
  const queryHandler = createHttpHandler(mesh, { basePath });
  const authHandler = createAuthHandler(integrity);

  async function runQuery(
    c: {
      req: {
        method: string;
        raw: { headers: Headers };
        json: () => Promise<unknown>;
        param: (k: string) => string;
      };
      json: (b: unknown, s?: number) => Response;
    },
    params: Record<string, string | undefined>,
  ) {
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });
    let body: unknown;
    if (c.req.method === "POST" || c.req.method === "PUT") {
      try {
        body = await c.req.json();
      } catch {
        body = undefined;
      }
    }
    try {
      const result = await queryHandler({
        method: c.req.method,
        params,
        headers,
        body,
      });
      return c.json(result.body, result.status as 200);
    } catch (error) {
      const mapped = toErrorResponse(error);
      return c.json(mapped.body, mapped.status as 400);
    }
  }

  /** Issue Mesh signing tokens — body: { email, password } | { bearer } | Bearer header. */
  app.post(`${basePath}/auth`, async (c) => {
    let body: Record<string, unknown> = {};
    try {
      const parsed = await c.req.json();
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
    } catch {
      body = {};
    }

    const foliyoTok = bearerToken(c.req.header("Authorization"));
    if (foliyoTok && !body.bearer && !body.email) {
      body = { ...body, bearer: foliyoTok };
    }

    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const result = await authHandler({
      method: "POST",
      body,
      headers,
      path: `${basePath}/auth`,
    });
    return c.json(result.body, result.status as 200);
  });

  app.post(`${basePath}/logout`, async (c) => {
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const result = await authHandler({
      method: "POST",
      headers,
      path: `${basePath}/logout`,
    });
    return c.json(result.body, result.status as 200);
  });

  /** Exchange Foliyo Bearer → Mesh tokens (alias of /auth with bearer). */
  app.post(`${basePath}/exchange`, async (c) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (!token) return c.json({ error: "unauthorized" }, 401);
    try {
      const identity = await integrity.authenticate({ bearer: token });
      return c.json(issueToken(integrity, identity));
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }
  });

  app.get(`${basePath}/:entity/:id`, (c) =>
    runQuery(c, { entity: c.req.param("entity"), id: c.req.param("id") }),
  );
  app.get(`${basePath}/:entity`, (c) => runQuery(c, { entity: c.req.param("entity") }));
  app.post(basePath, (c) => runQuery(c, {}));
  app.put(`${basePath}/:entity/:id`, (c) =>
    runQuery(c, { entity: c.req.param("entity"), id: c.req.param("id") }),
  );

  return app;
}

function envFlag(key: string): boolean {
  const v = process.env[key];
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export { foliyoSchema };
