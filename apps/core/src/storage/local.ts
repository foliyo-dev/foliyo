import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StorageDriver, StorageObject } from "./types.js";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export function createLocalStorage(dataDir: string): StorageDriver {
  const dir = join(dataDir, "uploads");

  function ensureDir() {
    mkdirSync(dir, { recursive: true });
  }

  return {
    kind: "local",
    async put(key, bytes, _contentType) {
      ensureDir();
      writeFileSync(join(dir, key), bytes);
    },
    async get(key): Promise<StorageObject | null> {
      const abs = join(dir, key);
      if (!existsSync(abs)) return null;
      return { bytes: readFileSync(abs), contentType: contentTypeForKey(key) };
    },
    async delete(key) {
      const abs = join(dir, key);
      if (existsSync(abs)) unlinkSync(abs);
    },
    async exists(key) {
      return existsSync(join(dir, key));
    },
    async listKeys() {
      if (!existsSync(dir)) return [];
      return readdirSync(dir).filter((name) => /^[a-f0-9]{32}\.(jpe?g|png|webp)$/i.test(name));
    },
  };
}
