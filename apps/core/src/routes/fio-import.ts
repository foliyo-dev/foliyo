import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import type { Config } from "../config.js";
import { isOpenRouterConfigured, openRouterFromConfig } from "../config.js";
import type { FoliyoDb } from "../db.js";
import { clearUserContent } from "../account/clear-content.js";
import { parseAndVerifyFio, type FioImportDraft } from "../spec/fio.js";
import { applyImportDraft } from "../import/apply-draft.js";
import {
  captureLibrarySnapshot,
  deleteSnapshot,
  IMPORT_SNAPSHOT_LIMIT,
  listSnapshots,
  restoreSnapshot,
} from "../import/snapshots.js";
import {
  entitlementsFor,
  getEffectiveUserPlan,
  upgradePayload,
} from "../plan.js";
import {
  MAX_PASTE_CHARS,
  MAX_PDF_BYTES,
  MIN_TEXT_CHARS,
  clipForModel,
  extractAndGatePdf,
  extractResumeWithOpenRouter,
  gatePastedText,
} from "../ai/index.js";

const textBodySchema = z.object({
  text: z.string().min(MIN_TEXT_CHARS).max(MAX_PASTE_CHARS),
});

async function resolveResumeText(c: {
  req: {
    header: (name: string) => string | undefined;
    parseBody: () => Promise<Record<string, string | File>>;
    json: () => Promise<unknown>;
  };
}): Promise<{ text: string; pages?: number } | { error: string; status: 400 }> {
  const contentType = c.req.header("Content-Type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    const file = body.file ?? body.pdf ?? body.resume;
    const pasted = typeof body.text === "string" ? body.text : "";

    if (file instanceof File) {
      const name = (file.name ?? "").toLowerCase();
      const type = file.type ?? "";
      if (name && !name.endsWith(".pdf") && !type.includes("pdf")) {
        return {
          error: "Only PDF uploads are supported. Paste text for other formats.",
          status: 400,
        };
      }
      if (file.size > MAX_PDF_BYTES) {
        return {
          error: `PDF must be under ${Math.floor(MAX_PDF_BYTES / (1024 * 1024))}MB.`,
          status: 400,
        };
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const gated = await extractAndGatePdf(buf);
      if ("error" in gated) return gated;
      return { text: gated.text, pages: gated.pages };
    }

    if (pasted.trim()) {
      const gated = gatePastedText(pasted);
      if ("error" in gated) return gated;
      return { text: gated.text };
    }
    return { error: "Provide a PDF file or paste resume text.", status: 400 };
  }

  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return {
      error: "Send JSON { text } or multipart with a PDF file.",
      status: 400,
    };
  }
  const parsed = textBodySchema.safeParse(json);
  if (!parsed.success) {
    return {
      error: `Send JSON { text } (${MIN_TEXT_CHARS}–${MAX_PASTE_CHARS} characters) or a PDF upload.`,
      status: 400,
    };
  }
  const gated = gatePastedText(parsed.data.text);
  if ("error" in gated) return gated;
  return { text: gated.text };
}

/**
 * OSS / self-host import: `.fio` always; AI resume when OPENROUTER_API_KEY is set (BYOK).
 * Returns a library draft for the client to review and save.
 * Never writes users.email or email_verified — only draft profile/library fields.
 */
export function fioImportRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono<AppEnv>();
  const openRouter = openRouterFromConfig(config);

  // Self-host only — hosted cloud mounts metered POST /import/resume via extendApi.
  if (config.mode === "single") {
    /**
     * Self-host BYOK: PDF or pasted text → OpenRouter → Foliyo Resume Spec draft (no DB writes).
     * No Foliyo unit metering — the operator pays OpenRouter directly.
     */
    r.post("/resume", async (c) => {
      const userId = c.get("userId");
      const plan = await getEffectiveUserPlan(db, userId, config);
      const ents = entitlementsFor(plan);

      if (!ents.ai_resume_import) {
        return c.json(
          upgradePayload(
            "ai_resume_import",
            "AI resume is a Pro feature (₹99/mo). Upgrade to extract your CV into Foliyo.",
          ),
          402,
        );
      }

      if (!isOpenRouterConfigured(config)) {
        return c.json(
          {
            error: "ai_import_unavailable",
            message:
              "OpenRouter is not configured. Set OPENROUTER_API_KEY on this server to enable AI resume import (BYOK).",
          },
          503,
        );
      }

      const resolved = await resolveResumeText(c);
      if ("error" in resolved) return c.json({ error: resolved.error }, resolved.status);

      const modelText = clipForModel(resolved.text);

      try {
        const result = await extractResumeWithOpenRouter(modelText, openRouter);
        return c.json({
          draft: result.draft,
          meta: {
            model: result.model,
            schema: "https://spec.foliyo.dev/resume/v1",
            tokens_in: result.tokensIn,
            tokens_out: result.tokensOut,
            remaining_today: null,
            units_spent: 0,
            units_remaining: null,
            pages: resolved.pages ?? null,
            chars: modelText.length,
            byok: true,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "extract_failed";
        console.error("AI resume failed:", message);
        return c.json(
          {
            error: "extract_failed",
            message: "Could not extract resume. Try pasting text or a clearer PDF.",
          },
          502,
        );
      }
    });
  }

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

    // Accept foreign-signed packages (foliyo.dev → OSS); HMAC is advisory here.
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
        signature_valid: parsed.signatureValid,
        resume_name: parsed.document.meta.resume_name ?? null,
        // Explicit: integrity ≠ account email ownership / verified status
        identity_restored: false,
      },
    });
  });

  /**
   * Apply a reviewed Foliyo Resume Spec draft (from AI extract or .fio parse)
   * into the user's library. Snapshots library state first (up to 5 undo points)
   * unless clear_all_content is set.
   * Never writes users.email or email_verified.
   *
   * clear_all_content: wipe library, portfolios, resumes, applications, job analyses,
   * social links, import snapshots, and reset profile — then apply. Keeps login/auth.
   */
  r.post("/apply", async (c) => {
    const userId = c.get("userId");
    const payload = await c.req.json().catch(() => null);
    const body = payload as {
      draft?: FioImportDraft;
      label?: string;
      clear_all_content?: boolean;
    } | null;
    const draft = body?.draft;
    const labelRaw = body?.label;
    const clearAll = body?.clear_all_content === true;
    if (!draft || typeof draft !== "object") {
      return c.json({ error: "invalid body", message: "Send { draft } matching the Foliyo Resume Spec." }, 400);
    }

    let cleared: Awaited<ReturnType<typeof clearUserContent>> | null = null;
    if (clearAll) {
      cleared = await clearUserContent(db, userId, { config });
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
        : clearAll
          ? `After clear · ${when}`
          : `Before import · ${when}`;

    let snapshot: Awaited<ReturnType<typeof captureLibrarySnapshot>> = null;
    // Skip pre-import snapshot when wiping — there is nothing useful to undo to.
    if (!clearAll) {
      try {
        snapshot = await captureLibrarySnapshot(db, config, userId, label);
      } catch (err) {
        console.error("import snapshot failed:", err instanceof Error ? err.message : err);
      }
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
        cleared,
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
