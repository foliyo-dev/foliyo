-- Per-resume section order for theme rendering (JSON array of section keys).
ALTER TABLE resumes ADD COLUMN section_order TEXT NOT NULL DEFAULT '["skills","projects","experience","education","certifications","languages"]';
