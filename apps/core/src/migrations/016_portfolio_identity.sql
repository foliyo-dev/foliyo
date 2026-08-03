-- Portfolio-level identity overrides (empty = fall back to Basics/profile).
ALTER TABLE portfolios ADD COLUMN headline TEXT NOT NULL DEFAULT '';
ALTER TABLE portfolios ADD COLUMN bio TEXT NOT NULL DEFAULT '';
