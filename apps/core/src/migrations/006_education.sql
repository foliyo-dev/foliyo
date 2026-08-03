CREATE TABLE IF NOT EXISTS education (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution TEXT NOT NULL,
    degree      TEXT NOT NULL DEFAULT '',
    field       TEXT NOT NULL DEFAULT '',
    start_date  TEXT NOT NULL,
    end_date    TEXT,
    description TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
