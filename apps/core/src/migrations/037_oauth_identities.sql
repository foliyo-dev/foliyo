-- OAuth identities + nullable passwords for OAuth-only accounts.

-- foliyo:sqlite-only
PRAGMA foreign_keys=OFF;

CREATE TABLE users_new (
    id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email                 TEXT NOT NULL UNIQUE,
    email_enc             TEXT,
    password              TEXT,
    handle                TEXT UNIQUE,
    plan                  TEXT NOT NULL DEFAULT 'free',
    plan_expires          DATETIME,
    mode                  TEXT NOT NULL DEFAULT 'active',
    dek_encrypted         TEXT,
    dek_nonce             TEXT,
    onboarding_complete   INTEGER DEFAULT 0,
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    email_verified        INTEGER NOT NULL DEFAULT 0,
    email_verify_token    TEXT,
    email_verify_expires  DATETIME,
    welcome_email_sent    INTEGER NOT NULL DEFAULT 0,
    password_reset_token  TEXT,
    password_reset_expires DATETIME,
    handle_changed_at     DATETIME,
    is_staff              INTEGER NOT NULL DEFAULT 0
);

INSERT INTO users_new (
    id, email, email_enc, password, handle, plan, plan_expires, mode,
    dek_encrypted, dek_nonce, onboarding_complete, created_at, updated_at,
    email_verified, email_verify_token, email_verify_expires, welcome_email_sent,
    password_reset_token, password_reset_expires, handle_changed_at, is_staff
)
SELECT
    id, email, email_enc, password, handle, plan, plan_expires, mode,
    dek_encrypted, dek_nonce, onboarding_complete, created_at, updated_at,
    email_verified, email_verify_token, email_verify_expires, welcome_email_sent,
    password_reset_token, password_reset_expires, handle_changed_at, is_staff
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

PRAGMA foreign_keys=ON;
-- foliyo:end

-- foliyo:postgres-only
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
-- foliyo:end

CREATE TABLE IF NOT EXISTS oauth_identities (
    id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          TEXT NOT NULL,
    provider_user_id  TEXT NOT NULL,
    email             TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_user ON oauth_identities(user_id);
