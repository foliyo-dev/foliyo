import { zipSync, strToU8 } from "fflate";
import type { FoliyoResumeDocument, FioSignature, FioManifest } from "./resume.js";
import { FIO_MIME, buildFoliyoResumeDocument } from "./resume.js";
import type { PublicPortfolio } from "../public/pages.js";

export { FIO_MIME };

export type FioBundle = {
  bytes: Uint8Array;
  filename: string;
  document: FoliyoResumeDocument;
  signature: FioSignature;
  manifest: FioManifest;
};

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
