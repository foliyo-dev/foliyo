import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { clearUserContent } from "./account/clear-content.js";
import type { Config } from "./config.js";
import { closeDatabase, openDatabase, queryAll, queryOne, run, type FoliyoDb } from "./db.js";
import {
  backfillMediaAssets,
  deleteMediaAsset,
  insertMediaAsset,
  listMediaAssets,
} from "./media.js";
import { runMigrations } from "./migrate.js";

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

describe("media_assets", () => {
  let dir: string;
  let db: FoliyoDb;
  const userId = "u-media";

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "foliyo-media-"));
    db = await openDatabase(testConfig(dir));
    await runMigrations(db);
    await run(
      db,
      `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`,
      [userId, "media@example.com", "x"],
    );
  });

  after(async () => {
    await closeDatabase(db);
    rmSync(dir, { recursive: true, force: true });
  });

  it("inserts uploads and ignores duplicate urls", async () => {
    const url = "/uploads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg";
    await insertMediaAsset(db, userId, url);
    await insertMediaAsset(db, userId, url);
    const rows = await queryAll<{ url: string }>(
      db,
      `SELECT url FROM media_assets WHERE user_id = ?`,
      [userId],
    );
    assert.equal(rows.filter((r) => r.url === url).length, 1);
  });

  it("backfills from projects, blog covers, and theme_config", async () => {
    const projectUrl = "/uploads/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png";
    const coverUrl = "/uploads/cccccccccccccccccccccccccccccccc.webp";
    const heroUrl = "/uploads/dddddddddddddddddddddddddddddddd.jpg";
    const aboutUrl = "/uploads/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png";
    const logoUrl = "/uploads/ffffffffffffffffffffffffffffffff.webp";

    await run(
      db,
      `INSERT INTO projects (id, user_id, title, image_url) VALUES (?, ?, 'P', ?)`,
      ["p1", userId, projectUrl],
    );
    await run(
      db,
      `INSERT INTO blog_posts (id, user_id, title, slug, cover_image) VALUES (?, ?, 'B', 'b', ?)`,
      ["bp1", userId, coverUrl],
    );
    await run(
      db,
      `INSERT INTO portfolios (id, user_id, name, slug, theme_config) VALUES (?, ?, 'Folio', 'folio', ?)`,
      [
        "pf1",
        userId,
        JSON.stringify({
          content: {
            hero: { image_url: heroUrl },
            about: { image_url: aboutUrl },
            brand: { logo_url: logoUrl },
          },
        }),
      ],
    );

    await backfillMediaAssets(db, userId);

    const urls = (
      await queryAll<{ url: string }>(
        db,
        `SELECT url FROM media_assets WHERE user_id = ?`,
        [userId],
      )
    ).map((r) => r.url);

    for (const u of [projectUrl, coverUrl, heroUrl, aboutUrl, logoUrl]) {
      assert.ok(urls.includes(u), `missing ${u}`);
    }
  });

  it("listMediaAssets returns newest first and clear-content deletes rows", async () => {
    const items = await listMediaAssets(db, userId);
    assert.ok(items.length >= 1);
    assert.ok(items.every((i) => i.id && i.url && i.created_at));

    for (let i = 1; i < items.length; i++) {
      assert.ok(items[i - 1]!.created_at >= items[i]!.created_at);
    }

    const cleared = await clearUserContent(db, userId, { resetProfile: false });
    assert.ok(cleared.media_assets >= 1);
    const remaining = await queryOne<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM media_assets WHERE user_id = ?`,
      [userId],
    );
    assert.equal(Number(remaining?.n ?? -1), 0);
  });

  it("deleteMediaAsset clears project refs and removes the row", async () => {
    const url = "/uploads/11111111111111111111111111111111.jpg";
    await insertMediaAsset(db, userId, url);
    await run(
      db,
      `INSERT INTO projects (id, user_id, title, description, image_url) VALUES (?,?,?,?,?)`,
      ["proj-del", userId, "Has image", "", url],
    );
    const listed = await listMediaAssets(db, userId);
    const asset = listed.find((i) => i.url === url);
    assert.ok(asset);

    const ok = await deleteMediaAsset(db, testConfig(dir), userId, asset!.id);
    assert.equal(ok, true);
    const project = await queryOne<{ image_url: string }>(
      db,
      `SELECT image_url FROM projects WHERE id = ?`,
      ["proj-del"],
    );
    assert.equal(project?.image_url, "");
    const gone = await queryOne(
      db,
      `SELECT id FROM media_assets WHERE id = ?`,
      [asset!.id],
    );
    assert.ok(!gone);
  });
});
