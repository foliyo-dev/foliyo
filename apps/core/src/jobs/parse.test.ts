import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogFromSeedPacks } from "@foliyo/jobs-client/seed";
import { missingSkillHintsFromJd, parseJobDocument } from "./parse.js";

const catalog = catalogFromSeedPacks();

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
    const job = parseJobDocument(JD, ["Go", "PostgreSQL"], catalog);
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
    const job = parseJobDocument(JD, ["Fortran"], catalog);
    assert.ok(!job.requirements.some((r) => r.normalized === "fortran"));
  });
});

describe("missingSkillHintsFromJd", () => {
  it("returns JD skills not in the library, alias-deduped", () => {
    const hints = missingSkillHintsFromJd(JD, ["Go", "PostgreSQL"], 12, catalog);
    assert.ok(hints.some((h) => /kubernetes/i.test(h)));
    assert.ok(hints.some((h) => /kafka/i.test(h)));
    assert.ok(!hints.some((h) => /^go$/i.test(h)));
    assert.ok(!hints.some((h) => /postgres/i.test(h)));
  });

  it("includes free-form library names only when missing from library", () => {
    const marketingJd = `Marketing Manager
Requirements:
- SEO and Google Analytics
- Content strategy
`;
    const withSeo = missingSkillHintsFromJd(marketingJd, ["SEO"], 12, catalog);
    assert.ok(!withSeo.some((h) => /^seo$/i.test(h)));

    const without = missingSkillHintsFromJd(marketingJd, [], 12, catalog);
    // Wave 3 catalog knows SEO — it surfaces as a missing hint when not in the library.
    assert.ok(without.some((h) => /^seo$/i.test(h)));
  });

  it("respects limit", () => {
    const hints = missingSkillHintsFromJd(JD, [], 2, catalog);
    assert.equal(hints.length, 2);
  });
});
