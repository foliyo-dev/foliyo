-- Per-user library of uploaded media URLs (project images, covers, theme assets).
CREATE TABLE IF NOT EXISTS media_assets (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_media_assets_user ON media_assets(user_id);
