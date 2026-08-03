-- Optional write-up / article URLs (Foliyo blog later, or any external post).
ALTER TABLE projects ADD COLUMN article_url TEXT NOT NULL DEFAULT '';
ALTER TABLE experience ADD COLUMN article_url TEXT NOT NULL DEFAULT '';
