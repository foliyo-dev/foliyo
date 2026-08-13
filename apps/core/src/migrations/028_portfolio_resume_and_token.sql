-- Optional resume link for a "Download resume" button on the public portfolio,
-- and an unguessable access token for sharing a portfolio privately (independent
-- of is_public — token possession alone grants access, like a private link).
ALTER TABLE portfolios ADD COLUMN resume_id TEXT;
ALTER TABLE portfolios ADD COLUMN access_token TEXT;
