import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import type { FoliyoDb } from "../db.js";
import { parseAndVerifyFio, type FioImportDraft } from "../spec/fio.js";
import { applyImportDraft } from "../import/apply-draft.js";
import {
  captureLibrarySnapshot,
  deleteSnapshot,
  IMPORT_SNAPSHOT_LIMIT,
  listSnapshots,
  restoreSnapshot,
} from "../import/snapshots.js";

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
   * into the user's library. Snapshots library state first (up to 5 undo points).
   * Never writes users.email or email_verified.
   */
  r.post("/apply", async (c) => {
    const userId = c.get("userId");
    const payload = await c.req.json().catch(() => null);
    const draft = (payload as { draft?: FioImportDraft; label?: string } | null)?.draft;
    const labelRaw = (payload as { label?: string } | null)?.label;
    if (!draft || typeof draft !== "object") {
      return c.json({ error: "invalid body", message: "Send { draft } matching the Foliyo Resume Spec." }, 400);
    }

    const when = new Date().toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const label =
      typeof labelRaw === "string" && labelRaw.trim()
        ? labelRaw.trim().slice(0, 120)
        : `Before import · ${when}`;

    let snapshot: Awaited<ReturnType<typeof captureLibrarySnapshot>> = null;
    try {
      snapshot = await captureLibrarySnapshot(db, config, userId, label);
    } catch (err) {
      console.error("import snapshot failed:", err instanceof Error ? err.message : err);
      // Still apply — snapshot is best-effort safety, not a hard gate.
    }

    const result = await applyImportDraft(db, userId, draft);
    if (result.saved.total === 0 && snapshot) {
      try {
        await deleteSnapshot(db, config, userId, snapshot.id);
      } catch {
        /* keep the unused undo point rather than failing the apply */
      }
      snapshot = null;
    }
    return c.json(
      {
        ...result,
        snapshot: snapshot
          ? { id: snapshot.id, label: snapshot.label, created_at: snapshot.created_at }
          : null,
        snapshot_limit: IMPORT_SNAPSHOT_LIMIT,
      },
      201,
    );
  });

  r.get("/snapshots", async (c) => {
    const userId = c.get("userId");
    const items = await listSnapshots(db, userId);
    return c.json({ items, limit: IMPORT_SNAPSHOT_LIMIT });
  });

  r.post("/snapshots/:id/restore", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const result = await restoreSnapshot(db, config, userId, id);
    if (!result.ok) {
      const status = result.error === "not_found" ? 404 : 400;
      return c.json({ error: result.error, message: result.message }, status);
    }
    return c.json({
      ok: true,
      saved: result.apply.saved,
      skipped: result.apply.skipped,
      failed: result.apply.failed,
      message: "Library restored from snapshot. Active library items were replaced.",
    });
  });

  r.delete("/snapshots/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const ok = await deleteSnapshot(db, config, userId, id);
    if (!ok) return c.json({ error: "not_found" }, 404);
    return c.body(null, 204);
  });

  return r;
}
