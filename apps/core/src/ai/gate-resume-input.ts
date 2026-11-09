/**
 * Gatekeeping before any resume text is sent to OpenRouter.
 * Validates PDF bytes + extracted/pasted text; rejects junk, bombs, and non-resume-like content.
 */

export const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_PDF_PAGES = 12;
export const MIN_TEXT_CHARS = 80;
export const MAX_TEXT_CHARS = 40_000; // hard cap sent to the model
export const MAX_PASTE_CHARS = 50_000;

const PDF_MAGIC = Buffer.from("%PDF-");

/** Lightweight resume-ish signals (any language-ish CV will often hit a few). */
const RESUME_SIGNALS = [
  /\b(experience|employment|work\s*history|professional\s*summary)\b/i,
  /\b(education|university|college|bachelor|master|degree|school)\b/i,
  /\b(skills?|technologies|tech\s*stack|competenc)/i,
  /\b(project|portfolio|github|linkedin)\b/i,
  /\b(certificat|internship|cv|resume|curriculum)\b/i,
  /\b(engineer|developer|designer|manager|analyst|consultant)\b/i,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(\+?\d[\d\s().-]{7,}\d)/,
];

export type GateError = { error: string; status: 400 };

export function gateFail(error: string): GateError {
  return { error, status: 400 };
}

/** Reject non-PDF payloads (extension/MIME alone is not enough). */
export function assertPdfBytes(buf: Buffer): GateError | null {
  if (buf.length < 8) return gateFail("File is too small to be a valid PDF.");
  if (buf.length > MAX_PDF_BYTES) {
    return gateFail(`PDF must be under ${Math.floor(MAX_PDF_BYTES / (1024 * 1024))}MB.`);
  }
  // PDF may have a UTF-8 BOM or leading whitespace; search near the start.
  const head = buf.subarray(0, Math.min(1024, buf.length));
  const idx = head.indexOf(PDF_MAGIC);
  if (idx < 0 || idx > 128) {
    return gateFail("File is not a valid PDF (missing %PDF- header).");
  }

  // Cheap polyglot / malware checks on raw bytes (case-sensitive PDF tokens).
  const sample = buf.subarray(0, Math.min(buf.length, 512 * 1024)).toString("latin1");
  const dangerous = [
    "/JavaScript",
    "/JS",
    "/Launch",
    "/EmbeddedFile",
    "/RichMedia",
    "/SubmitForm",
    "/ImportData",
  ];
  for (const token of dangerous) {
    if (sample.includes(token)) {
      return gateFail(
        "This PDF contains active or embedded content we do not accept. Export a plain text-based PDF or paste the text.",
      );
    }
  }
  return null;
}

/** Normalize text for the model: strip nulls/controls, collapse extreme whitespace. */
export function sanitizeResumeText(raw: string): string {
  let t = raw.replace(/\u0000/g, "");
  // Keep newlines/tabs; drop other C0 controls + DEL.
  t = t.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  // Normalize line endings
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Collapse huge blank runs
  t = t.replace(/\n{4,}/g, "\n\n\n");
  t = t.replace(/[ \t]{3,}/g, "  ");
  return t.trim();
}

/**
 * Heuristic: looks like a resume/CV enough to justify an LLM call.
 * Not perfect — review UI still required — but blocks random books/dumps.
 */
export function assertLooksLikeResume(text: string): GateError | null {
  if (text.length < MIN_TEXT_CHARS) {
    return gateFail(
      "Not enough text to import. Use a text-based PDF or paste at least a short resume.",
    );
  }
  if (text.length > MAX_PASTE_CHARS) {
    return gateFail(`Text is too long (max ${MAX_PASTE_CHARS.toLocaleString()} characters).`);
  }

  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const nonSpace = (text.match(/\S/g) ?? []).length || 1;
  if (letters / nonSpace < 0.35) {
    return gateFail("Content does not look like readable resume text.");
  }

  // Too link-spammy
  const urls = text.match(/https?:\/\/|www\./gi) ?? [];
  if (urls.length > 40) {
    return gateFail("Too many links for a resume. Paste a cleaner version.");
  }

  let hits = 0;
  for (const re of RESUME_SIGNALS) {
    if (re.test(text)) hits += 1;
  }
  if (hits < 2) {
    return gateFail(
      "This does not look like a resume (missing usual sections like experience, education, or contact). Paste your CV text instead.",
    );
  }

  return null;
}

/** Cap what we send to OpenRouter after gating. */
export function clipForModel(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_TEXT_CHARS)}\n\n[truncated for length]`;
}

export type ExtractedPdf = {
  text: string;
  pages: number;
};

/** Parse PDF, enforce page cap, sanitize + resume heuristics. */
export async function extractAndGatePdf(buffer: Buffer): Promise<ExtractedPdf | GateError> {
  const magicErr = assertPdfBytes(buffer);
  if (magicErr) return magicErr;

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const pages = pdf.numPages ?? 0;
    if (pages < 1) return gateFail("PDF has no pages.");
    if (pages > MAX_PDF_PAGES) {
      return gateFail(`PDF has too many pages (max ${MAX_PDF_PAGES}). Use a shorter resume.`);
    }

    const { text } = await extractText(pdf, { mergePages: true });
    const joined = Array.isArray(text) ? text.join("\n") : String(text ?? "");
    const cleaned = sanitizeResumeText(joined);
    if (cleaned.length < MIN_TEXT_CHARS) {
      return gateFail(
        "No extractable text found (scanned/image PDFs need OCR). Paste the resume text instead.",
      );
    }
    const lookErr = assertLooksLikeResume(cleaned);
    if (lookErr) return lookErr;
    return { text: cleaned, pages };
  } catch {
    return gateFail("Could not read this PDF. Use a text-based PDF or paste the resume text.");
  }
}

export function gatePastedText(raw: string): { text: string } | GateError {
  const cleaned = sanitizeResumeText(raw);
  const lookErr = assertLooksLikeResume(cleaned);
  if (lookErr) return lookErr;
  return { text: cleaned };
}
