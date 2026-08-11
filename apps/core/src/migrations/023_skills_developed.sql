-- Rename library skill tags → skills_developed; extend edu/certs; skill recency.
-- Safe to re-run: migrate runner ignores duplicate-column / missing-column ALTER errors.

ALTER TABLE projects RENAME COLUMN tags TO skills_developed;
ALTER TABLE experience RENAME COLUMN tags TO skills_developed;

ALTER TABLE education ADD COLUMN skills_developed TEXT NOT NULL DEFAULT '[]';
ALTER TABLE certifications ADD COLUMN skills_developed TEXT NOT NULL DEFAULT '[]';

ALTER TABLE skills ADD COLUMN recency TEXT NOT NULL DEFAULT 'current';
-- recency: 'current' | 'past'

-- Collapse case-insensitive duplicate active skills (keep oldest rowid) before unique index.
-- Junction rows (portfolio_skills / resume_skills / skill_evidence) cascade on delete.
DELETE FROM skills
WHERE status != 'dismissed'
  AND rowid NOT IN (
    SELECT MIN(rowid)
    FROM skills
    WHERE status != 'dismissed'
    GROUP BY user_id, lower(name)
  );

-- One active skill name per user (case-insensitive). Dismissed names may be re-added later as new rows.
CREATE UNIQUE INDEX IF NOT EXISTS skills_user_name_lower_active
  ON skills (user_id, lower(name))
  WHERE status != 'dismissed';
