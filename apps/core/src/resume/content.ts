import { queryAll, run, withTransaction, type FoliyoDb } from "../db.js";

export type ResumeContentIds = {
  skill_ids: string[];
  project_ids: string[];
  experience_ids: string[];
  education_ids: string[];
  certification_ids: string[];
  language_ids: string[];
};

export async function getResumeContentIds(db: FoliyoDb, resumeId: string): Promise<ResumeContentIds> {
  const skill_ids = (
    await queryAll<{ skill_id: string }>(db, "SELECT skill_id FROM resume_skills WHERE resume_id = ?", [
      resumeId,
    ])
  ).map((r) => r.skill_id);
  const project_ids = (
    await queryAll<{ project_id: string }>(
      db,
      "SELECT project_id FROM resume_projects WHERE resume_id = ?",
      [resumeId],
    )
  ).map((r) => r.project_id);
  const experience_ids = (
    await queryAll<{ experience_id: string }>(
      db,
      "SELECT experience_id FROM resume_experience WHERE resume_id = ?",
      [resumeId],
    )
  ).map((r) => r.experience_id);
  const education_ids = (
    await queryAll<{ education_id: string }>(
      db,
      "SELECT education_id FROM resume_education WHERE resume_id = ?",
      [resumeId],
    )
  ).map((r) => r.education_id);
  const certification_ids = (
    await queryAll<{ certification_id: string }>(
      db,
      "SELECT certification_id FROM resume_certifications WHERE resume_id = ?",
      [resumeId],
    )
  ).map((r) => r.certification_id);
  const language_ids = (
    await queryAll<{ language_id: string }>(
      db,
      "SELECT language_id FROM resume_languages WHERE resume_id = ?",
      [resumeId],
    )
  ).map((r) => r.language_id);

  return {
    skill_ids,
    project_ids,
    experience_ids,
    education_ids,
    certification_ids,
    language_ids,
  };
}

/** Keep only library IDs owned by the user (and confirmed skills). */
export async function filterOwnedContent(
  db: FoliyoDb,
  userId: string,
  content: ResumeContentIds,
): Promise<ResumeContentIds> {
  const [skills, projects, experience, education, certifications, languages] = await Promise.all([
    queryAll<{ id: string }>(
      db,
      "SELECT id FROM skills WHERE user_id = ? AND status = 'confirmed' AND deleted_at IS NULL",
      [userId],
    ),
    queryAll<{ id: string }>(db, "SELECT id FROM projects WHERE user_id = ? AND deleted_at IS NULL", [userId]),
    queryAll<{ id: string }>(db, "SELECT id FROM experience WHERE user_id = ? AND deleted_at IS NULL", [userId]),
    queryAll<{ id: string }>(db, "SELECT id FROM education WHERE user_id = ? AND deleted_at IS NULL", [userId]),
    queryAll<{ id: string }>(db, "SELECT id FROM certifications WHERE user_id = ? AND deleted_at IS NULL", [userId]),
    queryAll<{ id: string }>(db, "SELECT id FROM languages WHERE user_id = ? AND deleted_at IS NULL", [userId]),
  ]);
  const allow = (rows: Array<{ id: string }>, ids: string[]) => {
    const set = new Set(rows.map((r) => r.id));
    return ids.filter((id) => set.has(id));
  };
  return {
    skill_ids: allow(skills, content.skill_ids),
    project_ids: allow(projects, content.project_ids),
    experience_ids: allow(experience, content.experience_ids),
    education_ids: allow(education, content.education_ids),
    certification_ids: allow(certifications, content.certification_ids),
    language_ids: allow(languages, content.language_ids),
  };
}

/** Replace all resume content junctions (snapshot write). */
export async function setResumeContent(
  db: FoliyoDb,
  resumeId: string,
  content: ResumeContentIds,
): Promise<void> {
  await withTransaction(db, async () => {
    await run(db, "DELETE FROM resume_skills WHERE resume_id = ?", [resumeId]);
    await run(db, "DELETE FROM resume_projects WHERE resume_id = ?", [resumeId]);
    await run(db, "DELETE FROM resume_experience WHERE resume_id = ?", [resumeId]);
    await run(db, "DELETE FROM resume_education WHERE resume_id = ?", [resumeId]);
    await run(db, "DELETE FROM resume_certifications WHERE resume_id = ?", [resumeId]);
    await run(db, "DELETE FROM resume_languages WHERE resume_id = ?", [resumeId]);

    for (const id of content.skill_ids) {
      await run(db, "INSERT INTO resume_skills (resume_id, skill_id) VALUES (?, ?)", [resumeId, id]);
    }
    for (const id of content.project_ids) {
      await run(db, "INSERT INTO resume_projects (resume_id, project_id) VALUES (?, ?)", [
        resumeId,
        id,
      ]);
    }
    for (const id of content.experience_ids) {
      await run(db, "INSERT INTO resume_experience (resume_id, experience_id) VALUES (?, ?)", [
        resumeId,
        id,
      ]);
    }
    for (const id of content.education_ids) {
      await run(db, "INSERT INTO resume_education (resume_id, education_id) VALUES (?, ?)", [
        resumeId,
        id,
      ]);
    }
    for (const id of content.certification_ids) {
      await run(db, "INSERT INTO resume_certifications (resume_id, certification_id) VALUES (?, ?)", [
        resumeId,
        id,
      ]);
    }
    for (const id of content.language_ids) {
      await run(db, "INSERT INTO resume_languages (resume_id, language_id) VALUES (?, ?)", [
        resumeId,
        id,
      ]);
    }
  });
}

/** Copy a portfolio's current junctions into a resume snapshot. */
export async function copyPortfolioContentToResume(
  db: FoliyoDb,
  resumeId: string,
  portfolioId: string,
): Promise<ResumeContentIds> {
  const skill_ids = (
    await queryAll<{ skill_id: string }>(
      db,
      "SELECT skill_id FROM portfolio_skills WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.skill_id);
  const project_ids = (
    await queryAll<{ project_id: string }>(
      db,
      "SELECT project_id FROM portfolio_projects WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.project_id);
  const experience_ids = (
    await queryAll<{ experience_id: string }>(
      db,
      "SELECT experience_id FROM portfolio_experience WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.experience_id);
  const education_ids = (
    await queryAll<{ education_id: string }>(
      db,
      "SELECT education_id FROM portfolio_education WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.education_id);
  const certification_ids = (
    await queryAll<{ certification_id: string }>(
      db,
      "SELECT certification_id FROM portfolio_certifications WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.certification_id);
  const language_ids = (
    await queryAll<{ language_id: string }>(
      db,
      "SELECT language_id FROM portfolio_languages WHERE portfolio_id = ?",
      [portfolioId],
    )
  ).map((r) => r.language_id);

  const content: ResumeContentIds = {
    skill_ids,
    project_ids,
    experience_ids,
    education_ids,
    certification_ids,
    language_ids,
  };
  await setResumeContent(db, resumeId, content);
  return content;
}
