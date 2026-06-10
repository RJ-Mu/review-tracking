function esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const SECTIONS = [{
        h: 'What is P1?',
        p: `P1 is a personal review log. Everything you enter is stored on this device only — no account, no server. It works fully offline once installed.`
    },
    {
        h: 'Getting started',
        p: `1. From the main screen, tap + New to create a category (e.g. "Books").
2. Give it extra columns if you want — each has a type: text, number, boolean, or date. Number columns can have an optional min/max.
3. Open the category and tap + New Entry to log a review.`
    },
    {
        h: 'Categories & columns',
        p: `Categories are fully yours to shape. Use the menu → Manage to rename a category, add or rename columns, remove a column, or hide a category without deleting its data. Renaming a column keeps your existing values; removing one hides them (they return if you re-add a column with the same name).`
    },
    {
        h: 'Viewing entries',
        p: `Tap any column header to sort by it; tap again to reverse. Use the filter icon to narrow the table — search text columns, set number/date ranges, combine filters across columns. Long text wraps so you rarely need to scroll sideways.`
    },
    {
        h: 'Editing & deleting',
        p: `Tap a row to edit it; only the fields you change are saved. Clear a field to empty it without deleting the row. To delete, tap the select icon, tick the rows, then the trash icon.`
    },
    {
        h: 'Backups — important',
        p: `Use the menu → Data → Export to save everything to a file. Do this regularly. Your device's storage can be cleared by the browser under pressure or, on iPhone, after long disuse — the export file is your only way back. Import the file to restore, or to move data to another device.`
    },
];

export function renderHelpScreen(container, { onBack }) {
    container.innerHTML = `
    <div class="table-head">
      <button class="term-btn" id="back">&lt; Back</button>
      <span class="name">Help</span>
    </div>
    <div class="help-body">
      ${SECTIONS.map((s) => `
        <section class="help-section">
          <h3>${esc(s.h)}</h3>
          <p>${esc(s.p).replace(/\n/g, '<br>')}</p>
        </section>`).join('')}
      <p class="prompt" style="margin-top:18px;">// P1 — offline, on-device.</p>
    </div>
  `;
  container.querySelector('#back').addEventListener('click', onBack);
}