import { serve } from "@hono/node-server";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { runMigrations } from "./migrate.js";
import { seedAdmin } from "./seed.js";
import { ensureHandles } from "./public/pages.js";
import { createFoliyoApp } from "./create-app.js";
import { planRoutes } from "./routes/plan.js";

const config = loadConfig();
const db = openDatabase(config);
runMigrations(db);
seedAdmin(db, config);
ensureHandles(db);

const { app, api } = createFoliyoApp(db, config);
api.route("/plan", planRoutes(db, config));

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, () => {
  console.log(`Foliyo running on http://${config.host}:${config.port}`);
});
