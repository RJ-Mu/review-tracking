import { getCategoryColumns, addEntry } from '../db/api.js';
import { validateEntry } from '../validate.js';

// Base fields shown in the add form. title required; rating/notes/date optional.
const BASE_FIELDS = [
  { key: 'title',       label: 'Title',    type: 'text',   source: 'base', required: true,  input: 'text' },
  { key: 'rating',      label: 'Rating',   type: 'number', source: 'base', required: false, input: 'number' },
  { key: 'reviewed_on', label: 'Reviewed', type: 'date',   source: 'base', required: false, input: 'date' },
  { key: 'notes',       label: 'Notes',    type: 'text',   source: 'base', required: false, input: 'textarea' },
];

function inputFor(field) {
  const id = `f_${field.key}`;
  if (field.input === 'textarea')
    return `<textarea id="${id}" class="term-input" rows="2"></textarea>`;
  if (field.type === 'boolean')
    return `<input id="${id}" class="term-check" type="checkbox" />`;
  const t = field.input === 'number' ? 'number'
          : field.input === 'date'   ? 'date' : 'text';
  const step = field.input === 'number' ? ' step="any"' : '';
  return `<input id="${id}" class="term-input" type="${t}"${step} />`;
}

export async function renderAddForm(container, category, { showMessage, onSaved, onCancel }) {
  let extraCols;
  try {
    extraCols = await getCategoryColumns(category.id);
  } catch (err) {
    showMessage('DB error: ' + err.message, 'err');
    return;
  }

  // category extras map to data-bag fields, between rating/date and notes.
  const extraFields = extraCols.map((c) => ({
    key: c.name, label: c.name, type: c.data_type, source: 'data',
    required: false, input: c.data_type === 'number' ? 'number'
                          : c.data_type === 'date'   ? 'date'
                          : c.data_type === 'boolean' ? 'checkbox' : 'text',
  }));
  const fields = [...BASE_FIELDS.slice(0, 3), ...extraFields, BASE_FIELDS[3]];

  container.innerHTML = `
    <div class="table-head">
      <button class="term-btn" id="cancel">&lt; Cancel</button>
      <span class="name">New // ${escapeHtml(category.name)}</span>
    </div>
    <form class="entry-form" id="entry-form" novalidate>
      ${fields.map((f) => `
        <label class="field">
          <span class="field-label">${escapeHtml(f.label)}${f.required ? ' *' : ''}</span>
          ${inputFor(f)}
        </label>`).join('')}
      <button class="term-btn submit" type="submit">&gt; Save Entry</button>
    </form>
  `;

  container.querySelector('#cancel').addEventListener('click', onCancel);

  const readRaw = (f) => {
    const el = container.querySelector(`#f_${f.key}`);
    if (f.type === 'boolean') return el.checked;
    return el.value;
  };

  container.querySelector('#entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = {};
    for (const f of fields) raw[f.key] = readRaw(f);

    const result = validateEntry(fields, raw);
    if (!result.ok) { showMessage(result.errors.join(' '), 'err'); return; }

    try {
      const { base, data } = result;
      await addEntry(
        category.id,
        base.title,
        base.rating ?? null,
        base.notes ?? null,
        base.reviewed_on ?? null,
        data
      );
      showMessage(`Saved: ${base.title}.`);
      onSaved();
    } catch (err) {
      // surfaces DB-level errors too, e.g. the rating 0–10 CHECK.
      showMessage('Save failed: ' + err.message, 'err');
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}