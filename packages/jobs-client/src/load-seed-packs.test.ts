import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadSeedPacks, parseCsv } from "./load-seed-packs.js";

describe("parseCsv", () => {
  it("handles commas and quotes", () => {
    const rows = parseCsv('a,b\n"x,y",z\n');
    assert.deepEqual(rows, [
      ["a", "b"],
      ["x,y", "z"],
    ]);
  });
});

describe("loadSeedPacks", () => {
  it("loads wave 1–3 packs from disk", () => {
    const loaded = loadSeedPacks();
    const ids = loaded.packs.map((p) => p.id);
    assert.deepEqual(ids, ["tech_v1", "knowledge_v1", "business_v1"]);
    assert.ok(loaded.globals.some((g) => g.normalized_key === "node.js"));
    assert.ok(loaded.globals.some((g) => g.normalized_key === "product management"));
    assert.ok(loaded.globals.some((g) => g.normalized_key === "seo"));
    assert.ok(loaded.aliases.some((a) => a.alias === "nodejs" && a.normalized_key === "node.js"));
    assert.ok(loaded.aliases.some((a) => a.alias === "k8s" && a.normalized_key === "kubernetes"));
    assert.ok(
      loaded.aliases.some(
        (a) => a.alias === "people management" && a.normalized_key === "people management",
      ),
    );
    assert.ok(
      loaded.aliases.some((a) => a.alias === "search engine optimization" && a.normalized_key === "seo"),
    );
  });
});
