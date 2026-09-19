import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  atsLabelFromJd,
  displaySkillName,
  matchSkillsFromJd,
  normalizeSkillKey,
  resolveCanonicalKey,
} from "./aliases.js";
import { catalogFromSeedPacks } from "@foliyo/jobs-client/seed";

const catalog = catalogFromSeedPacks();

describe("normalizeSkillKey", () => {
  it("string-normalizes only (no alias collapse)", () => {
    assert.equal(normalizeSkillKey("NodeJS"), "nodejs");
    assert.equal(normalizeSkillKey("Node.js"), "node.js");
    assert.equal(normalizeSkillKey("  CI/CD  "), "ci/cd");
    assert.equal(normalizeSkillKey("K8s"), "k8s");
  });

  it("does not treat related tech as the same skill", () => {
    assert.equal(normalizeSkillKey("Docker"), "docker");
    assert.equal(normalizeSkillKey("Kubernetes"), "kubernetes");
    assert.notEqual(normalizeSkillKey("Docker"), normalizeSkillKey("Kubernetes"));
  });

  it("pretty-prints when catalog is provided", () => {
    assert.equal(displaySkillName("k8s", catalog), "Kubernetes");
    assert.equal(displaySkillName("node.js", catalog), "Node.js");
  });
});

describe("resolveCanonicalKey (catalog)", () => {
  it("collapses aliases via catalog", () => {
    assert.equal(resolveCanonicalKey("K8s", catalog), "kubernetes");
    assert.equal(resolveCanonicalKey("nodejs", catalog), "node.js");
    assert.equal(resolveCanonicalKey("NodeJS", catalog), "node.js");
    assert.equal(resolveCanonicalKey("postgres", catalog), "postgresql");
    assert.equal(resolveCanonicalKey("golang", catalog), "go");
    assert.equal(
      resolveCanonicalKey("Continuous Integration and Continuous Delivery", catalog),
      "ci/cd",
    );
  });
});

describe("matchSkillsFromJd", () => {
  const skills = [
    { id: "1", name: "Node.js" },
    { id: "2", name: "CI/CD" },
    { id: "3", name: "Docker" },
  ];

  it("matches NodeJS in JD to library Node.js (alnum, no catalog)", () => {
    const ids = matchSkillsFromJd("We need strong NodeJS and APIs.", skills);
    assert.deepEqual(ids, ["1"]);
  });

  it("matches Continuous Integration phrasing to CI/CD with catalog", () => {
    const ids = matchSkillsFromJd(
      "Experience with Continuous Integration and Continuous Delivery required.",
      skills,
      catalog,
    );
    assert.deepEqual(ids, ["2"]);
  });
});

describe("atsLabelFromJd", () => {
  it("returns JD surface form for ATS", () => {
    assert.equal(atsLabelFromJd("Must know NodeJS well.", "Node.js"), "NodeJS");
    assert.equal(
      atsLabelFromJd(
        "Continuous Integration and Continuous Delivery experience.",
        "CI/CD",
        catalog,
      ),
      "Continuous Integration and Continuous Delivery",
    );
  });
});
