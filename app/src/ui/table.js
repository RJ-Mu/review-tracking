import { getCategoryColumns, getCategoryEntries } from '../db/api.js';

// Visible base columns (is_hidden is excluded — it's the hide mechanism, Phase 9).
// notes goes last because it's free text and usually the widest column.
const BASE_COLS = [
  { key: 'title',       label: 'title',    type: 'text',   source: 'base' },
  { key: 'rating',      label: 'rating',   type: 'number', source: 'base' },
  { key: 'reviewed_on', label: 'reviewed', type: 'date',   source: 'base' },
];
const NOTES_COL = { key: 'notes', label: 'notes', type: 'text', source: 'base' };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export async function renderTable(container, category, { showMessage, onBack }) {
  let columns, entries;
  try {
    const extra = await getCategoryColumns(category.id);
    const extraCols = extra.map((c) => ({
      key: c.name, label: c.name, type: c.data_type, source: 'data',
    }));
    // order: base (minus notes) -> category extras -> notes
    columns = [...BASE_COLS, ...extraCols, NOTES_COL];
    entries = await getCategoryEntries(category.id);
  } catch (err) {
    showMessage('DB error: ' + err.message, 'err');
    return;
  }

  let sort = { key: null, dir: 1 }; // dir 1 = asc, -1 = desc

  container.innerHTML = '';
  const host = container;

  const valueOf = (entry, col) => {
    const v = col.source === 'base' ? entry[col.key] : entry.data[col.key];
    return v === undefined ? null : v;
  };
  const isEmpty = (v) => v === null || v === '';

  function compare(a, b, col) {
    const va = valueOf(a, col), vb = valueOf(b, col);
    // Empties sort to the bottom in BOTH directions (common table convention).
    if (isEmpty(va) && isEmpty(vb)) return 0;
    if (isEmpty(va)) return 1;
    if (isEmpty(vb)) return -1;
    let r;
    if (col.type === 'number')       r = Number(va) - Number(vb);
    else if (col.type === 'boolean') r = (va ? 1 : 0) - (vb ? 1 : 0);
    else                             r = String(va).localeCompare(String(vb)); // text + ISO date
    return r * sort.dir;
  }

  function display(entry, col) {
    const v = valueOf(entry, col);
    if (isEmpty(v)) return null;
    if (col.type === 'boolean') return v ? 'yes' : 'no';
    return String(v);
  }

  function render() {
    if (entries.length === 0) {
      host.innerHTML = `<div class="table-empty">No entries yet.</div>`;
      return;
    }
    const rows = [...entries];
    if (sort.key) {
      const col = columns.find((c) => c.key === sort.key);
      rows.sort((a, b) => compare(a, b, col));
    }
    const ind = (c) =>
      sort.key === c.key ? `<span class="ind">${sort.dir === 1 ? '▲' : '▼'}</span>` : '';

    const thead = columns
      .map((c) => `<th data-key="${escapeHtml(c.key)}">${escapeHtml(c.label)}${ind(c)}</th>`)
      .join('');
    const tbody = rows.map((e) => {
      const tds = columns.map((c) => {
        const d = display(e, c);
        return d === null ? `<td class="empty-cell">—</td>` : `<td>${escapeHtml(d)}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');

    host.innerHTML = `
      <div class="table-scroll">
        <table class="data">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>`;

    host.querySelectorAll('th').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (sort.key === key) sort.dir *= -1;     // same column -> flip direction
        else { sort.key = key; sort.dir = 1; }    // new column -> ascending
        render();
        const col = columns.find((c) => c.key === key);
        showMessage(`Sorted by ${col.label} ${sort.dir === 1 ? 'asc' : 'desc'}.`);
      });
    });
  }

  render();
  showMessage(`${entries.length} entries in ${category.name}.`);
}