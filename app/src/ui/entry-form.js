import { getCategoryColumns, addEntry, updateEntry, getEntry, getCategoryEntries } from '../db/api.js';
import { validateEntry } from '../validate.js';

const BASE_FIELDS = [
  { key: 'title',       label: 'Title',    type: 'text',   source: 'base', required: true,  input: 'text' },
  { key: 'rating',      label: 'Rating',   type: 'number', source: 'base', required: false, input: 'number' },
  { key: 'reviewed_on', label: 'Reviewed', type: 'date',   source: 'base', required: false, input: 'date' },
  { key: 'notes',       label: 'Notes',    type: 'text',   source: 'base', required: false, input: 'textarea' },
];
const ICON_CALENDAR = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><rect x="3" y="4.5" width="18" height="16.5"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/></svg>`;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function inputFor(field, value) {
  const id = field.domId;
  if (field.input === 'textarea')
    return `<textarea id="${id}" class="term-input" rows="2">${value != null ? escapeHtml(value) : ''}</textarea>`;
  if (field.type === 'boolean')
    return `<input id="${id}" class="term-check" type="checkbox" ${value ? 'checked' : ''} />`;
  if (field.input === 'number') {
    const v = value != null ? ` value="${escapeHtml(value)}"` : '';
    return `<div class="num-stepper">
      <button type="button" class="step-btn" data-step="-1" tabindex="-1">&minus;</button>
      <input id="${id}" class="term-input num-input" type="number" step="any" inputmode="decimal"${v} />
      <button type="button" class="step-btn" data-step="1" tabindex="-1">+</button>
    </div>`;
  }
  if (field.input === 'date') {
    const v = value != null ? ` value="${escapeHtml(value)}"` : '';
    return `<div class="date-wrap">
      <input id="${id}" class="term-input date-input" type="date"${v} />
      <button type="button" class="date-icon" data-for="${id}" tabindex="-1" aria-label="Open calendar">${ICON_CALENDAR}</button>
    </div>`;
  }
  const v = value != null ? ` value="${escapeHtml(value)}"` : '';
  return `<input id="${id}" class="term-input" type="text"${v} />`;
}

// entry = null  -> add mode.   entry = {...} -> edit mode (pre-filled, diffed).
export async function renderEntryForm(container, category, entry, { showMessage, onSaved, onCancel }) {
  let extraCols, existingEntries;
  try {
    extraCols = await getCategoryColumns(category.id);
    existingEntries = await getCategoryEntries(category.id);
  } catch (err) {
    showMessage('DB error: ' + err.message, 'err');
    return;
  }

  // distinct existing values per text field, for autocomplete suggestions
  const suggestionsFor = (f) => {
    if (f.type !== 'text' || f.input === 'textarea') return [];
    const vals = new Set();
    for (const e of existingEntries) {
      const v = f.source === 'base' ? e[f.key] : e.data[f.key];
      if (v != null && String(v).trim() !== '') vals.add(String(v));
    }
    return [...vals].sort((a, b) => a.localeCompare(b));
  };

  const extraFields = extraCols.map((c) => ({
    key: c.name, label: c.name, type: c.data_type, source: 'data', required: false,
    min: c.min_val, max: c.max_val,
    input: c.data_type === 'number' ? 'number'
         : c.data_type === 'date'   ? 'date'
         : c.data_type === 'boolean' ? 'checkbox' : 'text',
  }));
  const fields = [...BASE_FIELDS.slice(0, 3), ...extraFields, BASE_FIELDS[3]];
  fields.forEach((f, i) => { f.domId = `f_${i}`; });
  fields.forEach((f) => { f.suggest = suggestionsFor(f); });

  const isEdit = entry !== null;

  // original value of a field, normalised for the input (base col vs data bag).
  const original = (f) => {
    if (!isEdit) return null;
    const v = f.source === 'base' ? entry[f.key] : entry.data[f.key];
    return v === undefined ? null : v;
  };

  container.innerHTML = `
    <div class="table-head">
      <button class="term-btn" id="cancel">&lt; Cancel</button>
      <span class="name">${isEdit ? 'Edit' : 'New'} // ${escapeHtml(category.name)}</span>
    </div>
    <form class="entry-form" id="entry-form" novalidate>
      ${fields.map((f) => `
        <label class="field">
          <span class="field-label">${escapeHtml(f.label)}${f.required ? ' *' : ''}</span>
          ${inputFor(f, original(f))}
          ${f.suggest && f.suggest.length
            ? `<div class="suggest-list ac-list" data-for="${f.domId}" hidden></div>` : ''}
        </label>`).join('')}
      <button class="term-btn submit" type="submit">&gt; ${isEdit ? 'Save Changes' : 'Save Entry'}</button>
    </form>
  `;

  container.querySelector('#cancel').addEventListener('click', onCancel);
  // number steppers: ±0.5 per tap, rounded to kill float drift, clamped at 0
  container.querySelectorAll('.num-stepper').forEach((stepper) => {
    const input = stepper.querySelector('.num-input');
    stepper.querySelectorAll('.step-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = parseFloat(btn.dataset.step);
        const cur = input.value.trim() === '' ? 0 : parseFloat(input.value);
        const base = Number.isFinite(cur) ? cur : 0;
        let next = Math.round((base + delta) * 100) / 100;
        if (next < 0) next = 0;
        input.value = next;
      });
    });
  });
  // custom calendar icon opens the native picker programmatically
  container.querySelectorAll('.date-icon').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = container.querySelector('#' + btn.dataset.for);
      try { input.showPicker(); } catch { input.focus(); }
    });
  });

  // entry-form autocomplete on text fields
  fields.forEach((f) => {
    if (!f.suggest || !f.suggest.length) return;
    const input = container.querySelector('#' + f.domId);
    const list = container.querySelector(`.ac-list[data-for="${f.domId}"]`);
    if (!input || !list) return;

    const renderSuggest = () => {
      const q = input.value.trim().toLowerCase();
      if (q === '') { list.hidden = true; list.innerHTML = ''; return; }
      const matches = f.suggest
        .filter((v) => v.toLowerCase().includes(q) && v.toLowerCase() !== q)
        .slice(0, 20);
      if (matches.length === 0) { list.hidden = true; list.innerHTML = ''; return; }
      list.innerHTML = matches.map((v) =>
        `<button type="button" class="suggest-item" data-val="${escapeHtml(v)}">${escapeHtml(v)}</button>`
      ).join('');
      list.hidden = false;
      list.querySelectorAll('.suggest-item').forEach((b) =>
        b.addEventListener('click', () => {
          input.value = b.dataset.val;
          list.hidden = true; list.innerHTML = '';
          input.focus();
        }));
    };
    input.addEventListener('input', renderSuggest);
    // hide list shortly after leaving the field (delay lets a click register first)
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
  });

  const readRaw = (f) => {
    const el = container.querySelector('#' + f.domId);
    return f.type === 'boolean' ? el.checked : el.value;
  };

  container.querySelector('#entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = {};
    for (const f of fields) raw[f.key] = readRaw(f);

    const result = validateEntry(fields, raw);
    if (!result.ok) { showMessage(result.errors.join(' '), 'err'); return; }

    try {
      if (!isEdit) {
        const { base, data } = result;
        await addEntry(category.id, base.title, base.rating ?? null,
                       base.notes ?? null, base.reviewed_on ?? null, data);
        showMessage(`Saved: ${base.title}.`);
        onSaved();
        return;
      }

      // EDIT: diff each field's cleaned value against the original; write only changes.
      let changes = 0;
      for (const f of fields) {
        const res = validateEntry([f], raw);   // reuse the same coercion per field
        const newVal = f.source === 'base' ? (res.base[f.key] ?? null)
                                           : (res.data[f.key] ?? null);
        const oldVal = original(f);
        // normalise both sides for comparison (null vs '' vs number)
        const norm = (v) => (v === undefined || v === '' ? null : v);
        if (norm(newVal) !== norm(oldVal)) {
          await updateEntry(entry.id, f.key, newVal);  // null clears the cell (req 6.2)
          changes++;
        }
      }
      showMessage(changes ? `Updated ${changes} field${changes > 1 ? 's' : ''}.` : 'No changes.');
      onSaved();
    } catch (err) {
      showMessage('Save failed: ' + err.message, 'err');
    }
  });
}