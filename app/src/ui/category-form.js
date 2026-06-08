import { addCategory, addCategoryColumn } from '../db/api.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function renderCategoryForm(container, { showMessage, onSaved, onCancel }) {
  let colCount = 0;

  container.innerHTML = `
    <div class="table-head">
      <button class="term-btn" id="cancel">&lt; Cancel</button>
      <span class="name">New Category</span>
    </div>
    <form class="entry-form" id="cat-form" novalidate>
      <label class="field">
        <span class="field-label">Category Name *</span>
        <input id="cat-name" class="term-input" type="text" />
      </label>
      <div class="prompt" style="margin:6px 2px 0;">// Extra Columns (optional)</div>
      <div id="cols"></div>
      <button type="button" class="term-btn" id="add-col">+ Add Column</button>
      <button class="term-btn submit" type="submit">&gt; Create Category</button>
    </form>
  `;

  const colsEl = container.querySelector('#cols');
  container.querySelector('#cancel').addEventListener('click', onCancel);

  function addColumnRow() {
    const idx = colCount++;
    const row = document.createElement('div');
    row.className = 'col-def';
    row.dataset.idx = idx;
    row.innerHTML = `
      <div class="col-def-main">
        <input class="term-input col-name" type="text" placeholder="column name" />
        <select class="term-input col-type">
          <option value="text">text</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="date">date</option>
        </select>
        <button type="button" class="step-btn col-remove" title="Remove">&times;</button>
      </div>
      <div class="col-range" hidden>
        <input class="term-input col-min" type="number" step="any" placeholder="min (optional)" />
        <input class="term-input col-max" type="number" step="any" placeholder="max (optional)" />
      </div>
    `;
    const typeSel = row.querySelector('.col-type');
    const range = row.querySelector('.col-range');
    const syncRange = () => { range.hidden = typeSel.value !== 'number'; };
    syncRange();                                  // set correct state immediately
    typeSel.addEventListener('change', syncRange); // and on every change
    row.querySelector('.col-remove').addEventListener('click', () => row.remove());
    colsEl.appendChild(row);
  }

  container.querySelector('#add-col').addEventListener('click', addColumnRow);

  container.querySelector('#cat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#cat-name').value.trim();
    if (!name) { showMessage('Category name is required.', 'err'); return; }

    // gather + validate column defs before touching the DB
    const defs = [];
    const seen = new Set();
    for (const row of colsEl.querySelectorAll('.col-def')) {
      const cName = row.querySelector('.col-name').value.trim();
      if (!cName) { showMessage('Every column needs a name.', 'err'); return; }
      const key = cName.toLowerCase();
      if (seen.has(key)) { showMessage(`Duplicate column: ${cName}.`, 'err'); return; }
      if (['title','rating','notes','reviewed','reviewed_on'].includes(key)) {
        showMessage(`"${cName}" is a reserved base column name.`, 'err'); return;
      }
      seen.add(key);
      const type = row.querySelector('.col-type').value;
      let minVal = null, maxVal = null;
      if (type === 'number') {
        const minRaw = row.querySelector('.col-min').value.trim();
        const maxRaw = row.querySelector('.col-max').value.trim();
        minVal = minRaw === '' ? null : Number(minRaw);
        maxVal = maxRaw === '' ? null : Number(maxRaw);
        if (minVal != null && !Number.isFinite(minVal)) { showMessage('Min must be a number.', 'err'); return; }
        if (maxVal != null && !Number.isFinite(maxVal)) { showMessage('Max must be a number.', 'err'); return; }
        if (minVal != null && maxVal != null && minVal > maxVal) {
          showMessage(`${cName}: min cannot exceed max.`, 'err'); return;
        }
      }
      defs.push({ cName, type, minVal, maxVal });
    }

    try {
      const catId = await addCategory(name);
      let pos = 0;
      for (const d of defs) {
        await addCategoryColumn(catId, d.cName, d.type, pos++, d.minVal, d.maxVal);
      }
      showMessage(`Category "${name}" created${defs.length ? ` with ${defs.length} column(s)` : ''}.`);
      onSaved();
    } catch (err) {
      // UNIQUE violation on name lands here
      showMessage('Create failed: ' + err.message, 'err');
    }
  });
}