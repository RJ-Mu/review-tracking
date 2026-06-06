// SQLite schema (ported from the PostgreSQL reference in repo root).
// Kept as a JS string export so it imports reliably inside the worker.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    parent_id   INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    is_hidden   INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (parent_id, name)
);

CREATE TABLE IF NOT EXISTS category_columns (
    id           INTEGER PRIMARY KEY,
    category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    data_type    TEXT NOT NULL CHECK (data_type IN ('text','number','boolean','date')),
    position     INTEGER NOT NULL DEFAULT 0,
    UNIQUE (category_id, name)
);

CREATE TABLE IF NOT EXISTS entries (
    id           INTEGER PRIMARY KEY,
    category_id  INTEGER NOT NULL REFERENCES categories(id),
    title        TEXT NOT NULL,
    rating       REAL CHECK (rating >= 0 AND rating <= 10),
    notes        TEXT,
    reviewed_on  TEXT,
    is_hidden    INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    data         TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_entries_category ON entries (category_id);

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);
`;