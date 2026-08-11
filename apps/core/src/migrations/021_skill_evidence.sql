-- Evidence-lite skills: source/status, experience tags, evidence links.
-- Existing skills become manual + confirmed.

ALTER TABLE skills ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE skills ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed';

ALTER TABLE experience ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS skill_evidence (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    skill_id    TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id   TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skill_id, source_type, source_id)
);
