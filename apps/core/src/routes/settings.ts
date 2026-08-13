import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import { queryOne, run, type FoliyoDb } from "../db.js";
import type { Config } from "../config.js";
import { clearUserContent } from "../account/clear-content.js";

const settingsSchema = z.object({
  site_title: z.string().optional(),
  site_description: z.string().optional(),
  theme_slug: z.string().optional(),
  resume_theme: z.string().optional(),
  custom_domain: z.string().optional(),
  seo_keywords: z.string().optional(),
});

const clearSchema = z.object({
  confirm: z.literal("CLEAR"),
});

export function settingsRoutes(db: FoliyoDb) {
  const r = new Hono<AppEnv>();

  r.get("/", async (c) => {
    const userId = c.get("userId");
    const settings = await queryOne(db, "SELECT * FROM settings WHERE user_id = ?", [userId]);
    if (!settings) return c.json({ error: "not found" }, 404);
    return c.json(settings);
  });

  r.put("/", async (c) => {
    const userId = c.get("userId");
    const body = settingsSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid body" }, 400);
    const d = body.data;
    const existing = await queryOne(db, "SELECT id FROM settings WHERE user_id = ?", [userId]);
    if (existing) {
      await run(
        db,
        `UPDATE settings SET site_title=?, site_description=?, theme_slug=?, resume_theme=?,
         custom_domain=?, seo_keywords=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
        [
          d.site_title ?? "My Portfolio", d.site_description ?? "", d.theme_slug ?? "minimal",
          d.resume_theme ?? "classic", d.custom_domain ?? "", d.seo_keywords ?? "", userId,
        ],
      );
    } else {
      await run(
        db,
        `INSERT INTO settings (user_id, site_title, site_description, theme_slug, resume_theme, custom_domain, seo_keywords)
         VALUES (?,?,?,?,?,?,?)`,
        [
          userId, d.site_title ?? "My Portfolio", d.site_description ?? "",
          d.theme_slug ?? "minimal", d.resume_theme ?? "classic",
          d.custom_domain ?? "", d.seo_keywords ?? "",
        ],
      );
    }
    const settings = await queryOne(db, "SELECT * FROM settings WHERE user_id = ?", [userId]);
    return c.json(settings);
  });

  /**
   * Clear all portfolio/library content. Keeps login email, password, plan, email_verified, profile.
   */
  r.post("/clear-content", async (c) => {
    const userId = c.get("userId");
    const body = clearSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return c.json(
        { error: "confirm_required", message: 'Type CLEAR and send { "confirm": "CLEAR" }.' },
        400,
      );
    }
    const deleted = await clearUserContent(db, userId);
    return c.json({ ok: true, deleted });
  });

  return r;
}

const PROJECT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

function sniffImageExt(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length < 12) return null;
  // JPEG SOI is FF D8; the next marker almost always starts with FF.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

function isBlobLike(file: unknown): file is { arrayBuffer: () => Promise<ArrayBuffer> } {
  return (
    typeof file === "object" &&
    file !== null &&
    typeof (file as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}

export function uploadRoutes(_db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();
  r.post("/avatar", (c) => c.json({ error: "upload not implemented yet" }, 501));
  r.post("/project-image", async (c) => {
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "file_required", message: "Send the image as multipart field \"file\"." }, 400);
    }
    const body = await c.req.parseBody();
    const file = body.file;
    if (!isBlobLike(file)) {
      return c.json({ error: "file_required", message: "Send the image as multipart field \"file\"." }, 400);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength === 0) {
      return c.json({ error: "file_required", message: "Empty file." }, 400);
    }
    if (buf.byteLength > PROJECT_IMAGE_MAX_BYTES) {
      return c.json({ error: "too_large", message: "Image must be under 3 MB." }, 400);
    }
    const ext = sniffImageExt(buf);
    if (!ext) {
      return c.json({ error: "unsupported_type", message: "Use JPEG, PNG, or WebP." }, 400);
    }
    const name = `${randomBytes(16).toString("hex")}.${ext}`;
    const dir = join(config.dataDir, "uploads");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), buf);
    return c.json({ url: `/uploads/${name}` });
  });
  return r;
}
