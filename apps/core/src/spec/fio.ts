import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { FoliyoResumeDocument, FioSignature, FioManifest } from "./resume.js";
import {
  FIO_MIME,
  FOLIYO_RESUME_SCHEMA,
  buildFoliyoResumeDocument,
  contentHashForDoc,
  verifySignature,
} from "./resume.js";
import type { PublicPortfolio } from "../public/pages.js";

export { FIO_MIME };

export type FioBundle = {
  bytes: Uint8Array;
  filename: string;
  document: FoliyoResumeDocument;
  signature: FioSignature;
  manifest: FioManifest;
};

/** Draft shape for library apply — never includes login email or email_verified. */
export type FioImportDraft = {
  candidate: {
    name: string;
    headline: string;
    bio: string;
    email: string;
    location: string;
    links: Record<string, string>;
  };
  skills: Array<{ name: string; level: string | null; category: string | null }>;
  experience: Array<{
    company: string;
    role: string;
    location: string | null;
    start: string | null;
    end: string | null;
    current: boolean;
    description: string | null;
  }>;
  education: Array<{
    institution: string;
    degree: string | null;
    field: string | null;
    start: string | null;
    end: string | null;
    description: string | null;
  }>;
  projects: Array<{
    title: string;
    description: string | null;
    url: string | null;
    repo_url: string | null;
    skills_developed: string[];
    featured: boolean;
  }>;
  certifications: Array<{
    name: string;
    issuer: string | null;
    credential_id: string | null;
    credential_url: string | null;
    issued_at: string | null;
    expires_at: string | null;
    description: string | null;
  }>;
  languages: Array<{ language: string; proficiency: string | null }>;
};

export type ParseFioResult =
  | { ok: true; document: FoliyoResumeDocument; signature: FioSignature; manifest: FioManifest; draft: FioImportDraft }
  | { ok: false; error: string; message: string };

export function buildFioFromPortfolio(
  data: PublicPortfolio,
  resume: {
    name: string;
    theme_slug: string;
    share_token: string;
    is_public: number;
  },
  opts: { siteUrl: string; integritySecret: string },
): FioBundle {
  const built = buildFoliyoResumeDocument({
    profile: data.profile,
    skills: data.skills,
    experience: data.experience,
    education: data.education,
    projects: data.projects,
    certifications: data.certifications,
    languages: data.languages,
    social_links: data.social_links,
    portfolio: data.portfolio,
    resume,
    siteUrl: opts.siteUrl,
    integritySecret: opts.integritySecret,
  });

  const bytes = zipSync(
    {
      "manifest.json": strToU8(built.manifestJson),
      "resume.json": strToU8(built.resumeJson),
      "signature.sig": strToU8(built.signatureJson),
    },
    { level: 6 },
  );

  const safeName = resume.name.replace(/[^\w\-]+/g, "_").slice(0, 64) || "resume";
  return {
    bytes,
    filename: `${safeName}.fio`,
    document: built.document,
    signature: built.signature,
    manifest: built.manifest,
  };
}

