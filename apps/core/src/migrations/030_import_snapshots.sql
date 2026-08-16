-- Undo points for resume import: library state before apply (stored as .fio on disk).

CREATE TABLE IF NOT EXISTS import_snapshots (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label        TEXT NOT NULL DEFAULT '',
    filename     TEXT NOT NULL,
    content_hash TEXT NOT NULL DEFAULT '',
    byte_size    INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_import_snapshots_user_created
  ON import_snapshots (user_id, created_at DESC);
