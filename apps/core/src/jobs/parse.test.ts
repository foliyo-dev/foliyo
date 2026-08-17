import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseJobDocument } from "./parse.js";

const JD = `Senior Backend Engineer
Company: Acme Technologies
Location: Remote

Requirements:
- 5+ years with Go and PostgreSQL
- Experience with AWS and Kubernetes (K8s)
- Microservices in production

Preferred:
- Kafka
- Terraform

Nice to have:
- GraphQL
`;

describe("parseJobDocument", () => {
  it("extracts title, company, and alias-normalized skills", () => {
    const job = parseJobDocument(JD, ["Go", "PostgreSQL"]);
    assert.equal(job.title, "Senior Backend Engineer");
    assert.equal(job.company, "Acme Technologies");
    assert.equal(job.parse, "heuristic");

    const byKey = new Map(job.requirements.map((r) => [r.normalized, r]));
    assert.ok(byKey.has("go"));
    assert.ok(byKey.has("postgresql"));
    assert.ok(byKey.has("kubernetes"));
    assert.equal(byKey.get("kubernetes")?.importance, "required");
    assert.equal(byKey.get("kafka")?.importance, "preferred");
    assert.equal(byKey.get("terraform")?.importance, "preferred");
    assert.equal(byKey.get("graphql")?.importance, "nice_to_have");
  });

  it("does not invent skills that are not in the JD", () => {
    const job = parseJobDocument(JD, ["Fortran"]);
    assert.ok(!job.requirements.some((r) => r.normalized === "fortran"));
  });
});
