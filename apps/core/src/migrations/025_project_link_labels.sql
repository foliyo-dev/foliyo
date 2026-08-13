-- Optional labels for the three existing project URLs (empty = Live / Repo / View write-up).
ALTER TABLE projects ADD COLUMN url_label TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN repo_url_label TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN article_url_label TEXT NOT NULL DEFAULT '';

-- Same for experience write-up links (empty = View write-up).
ALTER TABLE experience ADD COLUMN article_url_label TEXT NOT NULL DEFAULT '';
