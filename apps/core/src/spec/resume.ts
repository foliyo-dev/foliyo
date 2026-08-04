import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const FOLIYO_RESUME_SCHEMA = "https://spec.foliyo.dev/resume/v1";
export const FOLIYO_RESUME_VERSION = "0.1.0";
export const FIO_FORMAT_VERSION = "1";
export const FIO_MIME = "application/vnd.foliyo.resume+zip";

export type FoliyoResumeDocument = {
  $schema: typeof FOLIYO_RESUME_SCHEMA;
  $version: string;
  meta: {
    generated_at: string;
    generated_by: string;
    content_hash?: string;
    integrity_token?: string;
    share_token?: string | null;
    public_url?: string | null;
    resume_name?: string | null;
    theme_slug?: string | null;
  };
  candidate: {
    name: string;
    headline?: string | null;
    bio?: string | null;
    email?: string | null;
    location?: string | null;
    avatar_url?: string | null;
    links: Record<string, string>;
  };
  skills: Array<{ name: string; level?: string | null; category?: string | null }>;
  experience: Array<{
    company: string;
    role: string;
    location?: string | null;
    start?: string | null;
    end?: string | null;
    current: boolean;
    description?: string | null;
    url?: string | null;
  }>;
  education: Array<{
    institution: string;
    degree?: string | null;
    field?: string | null;
    start?: string | null;
    end?: string | null;
    description?: string | null;
  }>;
  projects: Array<{
    title: string;
    description?: string | null;
    url?: string | null;
    repo_url?: string | null;
    tags: string[];
    featured: boolean;
  }>;
  certifications: Array<{
    name: string;
    issuer?: string | null;
    credential_id?: string | null;
    credential_url?: string | null;
    issued_at?: string | null;
    expires_at?: string | null;
    description?: string | null;
  }>;
  languages: Array<{ language: string; proficiency?: string | null }>;
};

export type FioSignature = {
  alg: "HMAC-SHA256";
  content_hash: string;
  signature: string;
  signed_at: string;
  issuer: string;
  format: "foliyo-resume-sig/v1";
};

