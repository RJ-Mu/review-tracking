function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const ICON_CALENDAR = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><rect x="3" y="4.5" width="18" height="16.5"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/></svg>`;

// Decide if one entry passes the active filters. AND across columns.
export function entryPasses(entry, columns, filters) {
  for (const col of columns) {
    const f = filters[col.key];
    if (!f) continue;
    const v = col.source === 'base' ? entry[col.key] : entry.data[col.key];

    if (col.type === 'number') {
      if (v == null || v === '') return false;          // empty fails an active range
      const n = Number(v);
      if (f.min != null && n < f.min) return false;
      if (f.max != null && n > f.max) return false;
    } else if (col.type === 'date') {
      if (v == null || v === '') return false;
      if (f.from && String(v) < f.from) return false;    // ISO dates compare as strings
      if (f.to   && String(v) > f.to)   return false;
    } else if (col.type === 'boolean') {
      if (f.want === 'yes' && !v) return false;
      if (f.want === 'no'  &&  v) return false;
    } else { // text: OR across chosen values
      if (f.values && f.values.length) {
        if (!f.values.includes(v == null ? '' : String(v))) return false;
      }
    }
  }
  return true;
}

// Is there any active constraint? (used to show the "filtered" badge / enable Clear)
export function hasActiveFilters(columns, filters) {
  return columns.some((col) => {
    const f = filters[col.key];
    if (!f) return false;
    if (col.type === 'number')  return f.min != null || f.max != null;
    if (col.type === 'date')    return !!(f.from || f.to);
    if (col.type === 'boolean') return f.want === 'yes' || f.want === 'no';
    return f.values && f.values.length > 0;
  });
}

// Render the filter panel as a modal-style overlay. Calls onApply(newFilters).
export function openFilterPanel(columns, entries, currentFilters, { onApply }) {
  // working copy so Cancel discards changes
  const draft = JSON.parse(JSON.stringify(currentFilters || {}));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const body = columns.map((col) => {
    const label = escapeHtml(col.label);
    const key = escapeHtml(col.key);

    if (col.type === 'number') {
      const f = draft[col.key] || {};
      return `<div class="filter-col" data-key="${key}" data-type="number">
        <div class="field-label">${label}</div>
        <div class="filter-range">
          <input class="term-input f-min" type="number" step="any" placeholder="min" value="${f.min ?? ''}" />
          <span class="rng-dash">–</span>
          <input class="term-input f-max" type="number" step="any" placeholder="max" value="${f.max ?? ''}" />
        </div>
      </div>`;
    }
    if (col.type === 'date') {
      const f = draft[col.key] || {};
      return `<div class="filter-col" data-key="${key}" data-type="date">
        <div class="field-label">${label}</div>
        <div class="filter-range">
          <div class="date-wrap"><input class="term-input date-input f-from" type="date" value="${f.from ?? ''}" />
            <button type="button" class="date-icon" tabindex="-1">${ICON_CALENDAR}</button></div>
          <span class="rng-dash">–</span>
          <div class="date-wrap"><input class="term-input date-input f-to" type="date" value="${f.to ?? ''}" />
            <button type="button" class="date-icon" tabindex="-1">${ICON_CALENDAR}</button></div>
        </div>
      </div>`;
    }
    if (col.type === 'boolean') {
      const want = (draft[col.key] || {}).want || 'either';
      const opt = (val, txt) =>
        `<button type="button" class="term-btn small bool-opt ${want === val ? 'active' : ''}" data-want="${val}">${txt}</button>`;
      return `<div class="filter-col" data-key="${key}" data-type="boolean">
        <div class="field-label">${label}</div>
        <div class="bool-row">${opt('either','Either')}${opt('yes','Yes')}${opt('no','No')}</div>
      </div>`;
    }
    // text: type-to-narrow search with selected values as tags
    const present = new Set();
    for (const e of entries) {
      const v = col.source === 'base' ? e[col.key] : e.data[col.key];
      if (v != null && String(v) !== '') present.add(String(v));
    }
    const allValues = [...present].sort((a, b) => a.localeCompare(b));
    const chosen = (draft[col.key] || {}).values || [];
    return `<div class="filter-col" data-key="${key}" data-type="text"
                 data-values="${escapeHtml(JSON.stringify(allValues))}">
      <div class="field-label">${label}</div>
      <div class="tag-row">${chosen.map((v) =>
        `<span class="val-tag" data-val="${escapeHtml(v)}">${escapeHtml(v)}<button type="button" class="tag-x" tabindex="-1">×</button></span>`
      ).join('')}</div>
      <input class="term-input text-search" type="text" placeholder="type to search…" autocomplete="off" />
      <div class="suggest-list" hidden></div>
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal-box filter-box" role="dialog" aria-modal="true">
      <div class="filter-head">
        <span>Filter</span>
        <button type="button" class="term-btn small" id="f-clear">Clear All</button>
      </div>
      <div class="filter-body">${body}</div>
      <div class="modal-actions">
        <button type="button" class="term-btn" id="f-cancel">Cancel</button>
        <button type="button" class="term-btn submit" id="f-apply">&gt; Apply</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // date icon triggers
  overlay.querySelectorAll('.date-icon').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      try { input.showPicker(); } catch { input.focus(); }
    });
  });
  // boolean toggle buttons
  overlay.querySelectorAll('.bool-row').forEach((rowEl) => {
    rowEl.querySelectorAll('.bool-opt').forEach((b) => {
      b.addEventListener('click', () => {
        rowEl.querySelectorAll('.bool-opt').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
  });

  // text type-to-narrow search
  overlay.querySelectorAll('.filter-col[data-type="text"]').forEach((colEl) => {
    const all = JSON.parse(colEl.dataset.values);
    const input = colEl.querySelector('.text-search');
    const list = colEl.querySelector('.suggest-list');
    const tagRow = colEl.querySelector('.tag-row');

    const chosenVals = () => [...tagRow.querySelectorAll('.val-tag')].map((t) => t.dataset.val);

    const addTag = (val) => {
      if (chosenVals().includes(val)) return;
      const tag = document.createElement('span');
      tag.className = 'val-tag';
      tag.dataset.val = val;
      tag.innerHTML = `${escapeHtml(val)}<button type="button" class="tag-x" tabindex="-1">×</button>`;
      tag.querySelector('.tag-x').addEventListener('click', () => tag.remove());
      tagRow.appendChild(tag);
    };

    const renderSuggest = () => {
      const q = input.value.trim().toLowerCase();
      if (q === '') { list.hidden = true; list.innerHTML = ''; return; }
      const taken = chosenVals();
      const matches = all.filter((v) => v.toLowerCase().includes(q) && !taken.includes(v)).slice(0, 30);
      if (matches.length === 0) { list.hidden = true; list.innerHTML = ''; return; }
      list.innerHTML = matches.map((v) =>
        `<button type="button" class="suggest-item" data-val="${escapeHtml(v)}">${escapeHtml(v)}</button>`
      ).join('');
      list.hidden = false;
      list.querySelectorAll('.suggest-item').forEach((b) =>
        b.addEventListener('click', () => { addTag(b.dataset.val); input.value = ''; renderSuggest(); input.focus(); }));
    };

    // existing tags (from a reopened panel) need their × wired too
    tagRow.querySelectorAll('.tag-x').forEach((x) =>
      x.addEventListener('click', (e) => e.target.closest('.val-tag').remove()));

    input.addEventListener('input', renderSuggest);
  });

  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#f-cancel').addEventListener('click', close);

  overlay.querySelector('#f-clear').addEventListener('click', () => {
    overlay.querySelectorAll('.val-tag').forEach((t) => t.remove());
    overlay.querySelectorAll('.suggest-list').forEach((l) => { l.hidden = true; l.innerHTML = ''; });
    overlay.querySelectorAll('.f-min, .f-max, .f-from, .f-to').forEach((i) => (i.value = ''));
    overlay.querySelectorAll('.bool-row').forEach((rowEl) => {
      rowEl.querySelectorAll('.bool-opt').forEach((x) => x.classList.remove('active'));
      rowEl.querySelector('[data-want="either"]').classList.add('active');
    });
  });

  overlay.querySelector('#f-apply').addEventListener('click', () => {
    const next = {};
    overlay.querySelectorAll('.filter-col').forEach((colEl) => {
      const key = colEl.dataset.key;
      const type = colEl.dataset.type;
      if (type === 'number') {
        const min = colEl.querySelector('.f-min').value.trim();
        const max = colEl.querySelector('.f-max').value.trim();
        if (min !== '' || max !== '')
          next[key] = { min: min === '' ? null : Number(min), max: max === '' ? null : Number(max) };
      } else if (type === 'date') {
        const from = colEl.querySelector('.f-from').value;
        const to = colEl.querySelector('.f-to').value;
        if (from || to) next[key] = { from: from || null, to: to || null };
      } else if (type === 'boolean') {
        const want = colEl.querySelector('.bool-opt.active')?.dataset.want || 'either';
        if (want !== 'either') next[key] = { want };
      } else {
        const values = [...colEl.querySelectorAll('.tag-row .val-tag')].map((t) => t.dataset.val);
        if (values.length) next[key] = { values };
      }
    });
    close();
    onApply(next);
  });
}