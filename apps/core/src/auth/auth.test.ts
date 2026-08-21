import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeEmail, sqlUtc, sqlUtcPlusHours } from "./datetime.js";
import { hashSecret } from "./secret.js";
import { allowRateLimit, resetRateLimits } from "./rate-limit.js";

describe("sqlUtc", () => {
  it("matches SQLite CURRENT_TIMESTAMP shape", () => {
    const s = sqlUtc(new Date("2026-08-21T11:00:00.000Z"));
    assert.equal(s, "2026-08-21 11:00:00");
    assert.ok(!s.includes("T"));
    assert.ok(!s.includes("Z"));
  });

  it("adds hours without ISO T", () => {
    const s = sqlUtcPlusHours(1, new Date("2026-08-21T11:00:00.000Z"));
    assert.equal(s, "2026-08-21 12:00:00");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizeEmail("  User@X.com "), "user@x.com");
  });
});

describe("hashSecret", () => {
  it("is stable sha256 hex", () => {
    const a = hashSecret("abc");
    const b = hashSecret("abc");
    assert.equal(a, b);
    assert.equal(a.length, 64);
    assert.notEqual(a, "abc");
  });
});

describe("allowRateLimit", () => {
  it("blocks after the limit in the window", () => {
    resetRateLimits();
    const key = "test:ip:1";
    for (let i = 0; i < 3; i++) {
      assert.equal(allowRateLimit(key, 3, 60_000, 1_000).ok, true);
    }
    const blocked = allowRateLimit(key, 3, 60_000, 1_000);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.ok(blocked.retryAfterSec >= 1);
  });
});
