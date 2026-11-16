import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { Config } from "../config.js";
import { closeDatabase, openDatabase, run, type FoliyoDb } from "../db.js";
import { runMigrations } from "../migrate.js";
import { computeApprovedSelection, computeTailorSelection } from "./tailor.js";

function testConfig(dir: string): Config {
  return {
    port: 8080,
    host: "127.0.0.1",
    dbDriver: "sqlite",
    dbPath: join(dir, "test.db"),
    dbUrl: "",
    dataDir: dir,
    adminEmail: "admin@example.com",
    adminPassword: "x",
    tokenSecret: "dev-token-secret",
    integritySecret: "dev-integrity-secret",
    masterSecret: "dev-master-secret",
    mode: "single",
    siteUrl: "http://localhost:8080",
    dashboardUrl: "http://localhost:5173",
    corsOrigins: [],
    extensionOrigins: [],
    dev: true,
    logLevel: "error",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    fromEmail: "",
    smtpSecure: false,
    smtpIgnoreTls: true,
    oauthEnabled: true,
    oauthRedirectBase: "http://localhost:8080",
    googleClientId: "",
    googleClientSecret: "",
    githubClientId: "",
    githubClientSecret: "",
    openRouterApiKey: "",
    openRouterModel: "google/gemini-2.5-flash",
    aiRewriteMaxTokens: 400,
    storageDriver: "local",
    s3Bucket: "",
    s3Region: "auto",
    s3Endpoint: "",
    s3AccessKeyId: "",
    s3SecretAccessKey: "",
    s3Prefix: "uploads/",
    s3ForcePathStyle: false,
  };
}

describe("tailor selection", () => {
  let dir: string;
  let db: FoliyoDb;
  const userId = "u-tailor";

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "foliyo-tailor-"));
    db = await openDatabase(testConfig(dir));
    await runMigrations(db);

    await run(db, `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`, [
      userId,
      "tailor@example.com",
      "x",
    ]);
    await run(
      db,
      `INSERT INTO skills (id, user_id, name, status, level, category) VALUES (?, ?, ?, 'confirmed', 'expert', 'languages')`,
      ["sk-ts", userId, "TypeScript"],
    );
    await run(
      db,
      `INSERT INTO projects (id, user_id, title, description, skills_developed, sort_order)
       VALUES (?, ?, ?, ?, ?, 0)`,
      ["pr-tagged", userId, "Tagged app", "x", '["typescript"]'],
    );
    await run(
      db,
      `INSERT INTO projects (id, user_id, title, description, skills_developed, sort_order)
       VALUES (?, ?, ?, ?, ?, 1)`,
      ["pr-untagged", userId, "Side thing", "x", "[]"],
    );
    await run(
      db,
      `INSERT INTO experience (id, user_id, company, role, start_date, end_date, description, skills_developed, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      ["ex-1", userId, "Acme", "Engineer", "2020", null, "Built APIs", "[]"],
    );
    await run(
      db,
      `INSERT INTO education (id, user_id, institution, degree, field, start_date, end_date, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      ["ed-1", userId, "State U", "BS", "CS", "2015", "2019"],
    );
    await run(
      db,
      `INSERT INTO certifications (id, user_id, name, issuer, sort_order)
       VALUES (?, ?, ?, ?, 0)`,
      ["cert-1", userId, "AWS SAA", "Amazon"],
    );
    await run(
      db,
      `INSERT INTO languages (id, user_id, name, proficiency, sort_order)
       VALUES (?, ?, ?, ?, 0)`,
      ["lang-1", userId, "English", "fluent"],
    );
  });

  after(async () => {
    await closeDatabase(db);
    rmSync(dir, { recursive: true, force: true });
  });

  it("auto-tailor attaches untagged experience and credentials, tag-gates projects", async () => {
    const content = await computeTailorSelection(db, userId, ["sk-ts"], true);
    assert.deepEqual(content.skill_ids, ["sk-ts"]);
    assert.deepEqual(content.project_ids, ["pr-tagged"]);
    assert.deepEqual(content.experience_ids, ["ex-1"]);
    assert.deepEqual(content.education_ids, ["ed-1"]);
    assert.deepEqual(content.certification_ids, ["cert-1"]);
    assert.deepEqual(content.language_ids, ["lang-1"]);
  });

  it("approved selection ignores empty experience_ids and still attaches library experience", async () => {
    const content = await computeApprovedSelection(db, userId, {
      skill_ids: ["sk-ts"],
      project_ids: ["pr-tagged"],
      experience_ids: [],
    });
    assert.deepEqual(content.skill_ids, ["sk-ts"]);
    assert.deepEqual(content.project_ids, ["pr-tagged"]);
    assert.deepEqual(content.experience_ids, ["ex-1"]);
    assert.deepEqual(content.education_ids, ["ed-1"]);
    assert.deepEqual(content.certification_ids, ["cert-1"]);
    assert.deepEqual(content.language_ids, ["lang-1"]);
  });
});
