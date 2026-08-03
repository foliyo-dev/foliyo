-- Spoken / written languages as a first-class content-library entity.
CREATE TABLE IF NOT EXISTS languages (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    proficiency TEXT NOT NULL DEFAULT 'conversational', -- native | fluent | conversational | basic
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portfolio_languages (
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    language_id  TEXT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, language_id)
);

ALTER TABLE portfolios ADD COLUMN show_languages INTEGER NOT NULL DEFAULT 1;
