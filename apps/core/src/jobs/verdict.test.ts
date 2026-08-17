import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVerdict } from "./verdict.js";

describe("buildVerdict", () => {
  it("uses all JD skills, not a folio snapshot", () => {
    const v = buildVerdict(
      { required_total: 10, required_in_library: 8, required_on_resume: 5 },
      true,
      "resume",
    );
    assert.equal(v.fit, "strong");
    assert.equal(v.resume, "underplays");
    assert.equal(v.sentence, "Strong fit — 8 of 10 JD skills are in your library");
  });

  it("counts preferred matches the same as required", () => {
    const v = buildVerdict(
      { required_total: 6, required_in_library: 2, required_on_resume: 0 },
      true,
      "portfolio",
      "master",
    );
    assert.equal(v.fit, "weak");
    assert.equal(v.sentence, "Weak fit — 2 of 6 JD skills are in your library");
    assert.ok(!v.sentence.includes("folio"));
  });

  it("reports when there is no baseline resume", () => {
    const v = buildVerdict(
      { required_total: 4, required_in_library: 1, required_on_resume: 0 },
      false,
      "none",
    );
    assert.equal(v.fit, "weak");
    assert.equal(v.resume, "no_resume");
    assert.equal(v.sentence, "Weak fit — 1 of 4 JD skills are in your library");
  });
});
