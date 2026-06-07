import { getCategories, addCategory, addCategoryColumn, addEntry } from '../db/api.js';
import { renderTable } from './table.js';

let msgEl, contentEl;

export function initApp() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <header class="term-header">
      <h1>Review Terminal<span class="cursor"></span></h1>
      <div class="sub">Local Database // Offline</div>
    </header>
    <div id="content"></div>
    <div class="msg-strip info" id="msg-strip">&gt; Ready.</div>
  `;
  msgEl = document.querySelector('#msg-strip');
  contentEl = document.querySelector('#content');
  renderCategoryList();
}

function showMessage(text, type = 'info') {
  msgEl.className = 'msg-strip ' + type;
  msgEl.textContent = '> ' + text;
}

function buildTree(cats) {
  const childrenOf = (id) => cats.filter((c) => c.parent_id === id);
  return cats.filter((c) => c.parent_id === null)
             .map((t) => ({ ...t, children: childrenOf(t.id) }));
}

function catRow(cat, isSub) {
  const li = document.createElement('li');
  li.className = 'cat-item' + (isSub ? ' sub' : '');
  li.textContent = cat.name;
  li.tabIndex = 0;
  const open = () =>
    renderTable(contentEl, cat, { showMessage, onBack: renderCategoryList });
  li.addEventListener('click', open);
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  return li;
}

async function renderCategoryList() {
  try {
    const cats = await getCategories();
    contentEl.innerHTML = `
      <div class="prompt">// Categories</div>
      <ul class="cat-list" id="cat-list"></ul>
      <div id="seed-area" style="margin-top:14px;"></div>
    `;
    const list = contentEl.querySelector('#cat-list');
    const seedArea = contentEl.querySelector('#seed-area');

    if (cats.length === 0) {
      list.innerHTML = `<li class="empty">No categories found.</li>`;
      seedArea.innerHTML = `<button class="term-btn" id="seed">+ Seed sample data</button>`;
      seedArea.querySelector('#seed').addEventListener('click', seedSamples);
      showMessage('Database empty. Seed sample data to explore.', 'warn');
      return;
    }
    for (const node of buildTree(cats)) {
      list.appendChild(catRow(node, false));
      for (const child of node.children) list.appendChild(catRow(child, true));
    }
    showMessage(`${cats.length} categories loaded.`);
  } catch (err) {
    showMessage('DB error: ' + err.message, 'err');
  }
}

// Temporary dev helper — real entry/category creation arrive in Phases 7 & 8.
async function seedSamples() {
  try {
    const books = await addCategory('Books');
    await addCategoryColumn(books, 'author', 'text', 0);
    await addCategoryColumn(books, 'pages', 'number', 1);
    await addEntry(books, 'Dune', 9, 'desert planet', '2021-03-01', { author: 'Frank Herbert', pages: 412 });
    await addEntry(books, '1984', 8.5, 'bleak', '2020-01-15', { author: 'George Orwell', pages: 328 });
    await addEntry(books, 'The Hobbit', 8, 'cozy', '2019-11-20', { author: 'J.R.R. Tolkien', pages: 310 });
    await addEntry(books, 'Neuromancer', 7.5, null, '2022-06-05', { author: 'William Gibson', pages: 271 });
    await addEntry(books, 'Notes to Self', 6, 'no page count', '2023-02-02', { author: 'Me' }); // missing pages

    await addCategory('Fiction', books); // visible subcategory, no entries

    const games = await addCategory('Games');
    await addCategoryColumn(games, 'platform', 'text', 0);
    await addCategoryColumn(games, 'hours', 'number', 1);
    await addEntry(games, 'Hades', 9.5, 'roguelike', '2021-09-09', { platform: 'PC', hours: 40 });
    await addEntry(games, 'Tetris', 8, 'timeless', '2018-04-04', { platform: 'Game Boy', hours: 200 });

    const food = await addCategory('Food'); // no extra columns -> base-only table
    await addEntry(food, 'Margherita Pizza', 8, 'classic', '2024-05-01', {});
    await addEntry(food, 'Pad Thai', 9, 'favorite', '2024-05-03', {});

    showMessage('Sample data created.');
    renderCategoryList();
  } catch (err) {
    showMessage('Seed failed: ' + err.message, 'err');
  }
}