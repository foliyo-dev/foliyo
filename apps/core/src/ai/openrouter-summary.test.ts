import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { Config } from "../config.js";
import { closeDatabase, openDatabase, run, type FoliyoDb } from "../db.js";
import { runMigrations } from "../migrate.js";
import { buildPortfolioSummaryContext, hasLibraryFacts } from "./openrouter-summary.js";

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

describe("buildPortfolioSummaryContext", () => {
  let dir: string;
  let db: FoliyoDb;
  const userId = "u-portfolio-summary";
  const otherUser = "u-other";

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "foliyo-portfolio-summary-"));
    db = await openDatabase(testConfig(dir));
    await runMigrations(db);

    await run(db, `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`, [
      userId,
      "portfolio@example.com",
      "x",
    ]);
    await run(db, `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`, [
      otherUser,
      "other@example.com",
      "x",
    ]);
    await run(
      db,
      `INSERT INTO profile (user_id, name, headline, bio) VALUES (?, ?, ?, ?)`,
      [userId, "Ada Lovelace", "Engineer", "Builds analytical engines."],
    );

    await run(
      db,
      `INSERT INTO skills (id, user_id, name, status) VALUES (?, ?, ?, ?)`,
      ["sk-keep", userId, "TypeScript", "confirmed"],
    );
    await run(
      db,
      `INSERT INTO skills (id, user_id, name, status) VALUES (?, ?, ?, ?)`,
      ["sk-skip", userId, "Rust", "confirmed"],
    );
    await run(
      db,
      `INSERT INTO skills (id, user_id, name, status, deleted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      ["sk-deleted", userId, "COBOL", "confirmed"],
    );
    await run(
      db,
      `INSERT INTO skills (id, user_id, name, status) VALUES (?, ?, ?, ?)`,
      ["sk-other", otherUser, "Go", "confirmed"],
    );

    await run(
      db,
      `INSERT INTO experience (id, user_id, company, role, start_date, end_date, description, skills_developed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "ex-keep",
        userId,
        "Analytical Engines Ltd",
        "Lead Engineer",
        "2020-01-01",
        null,
        "Shipped compiler tooling.",
        JSON.stringify(["TypeScript"]),
      ],
    );
    await run(
      db,
      `INSERT INTO experience (id, user_id, company, role, start_date, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["ex-skip", userId, "Other Co", "Intern", "2018-01-01", "Not selected."],
    );

    await run(
      db,
      `INSERT INTO projects (id, user_id, title, description, skills_developed)
       VALUES (?, ?, ?, ?, ?)`,
      ["pr-keep", userId, "Difference Engine", "Public math machine.", JSON.stringify(["Math"])],
    );
    await run(
      db,
      `INSERT INTO projects (id, user_id, title, description)
       VALUES (?, ?, ?, ?)`,
      ["pr-skip", userId, "Private Scratch", "Ignore me."],
    );

    await run(
      db,
      `INSERT INTO education (id, user_id, institution, degree, field, start_date, end_date, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "ed-keep",
        userId,
        "University of London",
        "B.A.",
        "Mathematics",
        "1830-01-01",
        "1832-01-01",
        "Foundational studies.",
      ],
    );
    await run(
      db,
      `INSERT INTO education (id, user_id, institution, degree, field, start_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["ed-skip", userId, "Other U", "M.S.", "Physics", "1840-01-01"],
    );
  });

  after(async () => {
    await closeDatabase(db);
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads only selected owned non-deleted rows", async () => {
    const ctx = await buildPortfolioSummaryContext(db, userId, {
      skill_ids: ["sk-keep", "sk-deleted", "sk-other", "sk-missing"],
      experience_ids: ["ex-keep"],
      project_ids: ["pr-keep"],
      education_ids: ["ed-keep"],
    });

    assert.equal(ctx.name, "Ada Lovelace");
    assert.deepEqual(ctx.skills, ["TypeScript"]);
    assert.equal(ctx.experience.length, 1);
    assert.equal(ctx.experience[0]?.company, "Analytical Engines Ltd");
    assert.equal(ctx.experience[0]?.span, "2020-01–present");
    assert.deepEqual(ctx.projects.map((p) => p.title), ["Difference Engine"]);
    assert.equal(ctx.education.length, 1);
    assert.equal(ctx.education[0]?.institution, "University of London");
    assert.equal(ctx.education[0]?.degree, "B.A.");
    assert.ok(hasLibraryFacts(ctx));
  });

  it("returns empty facts when selection is empty or foreign", async () => {
    const empty = await buildPortfolioSummaryContext(db, userId, {});
    assert.equal(hasLibraryFacts(empty), false);

    const foreign = await buildPortfolioSummaryContext(db, userId, {
      skill_ids: ["sk-other", "sk-deleted"],
      project_ids: ["nope"],
    });
    assert.equal(hasLibraryFacts(foreign), false);
  });

  it("caps skill selection at 40", async () => {
    const many = Array.from({ length: 45 }, (_, i) => {
      const id = `sk-cap-${i}`;
      return id;
    });
    for (const id of many) {
      await run(
        db,
        `INSERT INTO skills (id, user_id, name, status) VALUES (?, ?, ?, ?)`,
        [id, userId, `Skill ${id}`, "confirmed"],
      );
    }

    const ctx = await buildPortfolioSummaryContext(db, userId, { skill_ids: many });
    assert.equal(ctx.skills.length, 40);
  });
});
