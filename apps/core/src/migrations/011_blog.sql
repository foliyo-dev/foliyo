CREATE TABLE IF NOT EXISTS blog_posts (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    slug         TEXT NOT NULL,
    content      TEXT NOT NULL DEFAULT '',
    excerpt      TEXT NOT NULL DEFAULT '',
    cover_image  TEXT NOT NULL DEFAULT '',
    tags         TEXT NOT NULL DEFAULT '[]',
    status       TEXT NOT NULL DEFAULT 'draft',
    published_at DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, slug)
);
