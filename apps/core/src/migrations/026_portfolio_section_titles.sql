-- Per-folio section titles (empty = Skills / Projects / Experience / …). Nav ids stay stable.
ALTER TABLE portfolios ADD COLUMN skills_title TEXT NOT NULL DEFAULT '';
ALTER TABLE portfolios ADD COLUMN projects_title TEXT NOT NULL DEFAULT '';
ALTER TABLE portfolios ADD COLUMN experience_title TEXT NOT NULL DEFAULT '';
ALTER TABLE portfolios ADD COLUMN education_title TEXT NOT NULL DEFAULT '';
ALTER TABLE portfolios ADD COLUMN certifications_title TEXT NOT NULL DEFAULT '';
ALTER TABLE portfolios ADD COLUMN languages_title TEXT NOT NULL DEFAULT '';
