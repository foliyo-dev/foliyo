-- Per-folio / per-resume display order for projects, experience, and education.
-- Backfill from each library item's sort_order so existing pages keep their current look.

ALTER TABLE portfolio_projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE portfolio_experience ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE portfolio_education ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE resume_projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resume_experience ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resume_education ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE portfolio_projects SET sort_order = COALESCE(
  (SELECT p.sort_order FROM projects p WHERE p.id = portfolio_projects.project_id),
  0
);
UPDATE portfolio_experience SET sort_order = COALESCE(
  (SELECT e.sort_order FROM experience e WHERE e.id = portfolio_experience.experience_id),
  0
);
UPDATE portfolio_education SET sort_order = COALESCE(
  (SELECT e.sort_order FROM education e WHERE e.id = portfolio_education.education_id),
  0
);

UPDATE resume_projects SET sort_order = COALESCE(
  (SELECT p.sort_order FROM projects p WHERE p.id = resume_projects.project_id),
  0
);
UPDATE resume_experience SET sort_order = COALESCE(
  (SELECT e.sort_order FROM experience e WHERE e.id = resume_experience.experience_id),
  0
);
UPDATE resume_education SET sort_order = COALESCE(
  (SELECT e.sort_order FROM education e WHERE e.id = resume_education.education_id),
  0
);
