-- Optional project date range for portfolio build-log timelines (YYYY or YYYY-MM).
ALTER TABLE projects ADD COLUMN start_date TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN end_date TEXT;
