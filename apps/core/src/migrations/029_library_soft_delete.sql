-- Soft-delete for library content (restoreable trash).

ALTER TABLE skills ADD COLUMN deleted_at DATETIME;
ALTER TABLE projects ADD COLUMN deleted_at DATETIME;
ALTER TABLE experience ADD COLUMN deleted_at DATETIME;
ALTER TABLE education ADD COLUMN deleted_at DATETIME;
ALTER TABLE certifications ADD COLUMN deleted_at DATETIME;
ALTER TABLE languages ADD COLUMN deleted_at DATETIME;
ALTER TABLE social_links ADD COLUMN deleted_at DATETIME;

-- Active skill names must ignore soft-deleted rows (same idea as dismissed).
DROP INDEX IF EXISTS skills_user_name_lower_active;
CREATE UNIQUE INDEX IF NOT EXISTS skills_user_name_lower_active
  ON skills (user_id, lower(name))
  WHERE status != 'dismissed' AND deleted_at IS NULL;
