-- Saved JD analyses so refresh / reopen does not spend another AI unit.

CREATE TABLE IF NOT EXISTS job_analyses (
    id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jd_hash                TEXT NOT NULL,
    jd_text                TEXT NOT NULL,
    title                  TEXT,
    company                TEXT,
    location               TEXT,
    parse                  TEXT NOT NULL DEFAULT 'heuristic',
    enhanced               INTEGER NOT NULL DEFAULT 0,
    fit                    TEXT NOT NULL DEFAULT 'unknown',
    required_total         INTEGER NOT NULL DEFAULT 0,
    required_in_library    INTEGER NOT NULL DEFAULT 0,
    required_on_resume     INTEGER NOT NULL DEFAULT 0,
    portfolio_id           TEXT REFERENCES portfolios(id) ON DELETE SET NULL,
    resume_id              TEXT REFERENCES resumes(id) ON DELETE SET NULL,
    analysis_json          TEXT NOT NULL,
    accepted_json          TEXT,
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_analyses_user_hash
  ON job_analyses (user_id, jd_hash);

CREATE INDEX IF NOT EXISTS idx_job_analyses_user_updated
  ON job_analyses (user_id, updated_at DESC);
