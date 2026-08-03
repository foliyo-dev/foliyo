CREATE TABLE IF NOT EXISTS resumes (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    theme_slug   TEXT NOT NULL DEFAULT 'classic',
    is_public    INTEGER NOT NULL DEFAULT 0,
    share_token  TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(8)))),
    view_count   INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resume_views (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    resume_id  TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    country    TEXT,
    city       TEXT,
    referrer   TEXT,
    device     TEXT,
    viewed_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
