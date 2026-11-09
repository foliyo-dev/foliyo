import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalStorage } from "./local.js";
import { parseUploadKey, publicUploadUrl } from "./index.js";

describe("local storage", () => {
  it("puts, gets, lists, and deletes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "foliyo-storage-"));
    try {
      const store = createLocalStorage(dir);
      const key = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp";
      const bytes = Buffer.from("fake-webp");
      await store.put(key, bytes, "image/webp");
      assert.equal(await store.exists(key), true);
      const obj = await store.get(key);
      assert.ok(obj);
      assert.equal(obj!.contentType, "image/webp");
      assert.deepEqual(obj!.bytes, bytes);
      assert.deepEqual(await store.listKeys(), [key]);
      await store.delete(key);
      assert.equal(await store.exists(key), false);
      assert.equal(await store.get(key), null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("upload URL helpers", () => {
  it("keeps stable public URLs", () => {
    assert.equal(publicUploadUrl("ab".repeat(16) + ".jpg"), `/uploads/${"ab".repeat(16)}.jpg`);
  });

  it("parses and normalizes keys", () => {
    assert.equal(parseUploadKey("ABCDEF0123456789ABCDEF0123456789.JPEG"), "abcdef0123456789abcdef0123456789.jpg");
    assert.equal(parseUploadKey("../evil.png"), null);
    assert.equal(parseUploadKey("not-hex.jpg"), null);
  });
});
