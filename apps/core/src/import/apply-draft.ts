import { queryOne, run, withTransaction, type FoliyoDb } from "../db.js";
import type { FioImportDraft } from "../spec/fio.js";
import { isSocialProvider } from "../social/providers.js";
import { upsertSkill } from "../skills/upsert.js";
import { suggestSkillsFromLibrary } from "../skills/evidence.js";

const LEVELS = new Set(["beginner", "intermediate", "advanced", "expert"]);
const PROFICIENCIES = new Set(["native", "fluent", "conversational", "basic"]);

export type ApplyDraftFailure = { section: string; index: number; error: string };

export type ApplyDraftCounts = {
  profile: number;
  links: number;
  skills: number;
  experience: number;
  education: number;
  projects: number;
  certifications: number;
  languages: number;
  total: number;
};

export type ApplyDraftResult = {
  saved: ApplyDraftCounts;
  failed: ApplyDraftFailure[];
};

type ProfileRow = {
  name: string;
  headline: string;
  bio: string;
  avatar_url: string;
  location: string;
  email: string;
  website: string;
  github: string;
  linkedin: string;
  twitter: string;
};

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s.length ? s : null;
}

function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === "true";
}

function tags(row: Record<string, unknown>): string[] {
  const raw = row.skills_developed ?? row.tags;
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return [];
}

/**
 * Write a reviewed Foliyo Resume Spec / AI / .fio draft into the user's library.
 * One DB pass + one skill-suggestion recompute. Invalid rows are skipped rather
 * than aborting the rest. Never writes users.email or email_verified.
 */
