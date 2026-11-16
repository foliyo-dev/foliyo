import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RESUME_SECTION_ORDER,
  normalizeResumeSectionOrder,
  serializeResumeSectionOrder,
} from "./section-order.js";

test("normalizeResumeSectionOrder returns default for empty or invalid input", () => {
  assert.deepEqual(normalizeResumeSectionOrder(null), DEFAULT_RESUME_SECTION_ORDER);
  assert.deepEqual(normalizeResumeSectionOrder(""), DEFAULT_RESUME_SECTION_ORDER);
  assert.deepEqual(normalizeResumeSectionOrder("not-json"), DEFAULT_RESUME_SECTION_ORDER);
  assert.deepEqual(normalizeResumeSectionOrder({}), DEFAULT_RESUME_SECTION_ORDER);
});

test("normalizeResumeSectionOrder parses JSON strings and fills missing keys", () => {
  assert.deepEqual(normalizeResumeSectionOrder('["experience","skills"]'), [
    "experience",
    "skills",
    "projects",
    "education",
    "certifications",
    "languages",
  ]);
});

test("normalizeResumeSectionOrder drops unknowns and duplicates", () => {
  assert.deepEqual(normalizeResumeSectionOrder(["projects", "bogus", "projects", "skills"]), [
    "projects",
    "skills",
    "experience",
    "education",
    "certifications",
    "languages",
  ]);
});

test("serializeResumeSectionOrder writes a normalized permutation", () => {
  assert.equal(
    serializeResumeSectionOrder(["languages", "skills"]),
    JSON.stringify([
      "languages",
      "skills",
      "projects",
      "experience",
      "education",
      "certifications",
    ]),
  );
});
