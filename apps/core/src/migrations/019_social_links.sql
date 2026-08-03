-- Social / presence links as a first-class content-library entity.
CREATE TABLE IF NOT EXISTS social_links (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL,
    label       TEXT NOT NULL DEFAULT '',
    value       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_social_links_user ON social_links(user_id);

-- Migrate legacy profile columns into social_links (once).
INSERT INTO social_links (user_id, provider, value, sort_order)
SELECT user_id, 'website', website, 0
FROM profile
WHERE TRIM(COALESCE(website, '')) != ''
  AND NOT EXISTS (
    SELECT 1 FROM social_links s WHERE s.user_id = profile.user_id AND s.provider = 'website'
  );

INSERT INTO social_links (user_id, provider, value, sort_order)
SELECT user_id, 'github', github, 1
FROM profile
WHERE TRIM(COALESCE(github, '')) != ''
  AND NOT EXISTS (
    SELECT 1 FROM social_links s WHERE s.user_id = profile.user_id AND s.provider = 'github'
  );

INSERT INTO social_links (user_id, provider, value, sort_order)
SELECT user_id, 'linkedin', linkedin, 2
FROM profile
WHERE TRIM(COALESCE(linkedin, '')) != ''
  AND NOT EXISTS (
    SELECT 1 FROM social_links s WHERE s.user_id = profile.user_id AND s.provider = 'linkedin'
  );

INSERT INTO social_links (user_id, provider, value, sort_order)
SELECT user_id, 'twitter', twitter, 3
FROM profile
WHERE TRIM(COALESCE(twitter, '')) != ''
  AND NOT EXISTS (
    SELECT 1 FROM social_links s WHERE s.user_id = profile.user_id AND s.provider = 'twitter'
  );
