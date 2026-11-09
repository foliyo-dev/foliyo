import type { Config } from "../config.js";
import { createLocalStorage } from "./local.js";
import { createS3Storage } from "./s3.js";
import type { StorageDriver } from "./types.js";

export type { StorageDriver, StorageObject, S3StorageConfig } from "./types.js";
export { createLocalStorage } from "./local.js";
export { createS3Storage } from "./s3.js";

/** Public URL contract — never rewrite these when switching storage backends. */
export function publicUploadUrl(key: string): string {
  return `/uploads/${key}`;
}

/** Accept only the basename form we store in DB (`{32hex}.{ext}`). */
export function parseUploadKey(file: string): string | null {
  const base = file.split("/").pop() ?? file;
  const match = base.match(/^([a-f0-9]{32})\.(jpg|jpeg|png|webp)$/i);
  if (!match) return null;
  const id = match[1]!.toLowerCase();
  const ext = match[2]!.toLowerCase() === "jpeg" ? "jpg" : match[2]!.toLowerCase();
  return `${id}.${ext}`;
}

let cached: { fingerprint: string; driver: StorageDriver } | null = null;

function fingerprint(config: Config): string {
  return [
    config.storageDriver,
    config.dataDir,
    config.s3Bucket,
    config.s3Region,
    config.s3Endpoint,
    config.s3Prefix,
    config.s3ForcePathStyle ? "1" : "0",
  ].join("|");
}

export function createStorage(config: Config): StorageDriver {
  if (config.storageDriver === "s3") {
    return createS3Storage({
      bucket: config.s3Bucket,
      region: config.s3Region,
      endpoint: config.s3Endpoint,
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      prefix: config.s3Prefix,
      forcePathStyle: config.s3ForcePathStyle,
    });
  }
  return createLocalStorage(config.dataDir);
}

/** Process-wide cache so upload + public routes share one S3 client. */
export function getStorage(config: Config): StorageDriver {
  const fp = fingerprint(config);
  if (cached?.fingerprint === fp) return cached.driver;
  const driver = createStorage(config);
  cached = { fingerprint: fp, driver };
  return driver;
}

/** Test helper — drop cached driver between cases. */
export function resetStorageCache(): void {
  cached = null;
}
