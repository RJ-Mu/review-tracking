-- ============================================================
-- review-tracking : database schema
-- Target: PostgreSQL (database "reviewdb")
-- Run with: psql -h localhost -U postgres -d reviewdb -f schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- categories
-- A category groups entries that share the same set of
-- category-specific columns, e.g. "Movies", "Restaurants".
-- ------------------------------------------------------------
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- category_columns
-- The "rulebook": defines which extra columns each category
-- has, and what type each one is. This is what the app reads
-- to know what fields to show and how to validate them.
-- ------------------------------------------------------------
CREATE TABLE category_columns (
    id           SERIAL PRIMARY KEY,
    category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    data_type    TEXT NOT NULL CHECK (data_type IN ('text','number','boolean','date')),
    position     INTEGER NOT NULL DEFAULT 0,   -- column ordering in the table view
    UNIQUE (category_id, name)
);

-- ------------------------------------------------------------
-- entries
-- One review. Shared base columns are real columns; the
-- category-specific values live in the JSONB "data" column,
-- validated by the app against category_columns.
-- ------------------------------------------------------------
CREATE TABLE entries (
    id           SERIAL PRIMARY KEY,
    category_id  INTEGER NOT NULL REFERENCES categories(id),
    title        TEXT NOT NULL,
    rating       NUMERIC CHECK (rating >= 0 AND rating <= 10),
    notes        TEXT,
    reviewed_on  DATE,
    is_hidden    BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    data         JSONB NOT NULL DEFAULT '{}'::jsonb   -- category-specific values
);

-- Indexes (speed only, not correctness). Revisit later.
CREATE INDEX idx_entries_category ON entries (category_id);          -- filter by category
CREATE INDEX idx_entries_data ON entries USING GIN (data);           -- search inside JSONB
