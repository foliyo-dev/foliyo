import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { loadConfig } from "./config.js";

const keys = [
  "NODE_ENV",
  "FOLIYO_ENV",
  "FOLIYO_SITE_URL",
  "FOLIYO_INTEGRITY_SECRET",
  "FOLIYO_MASTER_SECRET",
  "FOLIYO_TOKEN_SECRET",
] as const;

const saved = new Map<string, string | undefined>();
for (const k of keys) saved.set(k, process.env[k]);

afterEach(() => {
  for (const k of keys) {
    const v = saved.get(k);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("loadConfig secrets", () => {
  it("allows default secrets on localhost", () => {
    delete process.env.NODE_ENV;
    delete process.env.FOLIYO_ENV;
    process.env.FOLIYO_SITE_URL = "http://localhost:8080";
    delete process.env.FOLIYO_INTEGRITY_SECRET;
    const cfg = loadConfig();
    assert.equal(cfg.dev, true);
    assert.equal(cfg.integritySecret, "dev-integrity-secret");
  });

  it("refuses default secrets when NODE_ENV is production", () => {
    process.env.NODE_ENV = "production";
    process.env.FOLIYO_SITE_URL = "http://localhost:8080";
    delete process.env.FOLIYO_INTEGRITY_SECRET;
    delete process.env.FOLIYO_MASTER_SECRET;
    delete process.env.FOLIYO_TOKEN_SECRET;
    assert.throws(() => loadConfig(), /default secrets/);
  });
});
