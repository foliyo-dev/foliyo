import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { serve } from "@hono/node-server";
import { loadConfig, isOpenRouterConfigured, openRouterFromConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { runMigrations } from "./migrate.js";
import { seedAdmin } from "./seed.js";
import { seedSkillOntology } from "./skills/seed-ontology.js";
import { ensureHandles } from "./public/pages.js";
import { createFoliyoApp } from "./create-app.js";
import { planRoutes } from "./routes/plan.js";
import { createOpenRouterJobParser } from "./ai/job-parser.js";

/** Load foliyo/.env before reading config — same idea as foliyo-cloud/.env. */
function loadCoreEnv(): string | null {
  const candidates = [
    // pnpm --filter @foliyo/core dev → cwd apps/core
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), ".env"),
    // make / repo root cwd
    resolve(process.cwd(), "apps/core/.env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      loadEnvFile(p);
      return p;
    }
  }
  return null;
}

const envFile = loadCoreEnv();

const config = loadConfig();
const db = await openDatabase(config);
await runMigrations(db);
await seedAdmin(db, config);
const ontologySeed = await seedSkillOntology(db);
if (!ontologySeed.skipped) {
  console.log(
    `Skill ontology seed [${ontologySeed.packs.join(",")}]: +${ontologySeed.globals_created} globals, +${ontologySeed.aliases_created} aliases`,
  );
}
await ensureHandles(db);

const { app } = createFoliyoApp(db, config, {
  jobDocumentParser: isOpenRouterConfigured(config)
    ? createOpenRouterJobParser(openRouterFromConfig(config))
    : undefined,
  extendApi(api) {
    api.route("/plan", planRoutes(db, config));
  },
});

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, () => {
  console.log(`Foliyo running on http://${config.host}:${config.port}`);
  if (envFile) console.log(`  Env:    ${envFile}`);
  console.log(`  DB:     ${config.dbDriver}${config.dbDriver === "postgres" ? ` (${config.dbUrl.replace(/:[^:@/]+@/, ":***@")})` : ` ${config.dbPath}`}`);
  console.log(
    `  AI:     ${isOpenRouterConfigured(config) ? `OpenRouter BYOK (${config.openRouterModel})` : "not configured (set OPENROUTER_API_KEY)"}`,
  );
  console.log(
    `  Storage:${config.storageDriver === "s3" ? ` s3 (${config.s3Bucket})` : " local (dataDir/uploads)"}`,
  );
});
