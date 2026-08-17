import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../middleware/auth.js";
import type { FoliyoDb } from "../db.js";
import { defaultAcceptedIds, runJobAnalyze } from "../jobs/analyze.js";
import { gateJdText, MAX_JD_CHARS, MIN_JD_CHARS } from "../jobs/parse.js";
import {
  deleteJobAnalysis,
  getJobAnalysis,
  listJobAnalyses,
  saveJobAnalysis,
  updateJobAnalysisAccepted,
} from "../jobs/store.js";
import type { JobDocumentParser } from "../jobs/types.js";

const analyzeSchema = z.object({
  jd_text: z.string().min(MIN_JD_CHARS).max(MAX_JD_CHARS),
  resume_id: z.string().min(1).optional(),
  portfolio_id: z.string().min(1).optional(),
  enhance: z.boolean().optional(),
});

const acceptedSchema = z.object({
  accepted: z.array(z.string().min(1)).max(200),
});

export function jobsRoutes(db: FoliyoDb, parser?: JobDocumentParser) {
  const r = new Hono<AppEnv>();

  /**
   * Paste-first job analysis. Heuristic always; optional LLM parse via cloud hook.
   * Persists the result so refresh / reopen does not spend another AI unit.
   * Does not invent skills.
   */
  r.post("/analyze", async (c) => {
    const userId = c.get("userId");
    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json({ error: "Send JSON { jd_text }." }, 400);
    }
    const body = analyzeSchema.safeParse(json);
    if (!body.success) {
      return c.json(
        { error: `jd_text must be ${MIN_JD_CHARS}–${MAX_JD_CHARS.toLocaleString()} characters.` },
        400,
      );
    }
    const gated = gateJdText(body.data.jd_text);
    if (!gated.ok) return c.json({ error: gated.error }, 400);

    const analysis = await runJobAnalyze(db, userId, {
      jdText: gated.text,
      resumeId: body.data.resume_id,
      portfolioId: body.data.portfolio_id,
      enhance: body.data.enhance,
      parser,
    });
    const accepted = [...defaultAcceptedIds(analysis)];
    const saved = await saveJobAnalysis(db, userId, {
      jdText: gated.text,
      analysis,
      accepted,
      enhanced: Boolean(body.data.enhance) && analysis.job.parse === "llm",
      portfolioId: body.data.portfolio_id,
      resumeId: body.data.resume_id,
    });
    return c.json({ ...saved.analysis, id: saved.id });
  });

  r.get("/analyses", async (c) => {
    const userId = c.get("userId");
    const items = await listJobAnalyses(db, userId);
    return c.json({ items });
  });

  r.get("/analyses/:id", async (c) => {
    const userId = c.get("userId");
    const saved = await getJobAnalysis(db, userId, c.req.param("id"));
    if (!saved) return c.json({ error: "not found" }, 404);
    return c.json(saved);
  });

  r.put("/analyses/:id", async (c) => {
    const userId = c.get("userId");
    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json({ error: "Send JSON { accepted }." }, 400);
    }
    const body = acceptedSchema.safeParse(json);
    if (!body.success) return c.json({ error: "accepted must be an array of ids." }, 400);
    const saved = await updateJobAnalysisAccepted(db, userId, c.req.param("id"), body.data.accepted);
    if (!saved) return c.json({ error: "not found" }, 404);
    return c.json(saved);
  });

  r.delete("/analyses/:id", async (c) => {
    const userId = c.get("userId");
    const ok = await deleteJobAnalysis(db, userId, c.req.param("id"));
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  return r;
}
