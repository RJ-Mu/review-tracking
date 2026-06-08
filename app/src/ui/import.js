import { addCategory, addCategoryColumn, addEntry, resetAll, getCategoryNames } from '../db/api.js';
import { validateValue } from '../validate.js';
import { confirmDialog, choiceDialog } from './confirm.js';

const VALID_TYPES = ['text', 'number', 'boolean', 'date'];

// Validate the parsed object WITHOUT touching the DB. Returns {ok, errors[]}.
function validateDump(dump) {
  const errors = [];
  if (!dump || typeof dump !== 'object') return { ok: false, errors: ['File is not a valid object.'] };
  if (dump.format !== 'review-terminal-export') errors.push('Not a Review Terminal export file.');
  if (!Array.isArray(dump.categories)) errors.push('Missing categories array.');
  if (!Array.isArray(dump.entries)) errors.push('Missing entries array.');
  if (errors.length) return { ok: false, errors };

  const catNames = new Set();
  dump.categories.forEach((c, i) => {
    if (!c.name || typeof c.name !== 'string') errors.push(`Category ${i}: missing name.`);
    else catNames.add(c.name);
    if (c.columns && !Array.isArray(c.columns)) errors.push(`Category "${c.name}": columns must be a list.`);
    (c.columns || []).forEach((col) => {
      if (!col.name) errors.push(`Category "${c.name}": a column has no name.`);
      if (!VALID_TYPES.includes(col.data_type))
        errors.push(`Category "${c.name}" column "${col.name}": bad type "${col.data_type}".`);
    });
  });

  dump.entries.forEach((e, i) => {
    if (!e.title) errors.push(`Entry ${i}: missing title.`);
    if (!e.category || !catNames.has(e.category))
      errors.push(`Entry ${i} ("${e.title}"): unknown category "${e.category}".`);
    if (e.data && typeof e.data !== 'object') errors.push(`Entry ${i}: data must be an object.`);
  });

  return errors.length ? { ok: false, errors } : { ok: true, errors: [] };
}

// Insert a validated dump. mode: 'replace' | 'merge'. Returns counts.
async function applyDump(dump, mode) {
  if (mode === 'replace') await resetAll();

  // collision-safe naming on merge
  const existing = new Set(await getCategoryNames());
  const nameMap = {}; // file category name -> actual name used
  for (const c of dump.categories) {
    let name = c.name;
    if (mode === 'merge' && existing.has(name)) {
      let n = name + ' (imported)', k = 2;
      while (existing.has(n)) n = `${name} (imported ${k++})`;
      name = n;
    }
    existing.add(name);
    nameMap[c.name] = name;
    const catId = await addCategory(name);
    if (c.is_hidden) { /* hidden flag applied via setCategoryHidden if desired */ }
    let pos = 0;
    for (const col of (c.columns || [])) {
      await addCategoryColumn(catId, col.name, col.data_type, col.position ?? pos++,
                              col.min_val ?? null, col.max_val ?? null);
    }
    // remember id by mapped name
    nameMap[c.name] = { id: catId, name };
  }

  let inserted = 0;
  for (const e of dump.entries) {
    const target = nameMap[e.category];
    if (!target) continue;
    await addEntry(target.id, e.title, e.rating ?? null, e.notes ?? null,
                   e.reviewed_on ?? null, e.data || {});
    inserted++;
  }
  return { categories: dump.categories.length, entries: inserted };
}

export async function runImport(file, { showMessage, onDone }) {
  let dump;
  try {
    dump = JSON.parse(await file.text());
  } catch {
    showMessage('Import failed: file is not valid JSON.', 'err');
    return;
  }

  const check = validateDump(dump);
  if (!check.ok) {
    showMessage('Import rejected (' + check.errors.length + ' problem(s)). Nothing changed.', 'err');
    console.warn('Import validation errors:', check.errors);
    await confirmDialog(check.errors.slice(0, 8).join('\n') +
      (check.errors.length > 8 ? `\n…and ${check.errors.length - 8} more.` : ''),
      { confirmLabel: 'OK', cancelLabel: 'Close' });
    return;
  }

  const choice = await choiceDialog(
    `File is valid: ${dump.categories.length} categories, ${dump.entries.length} entries.\n\nReplace all current data, merge alongside it, or cancel?`,
    [
      { id: 'replace', label: 'Replace All', danger: true },
      { id: 'merge',   label: 'Merge' },
      { id: 'cancel',  label: 'Cancel' },
    ]);
  if (!choice || choice === 'cancel') { showMessage('Import cancelled. Nothing changed.'); return; }
  const mode = choice;

  try {
    const counts = await applyDump(dump, mode);
    showMessage(`Imported: ${counts.categories} categories, ${counts.entries} entries (${mode}).`);
    onDone();
  } catch (err) {
    showMessage('Import error: ' + err.message, 'err');
  }
}