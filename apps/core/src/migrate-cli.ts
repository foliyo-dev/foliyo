import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { runMigrations } from "./migrate.js";
import { seedAdmin } from "./seed.js";

const config = loadConfig();
const db = openDatabase(config);
runMigrations(db);
seedAdmin(db, config);
console.log("Migrations complete");
