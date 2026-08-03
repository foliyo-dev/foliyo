CREATE TABLE IF NOT EXISTS portfolios (
    id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    slug           TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    theme_slug     TEXT NOT NULL DEFAULT 'minimal',
    is_public      INTEGER NOT NULL DEFAULT 0,
    is_default     INTEGER NOT NULL DEFAULT 0,
    show_skills    INTEGER NOT NULL DEFAULT 1,
    show_projects  INTEGER NOT NULL DEFAULT 1,
    show_experience INTEGER NOT NULL DEFAULT 1,
    show_education INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolios_default
ON portfolios(user_id) WHERE is_default = 1;

CREATE TABLE IF NOT EXISTS portfolio_skills (
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    skill_id     TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, skill_id)
);

CREATE TABLE IF NOT EXISTS portfolio_projects (
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, project_id)
);

CREATE TABLE IF NOT EXISTS portfolio_experience (
    portfolio_id  TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    experience_id TEXT NOT NULL REFERENCES experience(id) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, experience_id)
);

CREATE TABLE IF NOT EXISTS portfolio_education (
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    education_id TEXT NOT NULL REFERENCES education(id) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, education_id)
);
