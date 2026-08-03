-- Certifications as a first-class content-library entity (separate from education).
CREATE TABLE IF NOT EXISTS certifications (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    issuer        TEXT NOT NULL DEFAULT '',
    credential_id TEXT NOT NULL DEFAULT '',
    credential_url TEXT NOT NULL DEFAULT '',
    issued_at     TEXT,
    expires_at    TEXT,
    description   TEXT NOT NULL DEFAULT '',
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portfolio_certifications (
    portfolio_id     TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    certification_id TEXT NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, certification_id)
);

-- Section visibility toggle on public profiles (SQLite: ADD COLUMN is idempotent enough via migration once).
ALTER TABLE portfolios ADD COLUMN show_certifications INTEGER NOT NULL DEFAULT 1;
