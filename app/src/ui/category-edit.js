import { getCategoryColumns, renameCategory, renameCategoryColumn,
         removeCategoryColumn, appendCategoryColumn } from '../db/api.js';
import { confirmDialog } from './confirm.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const RESERVED = ['title', 'rating', 'notes', 'reviewed', 'reviewed_on'];

export async function renderCategoryEdit(container, category, { showMessage, onBack }) {
  let columns;
  try {
    columns = await getCategoryColumns(category.id);
  } catch (err) { showMessage('DB error: ' + err.message, 'err'); return; }

  const redraw = () => renderCategoryEdit(container, category, { showMessage, onBack });

  container.innerHTML = `
    <div class="table-head">
      <button class="term-btn" id="back">&lt; Back</button>
      <span class="name">Edit // ${escapeHtml(category.name)}</span>
    </div>

    <label class="field">
      <span class="field-label">Category Name</span>
      <div class="filter-range">
        <input id="cat-rename" class="term-input" type="text" value="${escapeHtml(category.name)}" />
        <button class="term-btn small" id="save-name">Save</button>
      </div>
    </label>

    <div class="prompt" style="margin-top:16px;">// Columns</div>
    <ul class="cat-list" id="col-list"></ul>

    <div class="prompt" style="margin-top:12px;">// Add Column</div>
    <div class="col-def" id="add-col-box">
      <div class="col-def-main">
        <input class="term-input col-name" type="text" placeholder="column name" />
        <select class="term-input col-type">
          <option value="text">text</option><option value="number">number</option>
          <option value="boolean">boolean</option><option value="date">date</option>
        </select>
      </div>
      <div class="col-range" hidden>
        <input class="term-input col-min" type="number" step="any" placeholder="min (optional)" />
        <input class="term-input col-max" type="number" step="any" placeholder="max (optional)" />
      </div>
      <button class="term-btn small" id="add-col-btn" style="margin-top:8px;">+ Add Column</button>
    </div>
  `;

  container.querySelector('#back').addEventListener('click', onBack);

  // rename category
  container.querySelector('#save-name').addEventListener('click', async () => {
    const newName = container.querySelector('#cat-rename').value.trim();
    if (!newName) { showMessage('Name cannot be empty.', 'err'); return; }
    if (newName === category.name) { showMessage('No change.'); return; }
    try {
      await renameCategory(category.id, newName);
      category.name = newName;
      showMessage('Category renamed.');
      redraw();
    } catch (err) { showMessage('Rename failed: ' + err.message, 'err'); }
  });

  // existing columns: rename / remove
  const colList = container.querySelector('#col-list');
  columns.forEach((col) => {
    const li = document.createElement('li');
    li.className = 'manage-item';
    li.innerHTML = `
      <input class="term-input col-edit-name" type="text" value="${escapeHtml(col.name)}" style="flex:1; min-width:0;" />
      <span class="tag">${col.data_type}</span>
      <button class="term-btn small col-rename">Rename</button>
      <button class="term-btn small danger col-remove">Remove</button>`;
    li.querySelector('.col-rename').addEventListener('click', async () => {
      const newName = li.querySelector('.col-edit-name').value.trim();
      if (!newName) { showMessage('Column name cannot be empty.', 'err'); return; }
      if (newName === col.name) { showMessage('No change.'); return; }
      if (RESERVED.includes(newName.toLowerCase())) { showMessage('Reserved name.', 'err'); return; }
      if (columns.some((c) => c !== col && c.name.toLowerCase() === newName.toLowerCase())) {
        showMessage('A column with that name exists.', 'err'); return; }
      try {
        await renameCategoryColumn(category.id, col.name, newName);
        showMessage(`Column renamed; values migrated.`);
        redraw();
      } catch (err) { showMessage('Rename failed: ' + err.message, 'err'); }
    });
    li.querySelector('.col-remove').addEventListener('click', async () => {
      const ok = await confirmDialog(
        `Remove column "${col.name}"? Existing values are kept hidden and return if you re-add a column with this name.`,
        { confirmLabel: 'Remove' });
      if (!ok) return;
      try {
        await removeCategoryColumn(category.id, col.name);
        showMessage('Column removed.');
        redraw();
      } catch (err) { showMessage('Remove failed: ' + err.message, 'err'); }
    });
    colList.appendChild(li);
  });
  if (columns.length === 0) colList.innerHTML = `<li class="empty">No columns.</li>`;

  // add-column box: min/max only for number
  const typeSel = container.querySelector('.col-type');
  const range = container.querySelector('#add-col-box .col-range');
  const syncRange = () => { range.hidden = typeSel.value !== 'number'; };
  syncRange();
  typeSel.addEventListener('change', syncRange);

  container.querySelector('#add-col-btn').addEventListener('click', async () => {
    const name = container.querySelector('.col-name').value.trim();
    if (!name) { showMessage('Column name required.', 'err'); return; }
    if (RESERVED.includes(name.toLowerCase())) { showMessage('Reserved name.', 'err'); return; }
    if (columns.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      showMessage('A column with that name exists.', 'err'); return; }
    const type = typeSel.value;
    let minVal = null, maxVal = null;
    if (type === 'number') {
      const mn = container.querySelector('.col-min').value.trim();
      const mx = container.querySelector('.col-max').value.trim();
      minVal = mn === '' ? null : Number(mn);
      maxVal = mx === '' ? null : Number(mx);
      if (minVal != null && maxVal != null && minVal > maxVal) {
        showMessage('Min cannot exceed max.', 'err'); return; }
    }
    try {
      await appendCategoryColumn(category.id, name, type, minVal, maxVal);
      showMessage('Column added.');
      redraw();
    } catch (err) { showMessage('Add failed: ' + err.message, 'err'); }
  });
}