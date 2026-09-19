-- Global skill ontology (shared). User library skills stay in `skills` with optional bridge.
CREATE TABLE IF NOT EXISTS global_skills (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    canonical_name  TEXT NOT NULL,
    normalized_key  TEXT NOT NULL UNIQUE,
    category        TEXT NOT NULL DEFAULT 'general',
    embedding_model TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skill_aliases (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    skill_id   TEXT NOT NULL REFERENCES global_skills(id) ON DELETE CASCADE,
    alias      TEXT NOT NULL UNIQUE,
    source     TEXT NOT NULL DEFAULT 'manual',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skill_aliases_skill ON skill_aliases (skill_id);

-- Confusable / related-but-distinct guards.
-- Either (skill_id_a, skill_id_b) pair OR (normalized_term → blocked_skill_id).
CREATE TABLE IF NOT EXISTS skill_blocklist (
    id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    skill_id_a        TEXT REFERENCES global_skills(id) ON DELETE CASCADE,
    skill_id_b        TEXT REFERENCES global_skills(id) ON DELETE CASCADE,
    normalized_term   TEXT,
    blocked_skill_id  TEXT REFERENCES global_skills(id) ON DELETE CASCADE,
    reason            TEXT NOT NULL DEFAULT '',
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skill_review_queue (
    id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    raw_term            TEXT NOT NULL,
    normalized_key      TEXT NOT NULL,
    candidate_skill_id  TEXT REFERENCES global_skills(id) ON DELETE SET NULL,
    similarity_score    REAL,
    llm_verdict         TEXT,
    status              TEXT NOT NULL DEFAULT 'pending',
    source              TEXT NOT NULL DEFAULT 'jd',
    user_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skill_review_status ON skill_review_queue (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_review_key ON skill_review_queue (normalized_key);

CREATE TABLE IF NOT EXISTS match_log (
    id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
    source            TEXT NOT NULL DEFAULT 'jd',
    raw_term          TEXT NOT NULL,
    normalized_key    TEXT,
    matched_skill_id  TEXT REFERENCES global_skills(id) ON DELETE SET NULL,
    match_type        TEXT NOT NULL DEFAULT 'unresolved',
    score             REAL,
    user_action       TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_match_log_type ON match_log (match_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_log_key ON match_log (normalized_key);

ALTER TABLE skills ADD COLUMN canonical_skill_id TEXT REFERENCES global_skills(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN is_staff INTEGER NOT NULL DEFAULT 0;
