import type { JobDocumentParser } from "../jobs/types.js";
import type { OpenRouterClientConfig } from "./types.js";
import { isOpenRouterConfigured } from "./types.js";
import { parseJobDocumentWithOpenRouter } from "./openrouter-jd.js";

/**
 * Optional LLM JD parse for OSS / self-host BYOK.
 * Failures always fall back to heuristic analysis. No unit metering.
 */
export function createOpenRouterJobParser(
  openRouter: OpenRouterClientConfig,
): JobDocumentParser {
  return async ({ text, enhance }) => {
    if (!enhance) return { ok: false, reason: "not_requested" };
    if (!isOpenRouterConfigured(openRouter)) return { ok: false, reason: "unavailable" };

    try {
      const result = await parseJobDocumentWithOpenRouter(text, openRouter);
      if (result.job.requirements.length === 0) return { ok: false, reason: "failed" };
      return { ok: true, job: result.job };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ai:jd-parse] failed:", message);
      return { ok: false, reason: "failed" };
    }
  };
}