function strOrEmpty(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function strOrNull(v: unknown): string | null {
  const s = strOrEmpty(v);
  return s.length ? s : null;
}

/**
 * Unzip + verify a `.fio` package.
 * HMAC proves content integrity for this instance secret — not email ownership.
 * Never maps anything to users.email / email_verified.
 */
export function parseAndVerifyFio(
  bytes: Uint8Array,
  integritySecret: string,
): ParseFioResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { ok: false, error: "invalid_zip", message: "File is not a valid .fio ZIP package." };
  }

  const resumeRaw = files["resume.json"];
  const sigRaw = files["signature.sig"];
  const manifestRaw = files["manifest.json"];
  if (!resumeRaw || !sigRaw) {
    return {
      ok: false,
      error: "missing_files",
      message: "Package must include resume.json and signature.sig.",
    };
  }

  let document: FoliyoResumeDocument;
  let signature: FioSignature;
  let manifest: FioManifest | null = null;
  try {
    document = JSON.parse(strFromU8(resumeRaw)) as FoliyoResumeDocument;
    signature = JSON.parse(strFromU8(sigRaw)) as FioSignature;
    if (manifestRaw) {
      manifest = JSON.parse(strFromU8(manifestRaw)) as FioManifest;
    }
  } catch {
    return { ok: false, error: "invalid_json", message: "Could not parse package JSON." };
  }

  if (document.$schema !== FOLIYO_RESUME_SCHEMA) {
    return { ok: false, error: "unsupported_schema", message: "Unsupported resume schema." };
  }

  const hash = contentHashForDoc(document);
  if (signature.content_hash && signature.content_hash !== hash) {
    return {
      ok: false,
      error: "content_hash_mismatch",
      message: "Content hash does not match resume.json.",
    };
  }

  if (!verifySignature(hash, signature.signature, integritySecret)) {
    return {
      ok: false,
      error: "signature_invalid",
      message: "Signature is invalid for this Foliyo instance.",
    };
  }

  const draft = documentToImportDraft(document);
  return {
    ok: true,
    document,
    signature,
    manifest: manifest ?? {
      format: "fio",
      format_version: "1",
      spec: FOLIYO_RESUME_SCHEMA,
      spec_version: document.$version,
      generated_at: document.meta.generated_at,
      generated_by: document.meta.generated_by,
      files: ["manifest.json", "resume.json", "signature.sig"],
      content_hash: hash,
    },
    draft,
  };
}

/** Map resume document → library draft. Public candidate.email only — never account identity. */
export function documentToImportDraft(doc: FoliyoResumeDocument): FioImportDraft {
  const cand = doc.candidate ?? { name: "", links: {} };
  return {
    candidate: {
      name: strOrEmpty(cand.name),
      headline: strOrEmpty(cand.headline),
      bio: strOrEmpty(cand.bio),
      email: strOrEmpty(cand.email),
      location: strOrEmpty(cand.location),
      links: cand.links && typeof cand.links === "object" ? { ...cand.links } : {},
    },
    skills: (doc.skills ?? []).map((s) => ({
      name: strOrEmpty(s.name),
      level: strOrNull(s.level),
      category: strOrNull(s.category),
    })),
    experience: (doc.experience ?? []).map((e) => ({
      company: strOrEmpty(e.company),
      role: strOrEmpty(e.role),
      location: strOrNull(e.location),
      start: strOrNull(e.start),
      end: strOrNull(e.end),
      current: Boolean(e.current),
      description: strOrNull(e.description),
    })),
    education: (doc.education ?? []).map((e) => ({
      institution: strOrEmpty(e.institution),
      degree: strOrNull(e.degree),
      field: strOrNull(e.field),
      start: strOrNull(e.start),
      end: strOrNull(e.end),
      description: strOrNull(e.description),
    })),
    projects: (doc.projects ?? []).map((p) => ({
      title: strOrEmpty(p.title),
      description: strOrNull(p.description),
      url: strOrNull(p.url),
      repo_url: strOrNull(p.repo_url),
      skills_developed: Array.isArray(p.skills_developed) ? p.skills_developed.map(String) : [],
      featured: Boolean(p.featured),
    })),
    certifications: (doc.certifications ?? []).map((c) => ({
      name: strOrEmpty(c.name),
      issuer: strOrNull(c.issuer),
      credential_id: strOrNull(c.credential_id),
      credential_url: strOrNull(c.credential_url),
      issued_at: strOrNull(c.issued_at),
      expires_at: strOrNull(c.expires_at),
      description: strOrNull(c.description),
    })),
    languages: (doc.languages ?? []).map((l) => ({
      language: strOrEmpty(l.language),
      proficiency: strOrNull(l.proficiency),
    })),
  };
}
