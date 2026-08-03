CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email        TEXT NOT NULL UNIQUE,
    email_enc    TEXT,
    password     TEXT NOT NULL,
    handle       TEXT UNIQUE,
    plan         TEXT NOT NULL DEFAULT 'free',
    plan_expires DATETIME,
    mode         TEXT NOT NULL DEFAULT 'active',
    dek_encrypted TEXT,
    dek_nonce    TEXT,
    onboarding_complete INTEGER DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
