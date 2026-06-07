// api.js — the only module that writes SQL. Everything else (UI,
// import/export) calls these functions. Keeping the SQL contained here
// is also what lets a future cloud-sync layer slot in behind this seam.

import { query, execute } from './client.js';

// --- Categories ----------------------------------------------------------

// Ported from add_category, plus parentId for subcategories (null = top
// level). Uses RETURNING id, same as the Postgres version.
export async function addCategory(name, parentId = null) {
  const rows = await query(
    `INSERT INTO categories (name, parent_id) VALUES (?, ?) RETURNING id`,
    [name, parentId]
  );
  return rows[0].id;
}

export async function addCategoryColumn(categoryId, name, dataType, position = 0) {
  const rows = await query(
    `INSERT INTO category_columns (category_id, name, data_type, position)
     VALUES (?, ?, ?, ?) RETURNING id`,
    [categoryId, name, dataType, position]
  );
  return rows[0].id;
}

// Ported from get_category_id. Names are now unique per-parent, not
// globally, so this returns the first match; the UI uses ids directly.
export async function getCategoryId(name) {
  const rows = await query(
    `SELECT id FROM categories WHERE name = ? LIMIT 1`,
    [name]
  );
  return rows.length ? rows[0].id : null;
}

// Ported from get_categories. Now returns parent_id + is_hidden so the UI
// can build the tree, and hides hidden categories unless asked.
export async function getCategories(includeHidden = false) {
  const where = includeHidden ? '' : 'WHERE is_hidden = 0';
  return query(
    `SELECT id, name, parent_id, is_hidden
     FROM categories ${where} ORDER BY id`
  );
}

// New (req 7.3): hide/show a category without deleting its data.
export async function setCategoryHidden(categoryId, hidden) {
  return execute(
    `UPDATE categories SET is_hidden = ? WHERE id = ?`,
    [hidden ? 1 : 0, categoryId]
  );
}

// Ported from get_category_columns; ordered by the position field.
export async function getCategoryColumns(categoryId) {
  return query(
    `SELECT name, data_type, position
     FROM category_columns WHERE category_id = ? ORDER BY position, id`,
    [categoryId]
  );
}

// --- Entries -------------------------------------------------------------

// Ported from add_entry, with notes added (it's a base column). `data` is a
// plain JS object of the category-specific values; JSON.stringify is the
// JS equivalent of json.dumps for the TEXT 'data' column.
export async function addEntry(categoryId, title, rating, notes, reviewedOn, data = {}) {
  const rows = await query(
    `INSERT INTO entries (category_id, title, rating, notes, reviewed_on, data)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    [categoryId, title, rating, notes, reviewedOn, JSON.stringify(data)]
  );
  return rows[0].id;
}

// Ported from get_entry. SQLite returns 'data' as a TEXT string, so unlike
// Postgres JSONB (which psycopg2 auto-parsed) we JSON.parse it ourselves.
export async function getEntry(entryId) {
  const rows = await query(`SELECT * FROM entries WHERE id = ?`, [entryId]);
  if (!rows.length) return null;
  const entry = rows[0];
  entry.data = JSON.parse(entry.data);
  return entry;
}

// Ported from get_category_entries. 'NOT is_hidden' becomes 'is_hidden = 0';
// data parsed per row.
export async function getCategoryEntries(categoryId) {
  const rows = await query(
    `SELECT id, title, rating, notes, reviewed_on, data
     FROM entries
     WHERE category_id = ? AND is_hidden = 0
     ORDER BY id`,
    [categoryId]
  );
  return rows.map((r) => ({ ...r, data: JSON.parse(r.data) }));
}

const BASE_COLUMNS = ['title', 'rating', 'notes', 'reviewed_on', 'is_hidden'];

// Build a safe JSON path for a key, e.g. 'year' -> $."year".
// JSON.stringify quotes and escapes the key so spaces/quotes can't break it.
function jsonPath(key) {
  return '$.' + JSON.stringify(key);
}

// Ported from update_entry — the important one. A base column is a real
// table column (its NAME goes into the SQL, safely, because it's whitelisted
// against BASE_COLUMNS). A category column is a KEY inside the JSON 'data'
// bag, edited with SQLite's json_set (your jsonb_set). Unknown column throws,
// exactly like the Python ValueError. We also bump updated_at on every edit
// (the Postgres version didn't — this is the small fix that keeps updated_at
// honest for the future sync layer).
export async function updateEntry(entryId, columnName, value) {
  if (BASE_COLUMNS.includes(columnName)) {
    return execute(
      `UPDATE entries SET ${columnName} = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [value, entryId]
    );
  }

  // Not a base column: is it a valid category column for THIS entry's category?
  const cols = await query(
    `SELECT cc.name
     FROM category_columns cc
     JOIN entries e ON e.category_id = cc.category_id
     WHERE e.id = ?`,
    [entryId]
  );
  const valid = cols.map((c) => c.name);

  if (valid.includes(columnName)) {
    return execute(
      `UPDATE entries
       SET data = json_set(data, ?, ?), updated_at = datetime('now')
       WHERE id = ?`,
      [jsonPath(columnName), value, entryId]
    );
  }

  throw new Error(`Unknown column: ${columnName}`);
}

// Ported from delete_entry.
export async function deleteEntry(entryId) {
  return execute(`DELETE FROM entries WHERE id = ?`, [entryId]);
}

// New (req 6.1.1): delete several rows at once.
export async function deleteEntries(ids) {
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(', ');
  return execute(`DELETE FROM entries WHERE id IN (${placeholders})`, ids);
}