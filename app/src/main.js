import { query } from './db/client.js';

const app = document.querySelector('#app');

async function verifySchema() {
  // List the tables that exist, and the version we stamped.
  const tables = await query(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  );
  const version = await query(`SELECT version FROM schema_version`);

  app.innerHTML = `
    <h1>Schema check</h1>
    <p>Schema version: <strong>${version[0]?.version ?? '(none)'}</strong></p>
    <p>Tables created:</p>
    <ul>${tables.map((t) => `<li>${t.name}</li>`).join('')}</ul>
    <p>You should see: categories, category_columns, entries,
       schema_version (plus sqlite_* internal tables). Refresh a few
       times — the list and version should stay identical, proving
       re-opening doesn't recreate or duplicate anything.</p>
  `;
}

verifySchema().catch((err) => {
  app.innerHTML = `<h1>Error</h1><pre style="color:red">${err.message}</pre>`;
});