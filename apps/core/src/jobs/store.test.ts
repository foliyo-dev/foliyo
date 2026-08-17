import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashJdText, normalizeJdText, parseAcceptedJson, parseAnalysisJson } from "./store.js";
import type { JobAnalysis } from "./types.js";

describe("job analysis store helpers", () => {
  it("normalizes JD text the same way clients hash", () => {
    assert.equal(normalizeJdText("  Senior  Backend\n\nEngineer  "), "senior backend engineer");
  });

  it("hashes the same as Web Crypto SHA-256 of normalized text", async () => {
    const a = hashJdText("Go, K8s\n");
    const b = hashJdText("  go, k8s  ");
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
    const data = new TextEncoder().encode(normalizeJdText("Go, K8s\n"));
    const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
    const web = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
    assert.equal(a, web);
  });

  it("parses accepted ids and rejects junk", () => {
    assert.deepEqual(parseAcceptedJson('["add_skill:s1","deemphasize_skill:s2"]'), [
      "add_skill:s1",
      "deemphasize_skill:s2",
    ]);
    assert.equal(parseAcceptedJson(null), null);
    assert.equal(parseAcceptedJson("{"), null);
    assert.equal(parseAcceptedJson('"nope"'), null);
  });

  it("parses a stored analysis snapshot", () => {
    const analysis: JobAnalysis = {
      job: {
        title: "Eng",
        company: "Acme",
        location: null,
        rawText: "need Go",
        requirements: [],
        parse: "heuristic",
      },
      verdict: { fit: "partial", resume: "no_resume", sentence: "Partial fit" },
      coverage: { required_total: 1, required_in_library: 1, required_on_resume: 0 },
      matches: [],
      proposed_changes: [],
      keep: { skill_ids: [], project_ids: [], experience_ids: [] },
      baseline: { kind: "none", id: null },
    };
    const parsed = parseAnalysisJson(JSON.stringify(analysis));
    assert.equal(parsed?.verdict.fit, "partial");
    assert.equal(parseAnalysisJson("{}"), null);
    assert.equal(parseAnalysisJson("[]"), null);
  });
});
