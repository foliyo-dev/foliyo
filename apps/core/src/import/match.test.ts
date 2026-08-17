import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  certificationKey,
  educationKey,
  experienceKey,
  languageKey,
  linkIdentities,
  linkMatchesExisting,
  rememberLink,
  projectKey,
  skillKey,
} from "./match.js";

describe("import match keys", () => {
  it("treats skill names as case-insensitive", () => {
    assert.equal(skillKey("TypeScript"), skillKey("typescript"));
  });

  it("distinguishes same role at the same company by start date", () => {
    const a = experienceKey("Acme", "Engineer", "2019-06");
    const b = experienceKey("Acme", "Engineer", "2023-01");
    const same = experienceKey("acme", "engineer", "2019-06-15");
    assert.notEqual(a, b);
    assert.equal(a, same);
  });

  it("matches education on institution + degree", () => {
    assert.equal(
      educationKey("MIT", "BSc"),
      educationKey("mit", "bsc"),
    );
    assert.notEqual(educationKey("MIT", "BSc"), educationKey("MIT", "MSc"));
  });

  it("prefers project URL over title", () => {
    assert.equal(
      projectKey("Foliyo", "https://github.com/foo/foliyo/", null),
      projectKey("Other title", "github.com/foo/foliyo", null),
    );
    assert.equal(projectKey("Foliyo", null, null), projectKey("foliyo", "", ""));
    assert.notEqual(projectKey("Foliyo", null, null), projectKey("Foliyo App", null, null));
  });

  it("matches certs on name + issuer", () => {
    assert.equal(
      certificationKey("AWS SAA", "Amazon"),
      certificationKey("aws saa", "amazon"),
    );
  });

  it("matches languages by name", () => {
    assert.equal(languageKey("Spanish"), languageKey("spanish"));
  });

  it("matches github handle against profile URL", () => {
    const existing = new Set<string>();
    rememberLink(existing, "github", "https://github.com/octocat");
    assert.equal(linkMatchesExisting(existing, "github", "octocat"), true);
    assert.equal(linkMatchesExisting(existing, "github", "https://github.com/octocat/"), true);
    assert.equal(linkMatchesExisting(existing, "github", "someone-else"), false);
    assert.ok(linkIdentities("github", "octocat").length >= 1);
  });
});
