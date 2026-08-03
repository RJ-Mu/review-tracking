import {
    getCategoryColumns,
    renameCategory,
    renameCategoryColumn,
    removeCategoryColumn,
    appendCategoryColumn,
    updateColumnPositions,
    deleteCategory
} from '../db/api.js';
import { confirmDialog, confirmTypedDialog } from './confirm.js';

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const RESERVED = ['title', 'rating', 'notes', 'reviewed', 'reviewed_on'];
const ICON_GRIP = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="9" x2="18" y2="9"/><line x1="6" y1="15" x2="18" y2="15"/></svg>`;

export async function renderCategoryEdit(container, category, { showMessage, onBack, onDeleted }) {
    let columns;
    try {
        columns = await getCategoryColumns(category.id);
    } catch (err) { showMessage('DB error: ' + err.message, 'err'); return; }

    const redraw = () => renderCategoryEdit(container, category, { showMessage, onBack, onDeleted });

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

    <div class="prompt" style="margin-top:16px;">// Columns &mdash; drag to reorder</div>
    <ul class="col-list" id="col-list"></ul>

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

    <div class="danger-zone">
      <button class="term-btn danger" id="del-cat">Delete Category</button>
      <p class="prompt" style="margin-top:8px;">// Deletes this category and all of its entries. Cannot be undone.</p>
    </div>
  `;

    container.querySelector('#back').addEventListener('click', onBack);

    // --- rename category ---
    container.querySelector('#save-name').addEventListener('click', async() => {
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

    // --- column rows ---
    const colList = container.querySelector('#col-list');
    columns.forEach((col) => {
        const li = document.createElement('li');
        li.className = 'col-item';
        li.dataset.name = col.name;
        li.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">${ICON_GRIP}</span>
      <input class="term-input col-edit-name" type="text" value="${escapeHtml(col.name)}" />
      <span class="tag">${col.data_type}</span>
      <button class="term-btn small col-rename">Rename</button>
      <button class="term-btn small danger col-remove">Remove</button>`;

        li.querySelector('.col-rename').addEventListener('click', async() => {
            const newName = li.querySelector('.col-edit-name').value.trim();
            if (!newName) { showMessage('Column name cannot be empty.', 'err'); return; }
            if (newName === col.name) { showMessage('No change.'); return; }
            if (RESERVED.includes(newName.toLowerCase())) { showMessage('Reserved name.', 'err'); return; }
            if (columns.some((c) => c !== col && c.name.toLowerCase() === newName.toLowerCase())) {
                showMessage('A column with that name exists.', 'err');
                return;
            }
            try {
                await renameCategoryColumn(category.id, col.name, newName);
                showMessage('Column renamed; values migrated.');
                redraw();
            } catch (err) { showMessage('Rename failed: ' + err.message, 'err'); }
        });

        li.querySelector('.col-remove').addEventListener('click', async() => {
            const ok = await confirmDialog(
                `Remove column "${col.name}"? Existing values are kept hidden and return if you re-add a column with this name.`, { confirmLabel: 'Remove' });
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

    // --- drag to reorder ---
    enableDrag(colList, async() => {
        const order = [...colList.querySelectorAll('.col-item')].map((el) => el.dataset.name);
        try {
            await updateColumnPositions(category.id, order);
            showMessage('Column order saved.');
        } catch (err) { showMessage('Reorder failed: ' + err.message, 'err'); }
    });

    // --- add column ---
    const typeSel = container.querySelector('#add-col-box .col-type');
    const range = container.querySelector('#add-col-box .col-range');
    const syncRange = () => { range.hidden = typeSel.value !== 'number'; };
    syncRange();
    typeSel.addEventListener('change', syncRange);

    container.querySelector('#add-col-btn').addEventListener('click', async() => {
        const name = container.querySelector('#add-col-box .col-name').value.trim();
        if (!name) { showMessage('Column name required.', 'err'); return; }
        if (RESERVED.includes(name.toLowerCase())) { showMessage('Reserved name.', 'err'); return; }
        if (columns.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
            showMessage('A column with that name exists.', 'err');
            return;
        }
        const type = typeSel.value;
        let minVal = null,
            maxVal = null;
        if (type === 'number') {
            const mn = container.querySelector('#add-col-box .col-min').value.trim();
            const mx = container.querySelector('#add-col-box .col-max').value.trim();
            minVal = mn === '' ? null : Number(mn);
            maxVal = mx === '' ? null : Number(mx);
            if (minVal != null && maxVal != null && minVal > maxVal) {
                showMessage('Min cannot exceed max.', 'err');
                return;
            }
        }
        try {
            await appendCategoryColumn(category.id, name, type, minVal, maxVal);
            showMessage('Column added.');
            redraw();
        } catch (err) { showMessage('Add failed: ' + err.message, 'err'); }
    });

    // --- delete category ---
    container.querySelector('#del-cat').addEventListener('click', async() => {
        const ok = await confirmTypedDialog(
            `Delete "${category.name}" and ALL of its entries permanently? Type the category name to confirm.`,
            category.name, { confirmLabel: 'Delete Category' });
        if (!ok) return;
        try {
            await deleteCategory(category.id);
            showMessage(`Category "${category.name}" deleted.`);
            (onDeleted || onBack)();
        } catch (err) { showMessage('Delete failed: ' + err.message, 'err'); }
    });
}

// Pointer drag reordering (mouse + touch). The dragged row follows the pointer;
// the others slide out of its way.
function enableDrag(listEl, onReorder) {
    let dragging = null;
    let startY = 0; // pointer y at grab
    let baseOffset = 0; // accumulated correction when the row's flow position changes

    const snapshot = () => {
        const map = new Map();
        listEl.querySelectorAll('.col-item').forEach((el) => map.set(el, el.getBoundingClientRect().top));
        return map;
    };

    const animateFrom = (map) => {
        listEl.querySelectorAll('.col-item').forEach((el) => {
            if (el === dragging) return;
            const before = map.get(el);
            if (before == null) return;
            const delta = before - el.getBoundingClientRect().top;
            if (!delta) return;
            el.style.transition = 'none';
            el.style.transform = `translateY(${delta}px)`;
            requestAnimationFrame(() => {
                el.style.transition = 'transform .50s ease';
                el.style.transform = '';
            });
        });
    };

    listEl.querySelectorAll('.drag-handle').forEach((handle) => {
        handle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            dragging = handle.closest('.col-item');
            dragging.classList.add('dragging');
            startY = e.clientY;
            baseOffset = 0;
            dragging.style.transition = 'none';
            handle.setPointerCapture(e.pointerId);
        });

        handle.addEventListener('pointermove', (e) => {
            if (!dragging) return;

            // 1. follow the pointer
            dragging.style.transform = `translateY(${baseOffset + (e.clientY - startY)}px)`;

            // 2. decide whether to reorder
            const y = e.clientY;
            const others = [...listEl.querySelectorAll('.col-item:not(.dragging)')];
            const target = others.find((it) => {
                const r = it.getBoundingClientRect();
                return y < r.top + r.height / 2;
            }) || null;

            const next = dragging.nextElementSibling;
            if ((target && target === next) || (!target && !next)) return;

            // 3. reorder, keeping the dragged row visually under the pointer
            const before = snapshot();
            const topBefore = dragging.getBoundingClientRect().top;
            if (target) listEl.insertBefore(dragging, target);
            else listEl.appendChild(dragging);
            const topAfter = dragging.getBoundingClientRect().top;
            baseOffset += topBefore - topAfter;
            dragging.style.transform = `translateY(${baseOffset + (e.clientY - startY)}px)`;
            animateFrom(before);
        });

        const end = (e) => {
            if (!dragging) return;
            const el = dragging;
            dragging = null;
            el.classList.remove('dragging');
            // settle into place
            el.style.transition = 'transform .20s ease';
            el.style.transform = '';
            setTimeout(() => { el.style.transition = ''; }, 520);
            try { handle.releasePointerCapture(e.pointerId); } catch {}
            onReorder();
        };
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    });
}