// validate.js — the single gatekeeper for every value written to the DB.
// The schema can't constrain category columns (they're runtime data), so
// type enforcement lives here and runs before add (7a), edit (7b), import (10).

// Validate+coerce ONE value against a declared type.
// Returns { ok:true, value } with a cleaned, correctly-typed value,
// or { ok:false, error } with a human-readable reason.
// Empty input is allowed unless `required` — it becomes null (a clear cell).
export function validateValue(raw, type, { required = false, label = 'value', min = null, max = null } = {}) {
  const isBlank =
    raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');

  if (isBlank) {
    if (required) return { ok: false, error: `${label} is required.` };
    return { ok: true, value: null };
  }

  switch (type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) return { ok: false, error: `${label} must be a number.` };
      if (min != null && n < min) return { ok: false, error: `${label} must be ≥ ${min}.` };
      if (max != null && n > max) return { ok: false, error: `${label} must be ≤ ${max}.` };
      return { ok: true, value: n };
    }
    case 'boolean': {
      // checkbox gives real booleans; strings handled for import later.
      if (typeof raw === 'boolean') return { ok: true, value: raw ? 1 : 0 };
      const s = String(raw).trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(s)) return { ok: true, value: 1 };
      if (['false', '0', 'no', 'n'].includes(s)) return { ok: true, value: 0 };
      return { ok: false, error: `${label} must be true or false.` };
    }
    case 'date': {
      // expect ISO YYYY-MM-DD (the <input type=date> format) and check it's real.
      const s = String(raw).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, error: `${label} must be a date.` };
      const d = new Date(s + 'T00:00:00');
      if (Number.isNaN(d.getTime())) return { ok: false, error: `${label} is not a valid date.` };
      return { ok: true, value: s };
    }
    case 'text':
    default:
      return { ok: true, value: String(raw) };
  }
}

// Validate a whole entry form at once.
// fields: [{ key, type, label, required, source }]  source: 'base' | 'data'
// rawValues: { key: rawInput }
// Returns { ok:true, base:{...}, data:{...} } split for addEntry,
// or { ok:false, errors:[...] } listing every problem (not just the first).
export function validateEntry(fields, rawValues) {
  const errors = [];
  const base = {};
  const data = {};
  

  for (const f of fields) {
    const res = validateValue(rawValues[f.key], f.type, {
      required: f.required, label: f.label, min: f.min, max: f.max,
    });
    if (!res.ok) { errors.push(res.error); continue; }
    if (f.source === 'base') base[f.key] = res.value;
    else if (res.value !== null) data[f.key] = res.value; // omit blank extras from JSON
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, base, data };
}