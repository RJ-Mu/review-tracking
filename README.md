# P1 — a personal review terminal

P1 is an offline-first, installable web app for logging and browsing personal reviews
across custom categories — books, games, coffee, whatever you want to track. It runs
entirely on your device: no account, no server, no network required after the first
install. The aesthetic is a green-phosphor CRT terminal.

**Live:** https://rj-mu.github.io/review-tracking/
**Install:** open the link on a phone and "Add to Home Screen" (Android: Chrome · iOS: Safari).

![P1 category list](app/screenshots/screenshot-list.png)
![P1 table view](app/screenshots/screenshot-table.png)


---

## What it does

- **Custom categories** with their own typed columns (text / number / boolean / date),
  defined at runtime — adding a "Whisky" category with `distillery` and `abv` fields
  needs no code change.
- **Full CRUD on entries** — add, edit (writing only changed fields), clear a field
  without deleting the row, and multi-select delete.
- **Sort** by any column and **filter** across multiple columns at once, with
  type-aware controls (value search for text, ranges for numbers and dates).
- **Type validation** on every write, including optional per-column min/max.
- **Autocomplete** on text fields that suggests existing values, to stop the same
  author being logged under three different spellings.
- **Export / import** the whole database as a portable JSON file, with validation
  before any import touches your data — this is also the backup and device-transfer path.
- **Installs as a PWA** and works fully offline, including the database engine.

---

## Why it's built this way

The interesting part of this project is the constraints and the decisions they forced.

**Offline-first, on-device, no server.** The goal was a tool that works with no
connectivity and keeps data fully on the device. That ruled out the conventional
client/server shape and led to running an actual SQL database *in the browser*:
SQLite compiled to WebAssembly, persisting to the [Origin Private File System (OPFS)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).

**SQLite runs in a Web Worker.** OPFS only exposes the synchronous file-access handles
SQLite needs from inside a Worker thread, never the main thread. So the database lives
in a worker, and the UI talks to it through a small promise-based message bridge. The
[SAH-pool VFS](https://sqlite.org/wasm/doc/trunk/persistence.md) is used for persistence
specifically because it needs no special cross-origin HTTP headers, which keeps hosting
on GitHub Pages simple.

**Category-specific fields are stored as JSON, not as relational rows.** Each entry has
shared base columns (title, rating, notes, date) as real table columns, plus a single
`data` column holding that category's extra fields as JSON. The relational (EAV)
alternative — a separate row per field — buys filtering performance only at large scale
and costs a join on every read plus a harder sync story. For a personal log of hundreds
to low-thousands of entries, JSON is simpler to read, write, and eventually sync, and it
models "categories are fluid runtime data" naturally. Type and range constraints are
enforced in a validation layer rather than the schema, because the columns don't exist
until a user creates them.

**All data access goes through one module (`api.js`).** Every read and write is a
function there; no SQL leaks into the UI. This is the seam that makes a future cloud-sync
layer addable without rewriting the app, which is also why every row carries an id and
`created_at` / `updated_at` timestamps.

**A `schema_version` table is present from day one** so that future schema changes can
migrate existing on-device data cleanly rather than discarding it.

---

## Stack

| Layer | Choice |
|---|---|
| Build / dev | Vite (vanilla JS, no framework) |
| Database | SQLite-WASM (`@sqlite.org/sqlite-wasm`) in a Web Worker, OPFS SAH-pool VFS |
| UI | Vanilla JS + HTML + CSS |
| PWA | `vite-plugin-pwa` (service worker precaches the app shell incl. the WASM binary) |
| Hosting | GitHub Pages, deployed by GitHub Actions on every push to `main` |

No backend runs at app runtime. There is no server component.

---

## Project layout

```
review-tracking/
├─ schema.sql, cli.py, review_db.py   # Python-era reference specs (not shipped)
└─ app/                               # the actual product
   ├─ vite.config.js
   ├─ index.html
   ├─ icon-build/                     # icon generator + source, and the resize script
   ├─ public/icons/                   # generated PWA icons
   └─ src/
      ├─ db/        worker.js · client.js · schema.js · api.js
      ├─ ui/        app.js · table.js · entry-form.js · category-form.js
      │             category-edit.js · filters.js · export.js · import.js
      │             data-screen.js · confirm.js · styles.css
      └─ validate.js
```

The Python files in the repo root are the original reference implementation the
JS/SQLite data layer was ported from. They are kept as specs, not shipped.

---

## Running locally

Requires Node 20+.

```bash
cd app
npm install
npm run dev          # dev server with live reload
```

To test the PWA (service worker + offline) you need a production build, since the
service worker is only generated at build time:

```bash
npm run build
npm run preview      # serves the built app at /review-tracking/
```

## Deploying

Pushing to `main` triggers the GitHub Actions workflow in `.github/workflows/`, which
builds `app/` and publishes `app/dist` to GitHub Pages. No manual build or deploy step.

---

## Notes & limitations

- **Storage is per-device and per-origin.** Each install has its own independent SQLite
  database; nothing is shared between devices or users. (Cross-device sync is future work.)
- **OPFS can be evicted** by the browser under storage pressure or, on iOS, after long
  disuse. The export feature is the recovery path — export periodically, especially on iOS.
- **Updates are automatic** (the service worker self-updates on next launch) and never
  touch stored data; only a future schema change would require migration logic, for which
  the `schema_version` table is already in place.

## Roadmap

- Cloud sync + optional accounts (the data layer is structured to accommodate this)
- Cross-category search and a recent-activity view
- Summary stats per category
