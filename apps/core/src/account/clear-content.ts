import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../config.js";
import { queryAll, run, type FoliyoDb } from "../db.js";

export type ClearContentCounts = {
  resumes: number;
  portfolios: number;
  skills: number;
  projects: number;
  experience: number;
  education: number;
  certifications: number;
  languages: number;
  social_links: number;
  applications: number;
  blog_posts: number;
  job_analyses: number;
  import_snapshots: number;
  profile_reset: boolean;
};

export type ClearUserContentOptions = {
  /** When set, also deletes import_snapshots rows and on-disk snapshot files. */
  config?: Config;
  /** Reset profile fields to empty (keeps the profile row). Default true. */
  resetProfile?: boolean;
};

/**
 * Wipe portfolio/library content for a user. Keeps account identity:
 * users (email, password, plan, email_verified), tokens/sessions, settings, consents, billing.
 */
export async function clearUserContent(
  db: FoliyoDb,
  userId: string,
  options: ClearUserContentOptions = {},
): Promise<ClearContentCounts> {
  const resetProfile = options.resetProfile !== false;
  const count = async (table: string): Promise<number> => {
    const rows = await queryAll(db, `SELECT id FROM ${table} WHERE user_id = ?`, [userId]);
    return rows.length;
  };

  const counts: ClearContentCounts = {
    resumes: await count("resumes"),
    portfolios: await count("portfolios"),
    skills: await count("skills"),
    projects: await count("projects"),
    experience: await count("experience"),
    education: await count("education"),
    certifications: await count("certifications"),
    languages: await count("languages"),
    social_links: await count("social_links"),
    applications: await count("applications"),
    blog_posts: await count("blog_posts"),
    job_analyses: await count("job_analyses"),
    import_snapshots: await count("import_snapshots"),
    profile_reset: resetProfile,
  };

  // Resumes first (share tokens / public /r die). Portfolio junctions cascade with portfolios.
  await run(db, "DELETE FROM resumes WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM portfolios WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM job_analyses WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM applications WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM blog_posts WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM skills WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM projects WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM experience WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM education WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM certifications WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM languages WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM social_links WHERE user_id = ?", [userId]);
  await run(db, "DELETE FROM import_snapshots WHERE user_id = ?", [userId]);

  if (resetProfile) {
    await run(
      db,
      `UPDATE profile SET
         name='', headline='', bio='', avatar_url='', location='',
         email='', website='', github='', linkedin='', twitter='',
         updated_at=CURRENT_TIMESTAMP
       WHERE user_id=?`,
      [userId],
    );
  }

  if (options.config) {
    const dir = join(options.config.dataDir, "import-snapshots", userId);
    if (existsSync(dir)) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best-effort disk cleanup */
      }
    }
  }

  return counts;
}
