import { query } from './db/client.js';

const app = document.querySelector('#app');

async function smokeTest() {
  await query(`CREATE TABLE IF NOT EXISTS smoke (
    id INTEGER PRIMARY KEY,
    ts TEXT
  )`);
  // Insert one row per page load, stamped with the current time.
  await query(`INSERT INTO smoke (ts) VALUES (?)`, [new Date().toISOString()]);
  const rows = await query(`SELECT * FROM smoke ORDER BY id`);
  render(rows);
}

function render(rows) {
  app.innerHTML = `
    <h1>SQLite-WASM smoke test</h1>
    <p>Rows stored: <strong>${rows.length}</strong></p>
    <p>Refresh the page — this number should climb by one each time
       and survive the refresh. That proves the data is persisting on-device.</p>
    <ul>${rows.map((r) => `<li>#${r.id} — ${r.ts}</li>`).join('')}</ul>
  `;
}

smokeTest().catch((err) => {
  app.innerHTML = `<h1>Error</h1><pre style="color:red">${err.message}</pre>`;
});