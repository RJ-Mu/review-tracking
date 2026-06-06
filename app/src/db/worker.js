import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { SCHEMA_SQL as schemaSql } from './schema.js';

const SCHEMA_VERSION = 1;

let db = null;

async function initDb() {
  const sqlite3 = await sqlite3InitModule();
  const poolUtil = await sqlite3.installOpfsSAHPoolVfs({});
  db = new poolUtil.OpfsSAHPoolDb('/review-v2.sqlite3');

  // SQLite does NOT enforce foreign keys unless asked, per-connection.
  db.exec('PRAGMA foreign_keys = ON');

  // Fresh-DB detection: has the schema_version table been created yet?
  const existing = db.exec({
    sql: `SELECT name FROM sqlite_master
          WHERE type='table' AND name='schema_version'`,
    rowMode: 'object',
    resultRows: [],
    returnValue: 'resultRows',
  });

  if (existing.length === 0) {
    // Fresh database: create everything, then record the version.
    db.exec(schemaSql);
    db.exec({ sql: 'INSERT INTO schema_version (version) VALUES (?)',
              bind: [SCHEMA_VERSION] });
  }
  // If schema_version already exists, this DB is initialized — do nothing.
  // (Future migrations will read the stored version and act on it here.)
}

const ready = initDb();

self.onmessage = async (event) => {
  const { id, sql, params } = event.data;
  try {
    await ready;
    const rows = db.exec({
      sql,
      bind: params || [],
      rowMode: 'object',
      resultRows: [],
      returnValue: 'resultRows',
    });
    self.postMessage({ id, rows });
  } catch (err) {
    self.postMessage({ id, error: err.message || String(err) });
  }
};