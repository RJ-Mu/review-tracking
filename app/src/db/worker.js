import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { SCHEMA_SQL as schemaSql } from './schema.js';

const SCHEMA_VERSION = 3;

let db = null;

async function initDb() {
    const sqlite3 = await sqlite3InitModule();
    const poolUtil = await sqlite3.installOpfsSAHPoolVfs({});
    db = new poolUtil.OpfsSAHPoolDb('/review-v5.sqlite3');

    db.exec('PRAGMA foreign_keys = ON');

    const hasVersionTable = db.exec({
        sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`,
        rowMode: 'object',
        resultRows: [],
        returnValue: 'resultRows',
    });

    if (hasVersionTable.length === 0) {
        // Fresh database: create everything at the current version.
        db.exec(schemaSql);
        db.exec({ sql: 'INSERT INTO schema_version (version) VALUES (?)', bind: [SCHEMA_VERSION] });
    } else {
        // Existing database: read its version and migrate forward step by step.
        const verRows = db.exec({
            sql: 'SELECT version FROM schema_version LIMIT 1',
            rowMode: 'object',
            resultRows: [],
            returnValue: 'resultRows',
        });
        let current = verRows.length ? verRows[0].version : 1;

        // --- migration to v3: add the settings table ---
        if (current < 3) {
            db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
            current = 3;
        }
        // future migrations: if (current < 4) { ...; current = 4; }

        db.exec({ sql: 'UPDATE schema_version SET version = ?', bind: [current] });
    }
}

const ready = initDb();

self.onmessage = async(event) => {
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