import { getCategoryColumns, getCategoryEntries, deleteEntries, getSetting, setSetting } from '../db/api.js';
import { confirmDialog } from './confirm.js';
import { openFilterPanel, entryPasses, hasActiveFilters } from './filters.js';
import { formatDate } from './format.js';

const BASE_COLS = [
    { key: 'title', label: 'title', type: 'text', source: 'base' },
    { key: 'rating', label: 'rating', type: 'number', source: 'base' },
    { key: 'reviewed_on', label: 'reviewed', type: 'date', source: 'base' },
];
const NOTES_COL = { key: 'notes', label: 'notes', type: 'text', source: 'base' };

const ICON_SELECT = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M3 6l2 2 3-3"/><path d="M3 13l2 2 3-3"/><line x1="11" y1="6" x2="21" y2="6"/><line x1="11" y1="13" x2="21" y2="13"/><line x1="3" y1="20" x2="21" y2="20"/></svg>`;
const ICON_CANCEL = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><line x1="4" y1="6" x2="20" y2="6"/><path d="M6 6v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6"/><line x1="9.5" y1="3" x2="14.5" y2="3"/><line x1="10" y1="10" x2="10" y2="16"/><line x1="14" y1="10" x2="14" y2="16"/></svg>`;
const ICON_FILTER = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><polygon points="3 4 21 4 14 12.5 14 19 10 21 10 12.5"/></svg>`;

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// host = where the table renders; controlsHost = toolbar slot for select/delete icons.
export async function renderTable(host, category, { showMessage, onEdit, controlsHost, leftHost, newEntryBtn }) {
    let columns, entries;
    const dateFmt = await getSetting('date_format', 'iso');
    try {
        const extra = await getCategoryColumns(category.id);
        const extraCols = extra.map((c) => ({
            key: c.name,
            label: c.name,
            type: c.data_type,
            source: 'data',
        }));
        columns = [...BASE_COLS, ...extraCols, NOTES_COL];
        entries = await getCategoryEntries(category.id);
    } catch (err) {
        showMessage('DB error: ' + err.message, 'err');
        return;
    }

    let sort = { key: null, dir: 1 };
    const savedSort = await getSetting(`sort_${category.id}`, null);
    if (savedSort) {
        const [k, d] = savedSort.split(':');
        // only apply if that column still exists in this category
        if (columns.some((c) => c.key === k)) sort = { key: k, dir: d === 'desc' ? -1 : 1 };
    }
    let filters = {};
    let selectMode = false;
    const selected = new Set();

    // Controls live in the toolbar slot and persist across table re-renders.
    // Right slot: filter + select toggle
    controlsHost.innerHTML = `
    <button class="icon-btn" id="filter-btn" title="Filter"><span class="icon-count" id="filter-dot" hidden></span>${ICON_FILTER}</button>
    <button class="icon-btn" id="toggle-select" title="Select rows">${ICON_SELECT}</button>
  `;
    // Left slot: a delete button that lives next to / replacing New Entry. Hidden until select mode.
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn danger';
    deleteBtn.id = 'delete-sel';
    deleteBtn.title = 'Delete selected';
    deleteBtn.hidden = true;
    deleteBtn.innerHTML = `<span class="icon-count" id="del-count">0</span>${ICON_TRASH}`;
    leftHost.appendChild(deleteBtn);

    const filterBtn = controlsHost.querySelector('#filter-btn');
    const filterDot = controlsHost.querySelector('#filter-dot');
    const toggleBtn = controlsHost.querySelector('#toggle-select');
    const delCount = deleteBtn.querySelector('#del-count');

    const valueOf = (entry, col) => {
        const v = col.source === 'base' ? entry[col.key] : entry.data[col.key];
        return v === undefined ? null : v;
    };
    const isEmpty = (v) => v === null || v === '';

    function compare(a, b, col) {
        const va = valueOf(a, col),
            vb = valueOf(b, col);
        if (isEmpty(va) && isEmpty(vb)) return 0;
        if (isEmpty(va)) return 1;
        if (isEmpty(vb)) return -1;
        let r;
        if (col.type === 'number') r = Number(va) - Number(vb);
        else if (col.type === 'boolean') r = (va ? 1 : 0) - (vb ? 1 : 0);
        else r = String(va).localeCompare(String(vb));
        return r * sort.dir;
    }

    function display(entry, col) {
        const v = valueOf(entry, col);
        if (isEmpty(v)) return null;
        if (col.type === 'boolean') return v ? 'yes' : 'no';
        if (col.type === 'date') return formatDate(String(v), dateFmt);
        return String(v);
    }

    function refreshControls() {
        toggleBtn.innerHTML = selectMode ? ICON_CANCEL : ICON_SELECT;
        toggleBtn.classList.toggle('active', selectMode);
        toggleBtn.title = selectMode ? 'Cancel selection' : 'Select rows';
        // in select mode: hide New Entry, show Delete in its place
        if (newEntryBtn) newEntryBtn.hidden = selectMode;
        deleteBtn.hidden = !selectMode;
        delCount.textContent = String(selected.size);
        deleteBtn.disabled = selected.size === 0;
    }

    function render() {
        if (entries.length === 0) {
            host.innerHTML = `<div class="table-empty">No entries yet.</div>`;
            return;
        }
        // (filtered-empty handled after we compute rows, below)
        let rows = entries.filter((e) => entryPasses(e, columns, filters));
        if (rows.length === 0) {
            host.innerHTML = `<div class="table-empty">No entries match the current filter.</div>`;
            return;
        }
        if (sort.key) {
            const col = columns.find((c) => c.key === sort.key);
            rows.sort((a, b) => compare(a, b, col));
        }
        const ind = (c) =>
            sort.key === c.key ? `<span class="ind">${sort.dir === 1 ? '▲' : '▼'}</span>` : '';

        const selTh = selectMode ? `<th class="sel-col"></th>` : '';
        const thead = selTh + columns
            .map((c) => `<th data-key="${escapeHtml(c.key)}">${escapeHtml(c.label)}${ind(c)}</th>`)
            .join('');
        const tbody = rows.map((e) => {
            const selCell = selectMode ?
                `<td class="sel-col"><input type="checkbox" class="row-check" ${selected.has(e.id) ? 'checked' : ''} /></td>` :
                '';
            const tds = columns.map((c) => {
                const d = display(e, c);
                return d === null ? `<td class="empty-cell">—</td>` : `<td>${escapeHtml(d)}</td>`;
            }).join('');
            return `<tr data-id="${e.id}" class="${selectMode && selected.has(e.id) ? 'row-selected' : ''}">${selCell}${tds}</tr>`;
        }).join('');

        host.innerHTML = `
      <div class="table-scroll">
        <table class="data">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>`;

        host.querySelectorAll('th[data-key]').forEach((th) => {
            th.addEventListener('click', () => {
                const key = th.dataset.key;
                if (sort.key === key) sort.dir *= -1;
                else {
                    sort.key = key;
                    sort.dir = 1;
                }
                setSetting(`sort_${category.id}`, `${sort.key}:${sort.dir === 1 ? 'asc' : 'desc'}`);
                render();
                const col = columns.find((c) => c.key === key);
                showMessage(`Sorted by ${col.label} ${sort.dir === 1 ? 'asc' : 'desc'}.`);
            });
        });

        host.querySelectorAll('tbody tr').forEach((tr) => {
            const id = Number(tr.dataset.id);
            tr.addEventListener('click', () => {
                if (selectMode) {
                    if (selected.has(id)) selected.delete(id);
                    else selected.add(id);
                    render();
                    refreshControls();
                } else {
                    onEdit(entries.find((e) => e.id === id));
                }
            });
        });
    }

    toggleBtn.addEventListener('click', () => {
        selectMode = !selectMode;
        selected.clear();
        refreshControls();
        render();
    });

    function refreshFilterDot() {
        filterDot.hidden = !hasActiveFilters(columns, filters);
    }
    filterBtn.addEventListener('click', () => {
        openFilterPanel(columns, entries, filters, {
            onApply: (next) => {
                filters = next;
                refreshFilterDot();
                render();
                const active = hasActiveFilters(columns, filters);
                showMessage(active ? 'Filter applied.' : 'Filter cleared.');
            },
        });
    });

    deleteBtn.addEventListener('click', async() => {
        if (selected.size === 0) return;
        const n = selected.size;
        const ok = await confirmDialog(
            `Delete ${n} entr${n > 1 ? 'ies' : 'y'}? This cannot be undone.`, { confirmLabel: 'Delete' }
        );
        if (!ok) return;
        try {
            await deleteEntries([...selected]);
            entries = entries.filter((e) => !selected.has(e.id));
            selected.clear();
            selectMode = false;
            refreshControls();
            render();
            showMessage(`Deleted ${n} entr${n > 1 ? 'ies' : 'y'}.`);
        } catch (err) {
            showMessage('Delete failed: ' + err.message, 'err');
        }
    });

    refreshControls();
    refreshFilterDot();
    render();
    showMessage(`${entries.length} entries in ${category.name}.`);
}