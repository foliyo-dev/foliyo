import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displaySkillName, normalizeSkillKey } from "./aliases.js";

describe("normalizeSkillKey", () => {
  it("collapses aliases to a canonical key", () => {
    assert.equal(normalizeSkillKey("K8s"), "kubernetes");
    assert.equal(normalizeSkillKey("Kubernetes Engine"), "kubernetes");
    assert.equal(normalizeSkillKey("nodejs"), "node.js");
    assert.equal(normalizeSkillKey("Node.js"), "node.js");
    assert.equal(normalizeSkillKey("postgres"), "postgresql");
    assert.equal(normalizeSkillKey("golang"), "go");
  });

  it("does not treat related tech as the same skill", () => {
    assert.equal(normalizeSkillKey("Docker"), "docker");
    assert.equal(normalizeSkillKey("Kubernetes"), "kubernetes");
    assert.notEqual(normalizeSkillKey("Docker"), normalizeSkillKey("Kubernetes"));
  });

  it("pretty-prints catalog names", () => {
    assert.equal(displaySkillName("k8s"), "Kubernetes");
    assert.equal(displaySkillName("node.js"), "Node.js");
  });
});
