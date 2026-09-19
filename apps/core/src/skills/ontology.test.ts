import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { Config } from "../config.js";
import { closeDatabase, openDatabase, queryOne, run, type FoliyoDb } from "../db.js";
import { runJobAnalyze } from "../jobs/analyze.js";
import { runMigrations } from "../migrate.js";
import {
  buildLibrarySkillIndex,
  linkUserSkillCanonical,
  resolveGlobalSkill,
  resolveJdTermAgainstLibrary,
} from "./ontology.js";

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

describe("ontology resolver + JD analyze", () => {
  let dir: string;
  let db: FoliyoDb;
  const userId = "u1";
  const globalId = "g-team";
  const skillId = "s-lead";

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "foliyo-ontology-"));
    db = await openDatabase(testConfig(dir));
    await runMigrations(db);
    await run(
      db,
      `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`,
      [userId, "t@example.com", "x"],
    );
    await run(
      db,
      `INSERT INTO global_skills (id, canonical_name, normalized_key, category)
       VALUES (?, 'Team Leadership', 'team leadership', 'soft')`,
      [globalId],
    );
    await run(
      db,
      `INSERT INTO skill_aliases (id, skill_id, alias, source) VALUES (?, ?, 'people management', 'manual')`,
      ["a1", globalId],
    );
    await run(
      db,
      `INSERT INTO skill_aliases (id, skill_id, alias, source) VALUES (?, ?, 'team leadership', 'manual')`,
      ["a2", globalId],
    );
    await run(
      db,
      `INSERT INTO skills (id, user_id, name, status, recency)
       VALUES (?, ?, 'Team Leadership', 'confirmed', 'current')`,
      [skillId, userId],
    );
  });

  after(async () => {
    await closeDatabase(db);
    rmSync(dir, { recursive: true, force: true });
  });

  it("resolveGlobalSkill hits alias → global", async () => {
    const hit = await resolveGlobalSkill(db, "People Management");
    assert.ok(hit);
    assert.equal(hit!.id, globalId);
    assert.equal(hit!.normalized_key, "team leadership");
  });

  it("library index matches via linked canonical key", async () => {
    await linkUserSkillCanonical(db, skillId, globalId);
    const skills = [
      {
        id: skillId,
        name: "Team Leadership",
        recency: "current" as const,
        canonical_skill_id: globalId,
      },
    ];
    const index = await buildLibrarySkillIndex(db, skills);
    assert.equal(index.get("team leadership")?.id, skillId);
    assert.equal(index.get("people management"), undefined); // alias is on global, not index key

    const resolved = await resolveJdTermAgainstLibrary(db, "people management", index);
    assert.equal(resolved.matchType, "alias");
    assert.equal(resolved.global?.id, globalId);
    assert.equal(resolved.library?.id, skillId);
    assert.equal(resolved.normalized, "team leadership");
  });

  it("runJobAnalyze matches alias JD term to library + logs + lazy-links", async () => {
    // Unlink so analyze can lazy-link.
    await run(db, `UPDATE skills SET canonical_skill_id = NULL WHERE id = ?`, [skillId]);

    const forced = await runJobAnalyze(db, userId, {
      jdText: "Engineering Manager role requiring people management.",
      parser: async () => ({
        ok: true,
        job: {
          title: "EM",
          company: null,
          location: null,
          parse: "llm",
          requirements: [
            {
              type: "skill",
              name: "People Management",
              importance: "required",
              normalized: "people management",
            },
          ],
        },
      }),
    });

    assert.equal(forced.matches.length, 1);
    assert.equal(forced.matches[0]!.skill_id, skillId);
    assert.equal(forced.matches[0]!.band, "weak"); // no evidence
    assert.equal(forced.matches[0]!.match_type, "alias");
    assert.equal(forced.matches[0]!.requirement.normalized, "team leadership");
    assert.equal(forced.coverage.required_in_library, 1);

    const linked = await queryOne<{ canonical_skill_id: string | null }>(
      db,
      `SELECT canonical_skill_id FROM skills WHERE id = ?`,
      [skillId],
    );
    assert.equal(linked?.canonical_skill_id, globalId);

    const log = await queryOne<{ match_type: string; matched_skill_id: string | null }>(
      db,
      `SELECT match_type, matched_skill_id FROM match_log
       WHERE raw_term = 'People Management' ORDER BY created_at DESC LIMIT 1`,
      [],
    );
    assert.equal(log?.match_type, "alias");
    assert.equal(log?.matched_skill_id, globalId);
  });

  it("unresolved JD term is logged and enqueued", async () => {
    const analysis = await runJobAnalyze(db, userId, {
      jdText: "Need Quantum Flux Capacitor experience",
      parser: async () => ({
        ok: true,
        job: {
          title: null,
          company: null,
          location: null,
          parse: "llm",
          requirements: [
            {
              type: "skill",
              name: "Quantum Flux Capacitor",
              importance: "required",
              normalized: "quantum flux capacitor",
            },
          ],
        },
      }),
    });

    assert.equal(analysis.matches[0]!.band, "missing");
    assert.equal(analysis.matches[0]!.match_type, "unresolved");

    const review = await queryOne<{ status: string }>(
      db,
      `SELECT status FROM skill_review_queue WHERE normalized_key = ?`,
      ["quantum flux capacitor"],
    );
    assert.equal(review?.status, "pending");
  });
});
