-- Per-resume headline / professional summary (tailor overrides folio/profile).
ALTER TABLE resumes ADD COLUMN headline TEXT NOT NULL DEFAULT '';
ALTER TABLE resumes ADD COLUMN bio TEXT NOT NULL DEFAULT '';
