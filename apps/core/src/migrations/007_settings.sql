CREATE TABLE IF NOT EXISTS settings (
    id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_title       TEXT NOT NULL DEFAULT 'My Portfolio',
    site_description TEXT NOT NULL DEFAULT '',
    theme_slug       TEXT NOT NULL DEFAULT 'minimal',
    resume_theme     TEXT NOT NULL DEFAULT 'classic',
    custom_domain    TEXT NOT NULL DEFAULT '',
    seo_keywords     TEXT NOT NULL DEFAULT '',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
