-- Foliyo Resume Spec: manual applications tracker + ATS partner keys + status events

CREATE TABLE IF NOT EXISTS applications (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id       TEXT REFERENCES resumes(id) ON DELETE SET NULL,
    company         TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT '',
    job_id          TEXT,
    ats             TEXT,
    status          TEXT NOT NULL DEFAULT 'application_received',
    next_step       TEXT,
    notes           TEXT,
    source          TEXT NOT NULL DEFAULT 'manual', -- manual | ats
    applied_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_resume ON applications(resume_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(user_id, job_id);

CREATE TABLE IF NOT EXISTS application_events (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    event           TEXT NOT NULL,
    status          TEXT,
    payload_json    TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_application_events_app ON application_events(application_id);

CREATE TABLE IF NOT EXISTS ats_partners (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    api_key_hash    TEXT NOT NULL UNIQUE,
    hmac_secret     TEXT NOT NULL,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
