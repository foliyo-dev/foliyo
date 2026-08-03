import { createMesh, type MeshSchema } from "meshql-core";
import { buildSelectSql } from "meshql-sqlite";
import { meshHonoRoutes } from "meshql-http/hono";
import type { SQLInputValue } from "node:sqlite";
import type { FoliyoDb } from "../db.js";
import { foliyoSchema } from "./entities.js";

export function createMeshRouter(db: FoliyoDb) {
  const schema: MeshSchema = foliyoSchema;
  const mesh = createMesh(schema);

  mesh.resolve("*", async (plan) => {
    const { sql, params } = buildSelectSql(plan, schema);
    return db.prepare(sql).all(...(params as SQLInputValue[]));
  });

  return meshHonoRoutes(mesh, { basePath: "/mesh" });
}

export { foliyoSchema };
