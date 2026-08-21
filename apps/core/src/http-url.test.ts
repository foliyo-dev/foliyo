import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { absoluteHttpUrl } from "./http-url.js";

describe("absoluteHttpUrl", () => {
  it("keeps http(s) and upgrades protocol-relative", () => {
    assert.equal(absoluteHttpUrl("https://github.com/foo"), "https://github.com/foo");
    assert.equal(absoluteHttpUrl("//example.com/a"), "https://example.com/a");
    assert.equal(absoluteHttpUrl("github.com/foo"), "https://github.com/foo");
  });

  it("blocks javascript and data hrefs", () => {
    assert.equal(absoluteHttpUrl("javascript:alert(1)"), "");
    assert.equal(absoluteHttpUrl("JAVASCRIPT:alert(1)"), "");
    assert.equal(absoluteHttpUrl("data:text/html,hi"), "");
    assert.equal(absoluteHttpUrl("vbscript:msgbox(1)"), "");
  });

  it("allows mailto and upload paths", () => {
    assert.equal(absoluteHttpUrl("mailto:a@b.com"), "mailto:a@b.com");
    assert.equal(
      absoluteHttpUrl("/uploads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"),
      "/uploads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png",
    );
    assert.equal(absoluteHttpUrl("/etc/passwd"), "");
  });
});
