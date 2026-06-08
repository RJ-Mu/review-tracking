import { runExport } from './export.js';
import { runImport } from './import.js';
import { resetAll } from '../db/api.js';
import { confirmDialog } from './confirm.js';

export function renderDataScreen(container, { showMessage, onBack, onDataChanged }) {
  container.innerHTML = `
    <div class="table-head">
      <button class="term-btn" id="back">&lt; Back</button>
      <span class="name">Data</span>
    </div>
    <div class="data-actions">
      <button class="term-btn" id="export">Export to file</button>
      <button class="term-btn" id="import">Import from file</button>
      <input type="file" id="file-input" accept="application/json,.json" hidden />
      <button class="term-btn danger" id="reset">Reset (wipe all data)</button>
    </div>
    <p class="prompt" style="margin-top:14px;">// Export saves everything to a JSON file. Import validates before loading. Reset cannot be undone.</p>
  `;
  container.querySelector('#back').addEventListener('click', onBack);
  container.querySelector('#export').addEventListener('click', () => runExport({ showMessage }));

  const fileInput = container.querySelector('#file-input');
  container.querySelector('#import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    await runImport(file, { showMessage, onDone: onDataChanged });
    fileInput.value = ''; // allow re-importing the same file
  });

  container.querySelector('#reset').addEventListener('click', async () => {
    const ok = await confirmDialog('Wipe ALL categories and entries? This cannot be undone.',
      { confirmLabel: 'Wipe Everything' });
    if (!ok) return;
    try {
      await resetAll();
      showMessage('All data wiped.');
      onDataChanged();
    } catch (err) {
      showMessage('Reset failed: ' + err.message, 'err');
    }
  });
}