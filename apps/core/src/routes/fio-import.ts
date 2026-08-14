import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import type { FoliyoDb } from "../db.js";
import { parseAndVerifyFio, type FioImportDraft } from "../spec/fio.js";
import { applyImportDraft } from "../import/apply-draft.js";

/**
 * OSS / self-host `.fio` import (no AI).
 * Returns a library draft for the client to review and save.
 * Never writes users.email or email_verified — only draft profile/library fields.
 */
export function fioImportRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();

  r.post("/fio", async (c) => {
    // Auth required via api middleware. Parse only — writes happen on POST /apply.

    const contentType = c.req.header("content-type") ?? "";
    let bytes: Uint8Array | null = null;

    if (contentType.includes("multipart/form-data")) {
      const body = await c.req.parseBody();
      const file = body["file"] ?? body["fio"];
      if (typeof file === "object" && file !== null && "arrayBuffer" in file) {
        const buf = await (file as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
        bytes = new Uint8Array(buf);
      }
    } else if (
      contentType.includes("application/vnd.foliyo.resume+zip") ||
      contentType.includes("application/zip") ||
      contentType.includes("application/octet-stream")
    ) {
      bytes = new Uint8Array(await c.req.arrayBuffer());
    }

    if (!bytes || bytes.byteLength === 0) {
      return c.json(
        {
          error: "missing_file",
          message: "Upload a .fio file as multipart field \"file\" or raw ZIP body.",
        },
        400,
      );
    }

    // Cap ~5MB
    if (bytes.byteLength > 5 * 1024 * 1024) {
      return c.json({ error: "file_too_large", message: ".fio must be under 5MB." }, 400);
    }

    const parsed = parseAndVerifyFio(bytes, config.integritySecret);
    if (!parsed.ok) {
      return c.json({ error: parsed.error, message: parsed.message, valid: false }, 400);
    }

    return c.json({
      draft: parsed.draft,
      meta: {
        schema: parsed.document.$schema,
        version: parsed.document.$version,
        content_hash: parsed.manifest.content_hash,
        signature_valid: true,
        resume_name: parsed.document.meta.resume_name ?? null,
        // Explicit: integrity ≠ account email ownership / verified status
        identity_restored: false,
      },
    });
  });

  /**
   * Apply a reviewed Foliyo Resume Spec draft (from AI extract or .fio parse)
   * into the user's library. One request, one transaction, one skill recompute.
   * Never writes users.email or email_verified.
   */
  r.post("/apply", async (c) => {
    const userId = c.get("userId");
    const payload = await c.req.json().catch(() => null);
    const draft = (payload as { draft?: FioImportDraft } | null)?.draft;
    if (!draft || typeof draft !== "object") {
      return c.json({ error: "invalid body", message: "Send { draft } matching the Foliyo Resume Spec." }, 400);
    }
    const result = await applyImportDraft(db, userId, draft);
    return c.json(result, 201);
  });

  return r;
}
