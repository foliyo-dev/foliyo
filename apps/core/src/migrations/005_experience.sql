CREATE TABLE IF NOT EXISTS experience (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company     TEXT NOT NULL,
    role        TEXT NOT NULL,
    location    TEXT NOT NULL DEFAULT '',
    start_date  TEXT NOT NULL,
    end_date    TEXT,
    description TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
