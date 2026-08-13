-- Tracks when the handle was last set, so cloud can enforce a change cooldown.
ALTER TABLE users ADD COLUMN handle_changed_at DATETIME;
