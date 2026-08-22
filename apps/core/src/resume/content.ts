import { queryAll, run, withTransaction, type FoliyoDb } from "../db.js";
import { orderedJunctionIds, sortIdsByLibraryOrder } from "../content-order.js";

export type ResumeContentIds = {
  skill_ids: string[];
  project_ids: string[];
  experience_ids: string[];
  education_ids: string[];
  certification_ids: string[];
  language_ids: string[];
};

export async function getResumeContentIds(db: FoliyoDb, resumeId: string): Promise<ResumeContentIds> {
  const [skill_ids, project_ids, experience_ids, education_ids, certification_ids, language_ids] =
    await Promise.all([
      orderedJunctionIds(db, "resume_skills", "resume_id", resumeId, "skill_id", "skills", false),
      orderedJunctionIds(
        db,
        "resume_projects",
        "resume_id",
        resumeId,
        "project_id",
        "projects",
        true,
      ),
      orderedJunctionIds(
        db,
        "resume_experience",
        "resume_id",
        resumeId,
        "experience_id",
        "experience",
        true,
      ),
      orderedJunctionIds(
        db,
        "resume_education",
        "resume_id",
        resumeId,
        "education_id",
        "education",
        true,
      ),
      orderedJunctionIds(
        db,
        "resume_certifications",
        "resume_id",
        resumeId,
        "certification_id",
        "certifications",
        false,
      ),
      orderedJunctionIds(
        db,
        "resume_languages",
        "resume_id",
        resumeId,
        "language_id",
        "languages",
        false,
      ),
    ]);

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
  const skill_ids = await sortIdsByLibraryOrder(db, "skills", content.skill_ids);
  const project_ids = await sortIdsByLibraryOrder(db, "projects", content.project_ids);
  const experience_ids = await sortIdsByLibraryOrder(db, "experience", content.experience_ids);
  const education_ids = await sortIdsByLibraryOrder(db, "education", content.education_ids);
  const certification_ids = await sortIdsByLibraryOrder(db, "certifications", content.certification_ids);
  const language_ids = await sortIdsByLibraryOrder(db, "languages", content.language_ids);

  await withTransaction(db, async () => {
    await run(db, "DELETE FROM resume_skills WHERE resume_id = ?", [resumeId]);
    await run(db, "DELETE FROM resume_projects WHERE resume_id = ?", [resumeId]);
    await run(db, "DELETE FROM resume_experience WHERE resume_id = ?", [resumeId]);
    await run(db, "DELETE FROM resume_education WHERE resume_id = ?", [resumeId]);
    await run(db, "DELETE FROM resume_certifications WHERE resume_id = ?", [resumeId]);
    await run(db, "DELETE FROM resume_languages WHERE resume_id = ?", [resumeId]);

    for (const id of skill_ids) {
      await run(db, "INSERT INTO resume_skills (resume_id, skill_id) VALUES (?, ?)", [resumeId, id]);
    }
    for (const [sortOrder, id] of project_ids.entries()) {
      await run(db, "INSERT INTO resume_projects (resume_id, project_id, sort_order) VALUES (?, ?, ?)", [
        resumeId,
        id,
        sortOrder,
      ]);
    }
    for (const [sortOrder, id] of experience_ids.entries()) {
      await run(db, "INSERT INTO resume_experience (resume_id, experience_id, sort_order) VALUES (?, ?, ?)", [
        resumeId,
        id,
        sortOrder,
      ]);
    }
    for (const [sortOrder, id] of education_ids.entries()) {
      await run(db, "INSERT INTO resume_education (resume_id, education_id, sort_order) VALUES (?, ?, ?)", [
        resumeId,
        id,
        sortOrder,
      ]);
    }
    for (const id of certification_ids) {
      await run(db, "INSERT INTO resume_certifications (resume_id, certification_id) VALUES (?, ?)", [
        resumeId,
        id,
      ]);
    }
    for (const id of language_ids) {
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
  const content = await getResumeContentIdsFromPortfolio(db, portfolioId);
  await setResumeContent(db, resumeId, content);
  return content;
}

async function getResumeContentIdsFromPortfolio(
  db: FoliyoDb,
  portfolioId: string,
): Promise<ResumeContentIds> {
  const [skill_ids, project_ids, experience_ids, education_ids, certification_ids, language_ids] =
    await Promise.all([
      orderedJunctionIds(
        db,
        "portfolio_skills",
        "portfolio_id",
        portfolioId,
        "skill_id",
        "skills",
        false,
      ),
      orderedJunctionIds(
        db,
        "portfolio_projects",
        "portfolio_id",
        portfolioId,
        "project_id",
        "projects",
        true,
      ),
      orderedJunctionIds(
        db,
        "portfolio_experience",
        "portfolio_id",
        portfolioId,
        "experience_id",
        "experience",
        true,
      ),
      orderedJunctionIds(
        db,
        "portfolio_education",
        "portfolio_id",
        portfolioId,
        "education_id",
        "education",
        true,
      ),
      orderedJunctionIds(
        db,
        "portfolio_certifications",
        "portfolio_id",
        portfolioId,
        "certification_id",
        "certifications",
        false,
      ),
      orderedJunctionIds(
        db,
        "portfolio_languages",
        "portfolio_id",
        portfolioId,
        "language_id",
        "languages",
        false,
      ),
    ]);

  return {
    skill_ids,
    project_ids,
    experience_ids,
    education_ids,
    certification_ids,
    language_ids,
  };
}
