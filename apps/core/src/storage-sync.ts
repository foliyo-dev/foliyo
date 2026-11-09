/**
 * Copy local dataDir/uploads objects into S3 (cutover helper).
 * Does not touch the DB — public URLs stay `/uploads/{key}`.
 *
 * Usage:
 *   pnpm --filter @foliyo/core storage:sync
 *   pnpm --filter @foliyo/core storage:sync -- --dry-run
 *
 * Requires FOLIYO_S3_* env (bucket + credentials). FOLIYO_STORAGE may still be `local`.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { loadConfig } from "./config.js";
import { createLocalStorage, createS3Storage } from "./storage/index.js";

function loadCoreEnv(): void {
  const candidates = [
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "apps/core/.env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      loadEnvFile(p);
      return;
    }
  }
}

loadCoreEnv();

const dryRun = process.argv.includes("--dry-run");
const config = loadConfig();

if (!config.s3Bucket || !config.s3AccessKeyId || !config.s3SecretAccessKey) {
  console.error(
    "storage:sync requires FOLIYO_S3_BUCKET, FOLIYO_S3_ACCESS_KEY_ID, and FOLIYO_S3_SECRET_ACCESS_KEY.",
  );
  process.exit(1);
}

const local = createLocalStorage(config.dataDir);
const remote = createS3Storage({
  bucket: config.s3Bucket,
  region: config.s3Region,
  endpoint: config.s3Endpoint,
  accessKeyId: config.s3AccessKeyId,
  secretAccessKey: config.s3SecretAccessKey,
  prefix: config.s3Prefix,
  forcePathStyle: config.s3ForcePathStyle,
});

const keys = await local.listKeys();
let uploaded = 0;
let skipped = 0;
let failed = 0;

console.log(
  `Syncing ${keys.length} local upload(s) → s3://${config.s3Bucket}/${config.s3Prefix}${dryRun ? " (dry-run)" : ""}`,
);

for (const key of keys) {
  try {
    if (await remote.exists(key)) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`  would upload ${key}`);
      uploaded += 1;
      continue;
    }
    const obj = await local.get(key);
    if (!obj) {
      failed += 1;
      console.error(`  missing local file: ${key}`);
      continue;
    }
    await remote.put(key, obj.bytes, obj.contentType);
    console.log(`  uploaded ${key}`);
    uploaded += 1;
  } catch (err) {
    failed += 1;
    console.error(`  failed ${key}:`, err instanceof Error ? err.message : err);
  }
}

console.log(`Done. uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
if (failed) process.exit(1);
console.log("Next: set FOLIYO_STORAGE=s3 and restart the core process. Keep local uploads as backup.");
