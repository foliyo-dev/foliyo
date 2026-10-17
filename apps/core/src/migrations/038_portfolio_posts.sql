-- Attach published blog posts to a portfolio (library → portfolio selection).
CREATE TABLE IF NOT EXISTS portfolio_posts (
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    post_id      TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (portfolio_id, post_id)
);

ALTER TABLE portfolios ADD COLUMN show_posts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE portfolios ADD COLUMN posts_title TEXT NOT NULL DEFAULT '';
