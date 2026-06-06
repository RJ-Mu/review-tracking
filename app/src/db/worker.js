import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let db = null;

async function initDb() {
  const sqlite3 = await sqlite3InitModule();
  // SAH-pool VFS: persists on-device, no special HTTP headers needed.
  const poolUtil = await sqlite3.installOpfsSAHPoolVfs({});
  db = new poolUtil.OpfsSAHPoolDb('/review.sqlite3');
}

// Start init immediately; every query waits on it.
const ready = initDb();

self.onmessage = async (event) => {
  const { id, sql, params } = event.data;
  try {
    await ready;
    const rows = db.exec({
      sql,
      bind: params || [],
      rowMode: 'object',          // each row comes back as { column: value }
      resultRows: [],
      returnValue: 'resultRows',  // return the rows array
    });
    self.postMessage({ id, rows });
  } catch (err) {
    self.postMessage({ id, error: err.message || String(err) });
  }
};