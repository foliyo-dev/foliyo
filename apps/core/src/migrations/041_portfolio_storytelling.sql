-- Developer-site storytelling: project layout modes + opt-in skill levels on public folios.
-- Existing portfolios keep cards + levels off; create API defaults to featured_timeline.
ALTER TABLE portfolios ADD COLUMN projects_layout TEXT NOT NULL DEFAULT 'cards';
ALTER TABLE portfolios ADD COLUMN show_skill_levels INTEGER NOT NULL DEFAULT 0;
ALTER TABLE portfolios ADD COLUMN hero_cta_primary TEXT NOT NULL DEFAULT '';
ALTER TABLE portfolios ADD COLUMN hero_cta_secondary TEXT NOT NULL DEFAULT '';
