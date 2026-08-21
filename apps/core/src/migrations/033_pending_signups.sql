-- Pending email-first signups. No users row until verify sets the password.
CREATE TABLE IF NOT EXISTS pending_signups (
    email       TEXT NOT NULL,
    token_hash  TEXT NOT NULL UNIQUE,
    consent_ip  TEXT NOT NULL DEFAULT '',
    consent_ua  TEXT NOT NULL DEFAULT '',
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_signups_email_lower
  ON pending_signups (lower(email));

-- foliyo:sqlite-only
UPDATE users SET email = lower(email) WHERE email != lower(email);
-- foliyo:end

-- foliyo:postgres-only
UPDATE users SET email = lower(email) WHERE email IS DISTINCT FROM lower(email);
-- foliyo:end

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email));

-- Outstanding plaintext reset tokens are unusable after hashing; force a new request.
UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL;
