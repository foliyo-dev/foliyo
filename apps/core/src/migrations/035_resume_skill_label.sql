-- ATS display override: JD surface term for this resume's skill chip (library name stays unchanged).
ALTER TABLE resume_skills ADD COLUMN label TEXT NOT NULL DEFAULT '';
