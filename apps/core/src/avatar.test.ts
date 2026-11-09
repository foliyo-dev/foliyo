import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gravatarUrl, resolveAvatarUrl } from "./avatar.js";

describe("resolveAvatarUrl", () => {
  it("prefers an explicit avatar URL", () => {
    assert.equal(
      resolveAvatarUrl("https://cdn.example/me.png", "me@example.com"),
      "https://cdn.example/me.png",
    );
  });

  it("falls back to Gravatar when avatar is empty", () => {
    const url = resolveAvatarUrl("", "Ada@Example.COM");
    assert.match(url, /^https:\/\/www\.gravatar\.com\/avatar\/[a-f0-9]{32}\?s=200&d=identicon$/);
    assert.equal(url, gravatarUrl("ada@example.com"));
  });

  it("returns empty when both are missing", () => {
    assert.equal(resolveAvatarUrl("", ""), "");
    assert.equal(resolveAvatarUrl(null, null), "");
  });
});
