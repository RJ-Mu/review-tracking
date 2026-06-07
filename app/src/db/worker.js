import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { SCHEMA_SQL as schemaSql } from './schema.js';

const SCHEMA_VERSION = 1;

let db = null;

async function initDb() {
  const sqlite3 = await sqlite3InitModule();
  const poolUtil = await sqlite3.installOpfsSAHPoolVfs({});
  db = new poolUtil.OpfsSAHPoolDb('/review-v2.sqlite3');

  db.exec('PRAGMA foreign_keys = ON');

  const existing = db.exec({
    sql: `SELECT name FROM sqlite_master
          WHERE type='table' AND name='schema_version'`,
    rowMode: 'object',
    resultRows: [],
    returnValue: 'resultRows',
  });

  if (existing.length === 0) {
    db.exec(schemaSql);
    db.exec({ sql: 'INSERT INTO schema_version (version) VALUES (?)',
              bind: [SCHEMA_VERSION] });
  }
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
    // changes() = rows affected by the most recent INSERT/UPDATE/DELETE,
    // the SQLite equivalent of psycopg2's cur.rowcount.
    const changes = db.changes();
    self.postMessage({ id, rows, changes });
  } catch (err) {
    self.postMessage({ id, error: err.message || String(err) });
  }
};