import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "../config.js";
import { queryOne, type FoliyoDb } from "../db.js";
import { bearerToken, getTokenUserId } from "../auth/tokens.js";
import { loadResumeContent } from "../public/pages.js";
import {
  buildFoliyoResumeDocument,
  contentHashForDoc,
  verifySignature,
  type FoliyoResumeDocument,
  type FioSignature,
} from "../spec/resume.js";

const offlineVerifySchema = z.object({
  resume: z.record(z.unknown()),
  signature: z.object({
    alg: z.string(),
    content_hash: z.string(),
    signature: z.string(),
    signed_at: z.string().optional(),
    issuer: z.string().optional(),
    format: z.string().optional(),
  }),
});

export function specRoutes(db: FoliyoDb, config: Config) {
  const r = new Hono();

  /** Live verify: rebuild hash from current public resume content. */
  r.get("/verify/:token", async (c) => {
    const token = c.req.param("token");
    const resume = await queryOne<{
      id: string;
      name: string;
      theme_slug: string;
      portfolio_id: string | null;
      share_token: string;
      is_public: number;
      user_id: string;
    }>(db, "SELECT * FROM resumes WHERE share_token = ?", [token]);

    if (!resume) {
      return c.json({ valid: false, error: "resume_not_found" }, 404);
    }

    if (resume.is_public !== 1) {
      const session = bearerToken(c.req.header("Authorization"));
      const userId = session ? await getTokenUserId(db, session) : null;
      if (userId !== resume.user_id) {
        return c.json({ valid: false, error: "resume_not_found" }, 404);
      }
    }

    const data = await loadResumeContent(db, resume.id);
    if (!data) {
      return c.json({ valid: false, error: "resume_content_not_found" }, 404);
    }

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
      resume: {
        name: resume.name,
        theme_slug: resume.theme_slug,
        share_token: resume.share_token,
        is_public: resume.is_public,
      },
      siteUrl: config.siteUrl,
      integritySecret: config.integritySecret,
    });

    return c.json({
      valid: true,
      public: resume.is_public === 1,
      meta: {
        candidate: built.document.candidate.name,
        resume_name: resume.name,
        generated_at: built.document.meta.generated_at,
        content_hash: built.document.meta.content_hash,
        public_url: built.document.meta.public_url,
        share_token: resume.share_token,
        schema: built.document.$schema,
        version: built.document.$version,
      },
      verify_url: `${config.siteUrl.replace(/\/$/, "")}/v1/verify/${resume.share_token}`,
    });
  });

  /** Offline verify: check signature.sig against resume.json using issuer secret. */
  r.post("/verify", async (c) => {
    const body = offlineVerifySchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ valid: false, error: "invalid body" }, 400);

    const resume = body.data.resume as unknown as FoliyoResumeDocument;
    const signature = body.data.signature as FioSignature;

    if (resume.$schema !== "https://spec.foliyo.dev/resume/v1") {
      return c.json({ valid: false, error: "unsupported_schema" }, 400);
    }

    const hash = contentHashForDoc(resume);
    if (signature.content_hash && signature.content_hash !== hash) {
      return c.json({
        valid: false,
        error: "content_hash_mismatch",
        expected: hash,
        provided: signature.content_hash,
      });
    }

    const ok = verifySignature(hash, signature.signature, config.integritySecret);
    return c.json({
      valid: ok,
      content_hash: hash,
      candidate: resume.candidate?.name ?? null,
      generated_at: resume.meta?.generated_at ?? null,
      issuer: signature.issuer ?? null,
      error: ok ? undefined : "signature_invalid",
    });
  });

  return r;
}