export async function applyImportDraft(
  db: FoliyoDb,
  userId: string,
  draft: FioImportDraft,
): Promise<ApplyDraftResult> {
  const failed: ApplyDraftFailure[] = [];
  const saved: ApplyDraftCounts = {
    profile: 0,
    links: 0,
    skills: 0,
    experience: 0,
    education: 0,
    projects: 0,
    certifications: 0,
    languages: 0,
    total: 0,
  };

  await withTransaction(db, async () => {
    const cand = draft.candidate ?? {
      name: "",
      headline: "",
      bio: "",
      email: "",
      location: "",
      links: {},
    };
    const hasProfile =
      Boolean(str(cand.name) || str(cand.headline) || str(cand.bio) || str(cand.email) || str(cand.location));
    if (hasProfile) {
      try {
        await upsertProfile(db, userId, {
          name: str(cand.name),
          headline: str(cand.headline),
          bio: str(cand.bio),
          email: str(cand.email),
          location: str(cand.location),
        });
        saved.profile = 1;
      } catch (err) {
        failed.push({
          section: "profile",
          index: 0,
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    const links = cand.links && typeof cand.links === "object" ? Object.entries(cand.links) : [];
    for (let i = 0; i < links.length; i++) {
      const [providerRaw, valueRaw] = links[i]!;
      const value = str(valueRaw);
      if (!value) continue;
      const provider = isSocialProvider(providerRaw.toLowerCase()) ? providerRaw.toLowerCase() : "other";
      try {
        await run(
          db,
          `INSERT INTO social_links (provider, label, value, sort_order, user_id) VALUES (?, ?, ?, ?, ?)`,
          [provider, providerRaw, value, i, userId],
        );
        saved.links += 1;
      } catch (err) {
        failed.push({
          section: "links",
          index: i,
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    const skills = Array.isArray(draft.skills) ? draft.skills : [];
    for (let i = 0; i < skills.length; i++) {
      const name = str(skills[i]?.name);
      if (!name) {
        failed.push({ section: "skills", index: i, error: "invalid body" });
        continue;
      }
      const levelRaw = str(skills[i]?.level);
      try {
        await upsertSkill(db, userId, {
          name,
          level: LEVELS.has(levelRaw) ? levelRaw : "intermediate",
          category: str(skills[i]?.category) || "general",
          recency: "current",
          sort_order: i,
        });
        saved.skills += 1;
      } catch (err) {
        failed.push({
          section: "skills",
          index: i,
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    const experience = Array.isArray(draft.experience) ? draft.experience : [];
    for (let i = 0; i < experience.length; i++) {
      const e = experience[i]!;
      const company = str(e.company);
      const role = str(e.role);
      if (!company || !role) {
        failed.push({ section: "experience", index: i, error: "invalid body" });
        continue;
      }
      try {
        await run(
          db,
          `INSERT INTO experience (company, role, location, start_date, end_date, description, article_url, article_url_label, skills_developed, sort_order, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            company,
            role,
            str(e.location),
            str(e.start),
            e.current ? null : strOrNull(e.end),
            str(e.description),
            "",
            "",
            "[]",
            i,
            userId,
          ],
        );
        saved.experience += 1;
      } catch (err) {
        failed.push({
          section: "experience",
          index: i,
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    const education = Array.isArray(draft.education) ? draft.education : [];
    for (let i = 0; i < education.length; i++) {
      const e = education[i]!;
      const institution = str(e.institution);
      if (!institution) {
        failed.push({ section: "education", index: i, error: "invalid body" });
        continue;
      }
      try {
        await run(
          db,
          `INSERT INTO education (institution, degree, field, start_date, end_date, description, skills_developed, sort_order, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            institution,
            str(e.degree),
            str(e.field),
            str(e.start),
            strOrNull(e.end),
            str(e.description),
            "[]",
            i,
            userId,
          ],
        );
        saved.education += 1;
      } catch (err) {
        failed.push({
          section: "education",
          index: i,
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    const projects = Array.isArray(draft.projects) ? draft.projects : [];
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i] as FioImportDraft["projects"][number] & { tags?: string[] };
      const title = str(p.title);
      if (!title) {
        failed.push({ section: "projects", index: i, error: "invalid body" });
        continue;
      }
      try {
        await run(
          db,
          `INSERT INTO projects (title, description, url, repo_url, article_url, image_url, url_label, repo_url_label, article_url_label, skills_developed, featured, sort_order, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            title,
            str(p.description),
            str(p.url),
            str(p.repo_url),
            "",
            "",
            "",
            "",
            "",
            JSON.stringify(tags(p as unknown as Record<string, unknown>)),
            asBool(p.featured) ? 1 : 0,
            i,
            userId,
          ],
        );
        saved.projects += 1;
      } catch (err) {
        failed.push({
          section: "projects",
          index: i,
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    const certifications = Array.isArray(draft.certifications) ? draft.certifications : [];
    for (let i = 0; i < certifications.length; i++) {
      const c = certifications[i]!;
      const name = str(c.name);
      if (!name) {
        failed.push({ section: "certifications", index: i, error: "invalid body" });
        continue;
      }
      try {
        await run(
          db,
          `INSERT INTO certifications (name, issuer, credential_id, credential_url, issued_at, expires_at, description, skills_developed, sort_order, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            str(c.issuer),
            str(c.credential_id),
            str(c.credential_url),
            strOrNull(c.issued_at),
            strOrNull(c.expires_at),
            str(c.description),
            "[]",
            i,
            userId,
          ],
        );
        saved.certifications += 1;
      } catch (err) {
        failed.push({
          section: "certifications",
          index: i,
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    const languages = Array.isArray(draft.languages) ? draft.languages : [];
    for (let i = 0; i < languages.length; i++) {
      const l = languages[i]!;
      const name = str(l.language);
      if (!name) {
        failed.push({ section: "languages", index: i, error: "invalid body" });
        continue;
      }
      const proficiencyRaw = str(l.proficiency);
      try {
        await run(
          db,
          `INSERT INTO languages (name, proficiency, sort_order, user_id) VALUES (?, ?, ?, ?)`,
          [name, PROFICIENCIES.has(proficiencyRaw) ? proficiencyRaw : "fluent", i, userId],
        );
        saved.languages += 1;
      } catch (err) {
        failed.push({
          section: "languages",
          index: i,
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    saved.total =
      saved.profile +
      saved.links +
      saved.skills +
      saved.experience +
      saved.education +
      saved.projects +
      saved.certifications +
      saved.languages;

    if (
      saved.experience + saved.education + saved.projects + saved.certifications > 0
    ) {
      await suggestSkillsFromLibrary(db, userId);
    }
  });

  return { saved, failed };
}

async function upsertProfile(
  db: FoliyoDb,
  userId: string,
  d: { name: string; headline: string; bio: string; email: string; location: string },
): Promise<void> {
  const existing = await queryOne<ProfileRow & { id: string }>(
    db,
    "SELECT * FROM profile WHERE user_id = ?",
    [userId],
  );
  const next: ProfileRow = {
    name: d.name || existing?.name || "",
    headline: d.headline || existing?.headline || "",
    bio: d.bio || existing?.bio || "",
    avatar_url: existing?.avatar_url ?? "",
    location: d.location || existing?.location || "",
    email: d.email || existing?.email || "",
    website: existing?.website ?? "",
    github: existing?.github ?? "",
    linkedin: existing?.linkedin ?? "",
    twitter: existing?.twitter ?? "",
  };
  if (existing) {
    await run(
      db,
      `UPDATE profile SET name=?, headline=?, bio=?, location=?, email=?, updated_at=CURRENT_TIMESTAMP
       WHERE user_id=?`,
      [next.name, next.headline, next.bio, next.location, next.email, userId],
    );
    return;
  }
  await run(
    db,
    `INSERT INTO profile (user_id, name, headline, bio, avatar_url, location, email, website, github, linkedin, twitter)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      userId,
      next.name,
      next.headline,
      next.bio,
      next.avatar_url,
      next.location,
      next.email,
      next.website,
      next.github,
      next.linkedin,
      next.twitter,
    ],
  );
}
