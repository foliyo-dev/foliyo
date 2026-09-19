import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { Config } from "../config.js";
import { closeDatabase, openDatabase, queryOne, run, type FoliyoDb } from "../db.js";
import { runMigrations } from "../migrate.js";
import { applyImportDraft } from "./apply-draft.js";

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
  };
}

describe("applyImportDraft ontology resolve", () => {
  let dir: string;
  let db: FoliyoDb;
  const userId = "u-import";
  const globalId = "g-k8s";

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "foliyo-import-ont-"));
    db = await openDatabase(testConfig(dir));
    await runMigrations(db);
    await run(db, `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`, [
      userId,
      "import@example.com",
      "x",
    ]);
    await run(
      db,
      `INSERT INTO global_skills (id, canonical_name, normalized_key, category)
       VALUES (?, 'Kubernetes', 'kubernetes', 'tool')`,
      [globalId],
    );
    await run(
      db,
      `INSERT INTO skill_aliases (id, skill_id, alias, source) VALUES (?, ?, 'k8s', 'seed')`,
      ["a-k8s", globalId],
    );
    await run(
      db,
      `INSERT INTO skill_aliases (id, skill_id, alias, source) VALUES (?, ?, 'kubernetes', 'seed')`,
      ["a-k8s-self", globalId],
    );
  });

  after(async () => {
    await closeDatabase(db);
    rmSync(dir, { recursive: true, force: true });
  });

  it("links alias-resolved skills and logs resume_import", async () => {
    const result = await applyImportDraft(db, userId, {
      candidate: {
        name: "",
        headline: "",
        bio: "",
        email: "",
        location: "",
        links: {},
      },
      skills: [
        { name: "K8s", level: "advanced", category: "tool" },
        { name: "Obscure Flux Widget", level: null, category: null },
      ],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      languages: [],
    });

    assert.equal(result.saved.skills, 2);
    assert.equal(result.failed.length, 0);

    const k8s = await queryOne<{ id: string; canonical_skill_id: string | null }>(
      db,
      `SELECT id, canonical_skill_id FROM skills
       WHERE user_id = ? AND lower(name) = 'k8s' AND deleted_at IS NULL`,
      [userId],
    );
    assert.ok(k8s);
    assert.equal(k8s!.canonical_skill_id, globalId);

    const aliasLog = await queryOne<{ match_type: string; source: string }>(
      db,
      `SELECT match_type, source FROM match_log
       WHERE raw_term = 'K8s' AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    assert.equal(aliasLog?.match_type, "alias");
    assert.equal(aliasLog?.source, "resume_import");

    const obscure = await queryOne<{ canonical_skill_id: string | null }>(
      db,
      `SELECT canonical_skill_id FROM skills
       WHERE user_id = ? AND lower(name) = lower('Obscure Flux Widget')`,
      [userId],
    );
    assert.equal(obscure?.canonical_skill_id ?? null, null);

    const unresolved = await queryOne<{ status: string }>(
      db,
      `SELECT status FROM skill_review_queue WHERE normalized_key = ?`,
      ["obscure flux widget"],
    );
    assert.equal(unresolved?.status, "pending");
  });
});
