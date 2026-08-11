-- Resume-owned content snapshots (decoupled from live portfolio junctions).
-- portfolio_id becomes optional "seeded from" metadata (ON DELETE SET NULL).

-- foliyo:sqlite-only
PRAGMA foreign_keys=OFF;

CREATE TABLE resumes_new (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    portfolio_id TEXT REFERENCES portfolios(id) ON DELETE SET NULL,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    theme_slug   TEXT NOT NULL DEFAULT 'classic',
    is_public    INTEGER NOT NULL DEFAULT 0,
    share_token  TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(8)))),
    view_count   INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO resumes_new (
    id, portfolio_id, user_id, name, theme_slug, is_public, share_token, view_count, created_at, updated_at
)
SELECT
    id, portfolio_id, user_id, name, theme_slug, is_public, share_token, view_count, created_at, updated_at
FROM resumes;

DROP TABLE resumes;
ALTER TABLE resumes_new RENAME TO resumes;

PRAGMA foreign_keys=ON;
-- foliyo:end

-- foliyo:postgres-only
ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_portfolio_id_fkey;
ALTER TABLE resumes ALTER COLUMN portfolio_id DROP NOT NULL;
ALTER TABLE resumes ADD CONSTRAINT resumes_portfolio_id_fkey
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE SET NULL;
-- foliyo:end

CREATE TABLE IF NOT EXISTS resume_skills (
    resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    skill_id  TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (resume_id, skill_id)
);

CREATE TABLE IF NOT EXISTS resume_projects (
    resume_id  TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (resume_id, project_id)
);

CREATE TABLE IF NOT EXISTS resume_experience (
    resume_id     TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    experience_id TEXT NOT NULL REFERENCES experience(id) ON DELETE CASCADE,
    PRIMARY KEY (resume_id, experience_id)
);

CREATE TABLE IF NOT EXISTS resume_education (
    resume_id    TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    education_id TEXT NOT NULL REFERENCES education(id) ON DELETE CASCADE,
    PRIMARY KEY (resume_id, education_id)
);

CREATE TABLE IF NOT EXISTS resume_certifications (
    resume_id         TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    certification_id  TEXT NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
    PRIMARY KEY (resume_id, certification_id)
);

CREATE TABLE IF NOT EXISTS resume_languages (
    resume_id   TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    language_id TEXT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    PRIMARY KEY (resume_id, language_id)
);

INSERT OR IGNORE INTO resume_skills (resume_id, skill_id)
SELECT r.id, ps.skill_id
FROM resumes r
JOIN portfolio_skills ps ON ps.portfolio_id = r.portfolio_id
WHERE r.portfolio_id IS NOT NULL;

INSERT OR IGNORE INTO resume_projects (resume_id, project_id)
SELECT r.id, pp.project_id
FROM resumes r
JOIN portfolio_projects pp ON pp.portfolio_id = r.portfolio_id
WHERE r.portfolio_id IS NOT NULL;

INSERT OR IGNORE INTO resume_experience (resume_id, experience_id)
SELECT r.id, pe.experience_id
FROM resumes r
JOIN portfolio_experience pe ON pe.portfolio_id = r.portfolio_id
WHERE r.portfolio_id IS NOT NULL;

INSERT OR IGNORE INTO resume_education (resume_id, education_id)
SELECT r.id, pe.education_id
FROM resumes r
JOIN portfolio_education pe ON pe.portfolio_id = r.portfolio_id
WHERE r.portfolio_id IS NOT NULL;

INSERT OR IGNORE INTO resume_certifications (resume_id, certification_id)
SELECT r.id, pc.certification_id
FROM resumes r
JOIN portfolio_certifications pc ON pc.portfolio_id = r.portfolio_id
WHERE r.portfolio_id IS NOT NULL;

INSERT OR IGNORE INTO resume_languages (resume_id, language_id)
SELECT r.id, pl.language_id
FROM resumes r
JOIN portfolio_languages pl ON pl.portfolio_id = r.portfolio_id
WHERE r.portfolio_id IS NOT NULL;
