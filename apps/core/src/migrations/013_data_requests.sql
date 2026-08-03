CREATE TABLE IF NOT EXISTS data_requests (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);
