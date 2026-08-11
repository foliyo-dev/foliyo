/**
 * Seed a local ATS partner for Status API testing.
 *
 * Usage:
 *   cd apps/core && npx tsx src/seed-ats-partner.ts
 *
 * Prints the plaintext API key once — store it; only the hash is saved.
 */
import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import { loadConfig } from "./config.js";
import { openDatabase, queryOne, run } from "./db.js";
import { runMigrations } from "./migrate.js";
import { hashAtsApiKey } from "./routes/status-notify.js";

const config = loadConfig();
const db = await openDatabase(config);
await runMigrations(db);

const slug = process.argv[2] || "dev-ats";
const name = process.argv[3] || "Dev ATS";
const existing = await queryOne(db, "SELECT id, slug FROM ats_partners WHERE slug = ?", [slug]);
if (existing) {
  console.log(`Partner "${slug}" already exists. Delete the row to re-seed.`);
  process.exit(0);
}

const apiKey = `fio_ats_${nanoid(32)}`;
const hmacSecret = randomBytes(32).toString("hex");

await run(
  db,
  "INSERT INTO ats_partners (id, slug, name, api_key_hash, hmac_secret, active) VALUES (?,?,?,?,?,1)",
  [nanoid(16), slug, name, hashAtsApiKey(apiKey), hmacSecret],
);

console.log("ATS partner created:");
console.log(`  slug:         ${slug}`);
console.log(`  api_key:      ${apiKey}`);
console.log(`  hmac_secret:  ${hmacSecret}`);
console.log("");
console.log("Example notify:");
console.log(`  BODY='{"resume_token":"TOKEN","event":"application_received","company":"Acme","role":"Eng","timestamp":"${new Date().toISOString()}"}'`);
console.log(`  SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac '${hmacSecret}' | awk '{print $2}')`);
console.log(`  curl -s -X POST http://localhost:8080/v1/status/notify \\`);
console.log(`    -H "Authorization: Bearer ${apiKey}" \\`);
console.log(`    -H "X-Foliyo-Signature: $SIG" \\`);
console.log(`    -H "X-Foliyo-Timestamp: $(date +%s)" \\`);
console.log(`    -H "Content-Type: application/json" \\`);
console.log(`    -d "$BODY"`);