export type FioManifest = {
  format: "fio";
  format_version: string;
  spec: typeof FOLIYO_RESUME_SCHEMA;
  spec_version: string;
  generated_at: string;
  generated_by: string;
  files: string[];
  content_hash: string;
};

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/** Canonical JSON for hashing — stable key order via JSON.stringify of built object. */
export function canonicalResumeJson(doc: FoliyoResumeDocument): string {
  const forHash: FoliyoResumeDocument = {
    ...doc,
    meta: {
      ...doc.meta,
    },
  };
  delete forHash.meta.content_hash;
  delete forHash.meta.integrity_token;
  return JSON.stringify(forHash);
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function contentHashForDoc(doc: FoliyoResumeDocument): string {
  return `sha256:${sha256Hex(canonicalResumeJson(doc))}`;
}

export function signContentHash(contentHash: string, secret: string): string {
  const payload = contentHash.startsWith("sha256:") ? contentHash : `sha256:${contentHash}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifySignature(
  contentHash: string,
  signatureHex: string,
  secret: string,
): boolean {
  const expected = signContentHash(contentHash, secret);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signatureHex, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildSignature(
  contentHash: string,
  secret: string,
  issuer = "foliyo",
): FioSignature {
  return {
    alg: "HMAC-SHA256",
    content_hash: contentHash,
    signature: signContentHash(contentHash, secret),
    signed_at: new Date().toISOString(),
    issuer,
    format: "foliyo-resume-sig/v1",
  };
}

type BuildInput = {
  profile: Record<string, unknown>;
  skills: Record<string, unknown>[];
  experience: Record<string, unknown>[];
  education: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  certifications: Record<string, unknown>[];
  languages: Record<string, unknown>[];
  social_links: Record<string, unknown>[];
  portfolio?: Record<string, unknown>;
  resume?: {
    name?: string;
    theme_slug?: string;
    share_token?: string | null;
    is_public?: number;
  };
  siteUrl: string;
  generatedBy?: string;
  integritySecret: string;
};

function linksFrom(profile: Record<string, unknown>, social: Record<string, unknown>[]): Record<string, string> {
  const links: Record<string, string> = {};
  for (const row of social) {
    const provider = str(row.provider);
    const value = str(row.value);
    if (provider && value) links[provider] = value;
  }
  // Legacy profile columns as fallback
  for (const key of ["website", "github", "linkedin", "twitter"] as const) {
    const v = str(profile[key]);
    if (v && !links[key]) links[key] = v;
  }
  return links;
}

export function buildFoliyoResumeDocument(input: BuildInput): {
  document: FoliyoResumeDocument;
  signature: FioSignature;
  resumeJson: string;
  signatureJson: string;
  manifest: FioManifest;
  manifestJson: string;
} {
  const profile = input.profile;
  const portfolio = input.portfolio ?? {};
  const headline =
    str(portfolio.headline) ?? str(profile.headline);
  const bio = str(portfolio.bio) ?? str(profile.bio);
  const shareToken = input.resume?.share_token ?? null;
  const publicUrl =
    shareToken && input.resume?.is_public
      ? `${input.siteUrl.replace(/\/$/, "")}/r/${shareToken}`
      : null;

  const document: FoliyoResumeDocument = {
    $schema: FOLIYO_RESUME_SCHEMA,
    $version: FOLIYO_RESUME_VERSION,
    meta: {
      generated_at: new Date().toISOString(),
      generated_by: input.generatedBy ?? "foliyo",
      share_token: shareToken,
      public_url: publicUrl,
      resume_name: input.resume?.name ?? null,
      theme_slug: input.resume?.theme_slug ?? null,
    },
    candidate: {
      name: str(profile.name) ?? "",
      headline,
      bio,
      email: str(profile.email),
      location: str(profile.location),
      avatar_url: str(profile.avatar_url),
      links: linksFrom(profile, input.social_links),
    },
    skills: input.skills.map((s) => ({
      name: str(s.name) ?? "",
      level: str(s.level),
      category: str(s.category),
    })),
    experience: input.experience.map((e) => {
      const end = str(e.end_date);
      return {
        company: str(e.company) ?? "",
        role: str(e.role) ?? "",
        location: str(e.location),
        start: str(e.start_date),
        end,
        current: !end,
        description: str(e.description),
        url: str(e.article_url),
      };
    }),
    education: input.education.map((e) => ({
      institution: str(e.institution) ?? "",
      degree: str(e.degree),
      field: str(e.field),
      start: str(e.start_date),
      end: str(e.end_date),
      description: str(e.description),
    })),
    projects: input.projects.map((p) => ({
      title: str(p.title) ?? "",
      description: str(p.description),
      url: str(p.url),
      repo_url: str(p.repo_url),
      tags: parseTags(p.tags),
      featured: Number(p.featured) === 1,
    })),
    certifications: input.certifications.map((c) => ({
      name: str(c.name) ?? "",
      issuer: str(c.issuer),
      credential_id: str(c.credential_id),
      credential_url: str(c.credential_url),
      issued_at: str(c.issued_at),
      expires_at: str(c.expires_at),
      description: str(c.description),
    })),
    languages: input.languages.map((l) => ({
      language: str(l.name) ?? "",
      proficiency: str(l.proficiency),
    })),
  };

  const hash = contentHashForDoc(document);
  const signature = buildSignature(hash, input.integritySecret);
  document.meta.content_hash = hash;
  document.meta.integrity_token = signature.signature;

  const resumeJson = `${JSON.stringify(document, null, 2)}\n`;
  const signatureJson = `${JSON.stringify(signature, null, 2)}\n`;
  const manifest: FioManifest = {
    format: "fio",
    format_version: FIO_FORMAT_VERSION,
    spec: FOLIYO_RESUME_SCHEMA,
    spec_version: FOLIYO_RESUME_VERSION,
    generated_at: document.meta.generated_at,
    generated_by: document.meta.generated_by,
    files: ["manifest.json", "resume.json", "signature.sig"],
    content_hash: hash,
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

  return { document, signature, resumeJson, signatureJson, manifest, manifestJson };
}
