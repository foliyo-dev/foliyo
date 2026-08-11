import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { runMigrations } from "./migrate.js";
import { seedAdmin } from "./seed.js";

const config = loadConfig();
const db = await openDatabase(config);
await runMigrations(db);
await seedAdmin(db, config);
console.log("Migrations complete");
