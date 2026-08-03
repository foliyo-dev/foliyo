CREATE TABLE IF NOT EXISTS profile (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL DEFAULT '',
    headline     TEXT NOT NULL DEFAULT '',
    bio          TEXT NOT NULL DEFAULT '',
    avatar_url   TEXT NOT NULL DEFAULT '',
    location     TEXT NOT NULL DEFAULT '',
    email        TEXT NOT NULL DEFAULT '',
    website      TEXT NOT NULL DEFAULT '',
    github       TEXT NOT NULL DEFAULT '',
    linkedin     TEXT NOT NULL DEFAULT '',
    twitter      TEXT NOT NULL DEFAULT '',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
