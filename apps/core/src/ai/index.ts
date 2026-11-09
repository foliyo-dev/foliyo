export type { OpenRouterClientConfig } from "./types.js";
export { isOpenRouterConfigured } from "./types.js";

export {
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  MIN_TEXT_CHARS,
  MAX_TEXT_CHARS,
  MAX_PASTE_CHARS,
  assertPdfBytes,
  sanitizeResumeText,
  assertLooksLikeResume,
  clipForModel,
  extractAndGatePdf,
  gatePastedText,
  gateFail,
  type GateError,
  type ExtractedPdf,
} from "./gate-resume-input.js";

export {
  MIN_BULLET_CHARS,
  MAX_BULLET_CHARS,
  MIN_JD_CHARS,
  MAX_JD_CHARS,
  sanitizeAssistText,
  gateBulletText,
  gateJdText,
  normalizeTone,
  type RewriteTone,
} from "./gate-assist.js";

export {
  extractResumeWithOpenRouter,
  type ResumeImportDraft,
  type OpenRouterResult,
} from "./openrouter-resume.js";

export {
  rewriteBulletWithOpenRouter,
  type RewriteResult,
} from "./openrouter-rewrite.js";

export {
  buildLibraryContext,
  generateSummaryWithOpenRouter,
  type SummaryResult,
} from "./openrouter-summary.js";

export {
  generateThemeWithOpenRouter,
  type ThemeGenerateResult,
} from "./openrouter-theme.js";

export {
  parseJobDocumentWithOpenRouter,
  type JdParseResult,
} from "./openrouter-jd.js";

export {
  runGapCheck,
  type GapCheckResult,
  type GapFinding,
} from "./gap-check.js";

export { createOpenRouterJobParser } from "./job-parser.js";
