-- Email verification for hosted signup (self-host / existing users grandfathered verified).
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verify_token TEXT;
ALTER TABLE users ADD COLUMN email_verify_expires DATETIME;
ALTER TABLE users ADD COLUMN welcome_email_sent INTEGER NOT NULL DEFAULT 0;

-- Existing accounts (self-host admin, demos, early cloud users) skip the verify gate.
UPDATE users SET email_verified = 1;
