import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { approvedFromChanges } from "./analyze.js";
import type { JobAnalysis } from "./types.js";

function analysis(over: Partial<JobAnalysis> = {}): JobAnalysis {
  return {
    job: {
      title: "Eng",
      company: "Acme",
      location: null,
      rawText: "x",
      requirements: [],
      parse: "heuristic",
    },
    verdict: { fit: "strong", resume: "underplays", sentence: "Strong fit — 8 of 10 required skills are in your library; resume “r1” only includes 5 of them" },
    coverage: { required_total: 2, required_in_library: 2, required_on_resume: 1 },
    matches: [
      {
        requirement: { type: "skill", name: "Go", importance: "required", normalized: "go" },
        band: "strong",
        skill_id: "s-go",
        skill_name: "Go",
        recency: "current",
        evidence: [],
        explanation: "ok",
      },
      {
        requirement: { type: "skill", name: "Terraform", importance: "required", normalized: "terraform" },
        band: "missing",
        skill_id: null,
        skill_name: null,
        recency: null,
        evidence: [],
        explanation: "No evidence",
      },
    ],
    proposed_changes: [
      {
        id: "add_skill:s-k8s",
        action: "add_skill",
        label: "Kubernetes",
        detail: "Add",
        entity_id: "s-k8s",
        entity_type: "skill",
        default_accepted: true,
      },
    ],
    keep: { skill_ids: ["s-go"], project_ids: [], experience_ids: [] },
    baseline: { kind: "resume", id: "r1" },
    ...over,
  };
}

describe("approvedFromChanges", () => {
  it("never includes missing JD skills", () => {
    const a = analysis();
    a.matches.push({
      requirement: { type: "skill", name: "Kubernetes", importance: "required", normalized: "kubernetes" },
      band: "strong",
      skill_id: "s-k8s",
      skill_name: "Kubernetes",
      recency: "current",
      evidence: [],
      explanation: "ok",
    });
    const out = approvedFromChanges(a, ["add_skill:s-k8s"]);
    assert.ok(out.skill_ids.includes("s-go"));
    assert.ok(out.skill_ids.includes("s-k8s"));
    assert.ok(!out.skill_ids.includes("terraform"));
  });

  it("omits rejected adds", () => {
    const a = analysis();
    a.matches[0]!.skill_id = "s-k8s";
    a.matches[0]!.requirement.normalized = "kubernetes";
    a.keep.skill_ids = [];
    const out = approvedFromChanges(a, []);
    assert.deepEqual(out.skill_ids, []);
  });

  it("leaves unmatched resume skills off by default, keeps them when leave-off is rejected", () => {
    const a = analysis({
      proposed_changes: [
        {
          id: "deemphasize_skill:s-reviews",
          action: "deemphasize_skill",
          label: "Code reviews",
          detail: "On this version, but not in the JD.",
          entity_id: "s-reviews",
          entity_type: "skill",
          default_accepted: true,
        },
      ],
    });
    const leftOff = approvedFromChanges(a, ["deemphasize_skill:s-reviews"]);
    assert.ok(!leftOff.skill_ids.includes("s-reviews"));
    const kept = approvedFromChanges(a, []);
    assert.ok(kept.skill_ids.includes("s-reviews"));
    assert.ok(kept.skill_ids.includes("s-go"));
  });
});
