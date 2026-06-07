import { getCategories, addCategory, addCategoryColumn } from '../db/api.js';

let msgEl;

export function initApp() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <header class="term-header">
      <h1>Review Terminal<span class="cursor"></span></h1>
      <div class="sub">Local Database // Offline</div>
    </header>
    <div class="prompt">// Categories</div>
    <ul class="cat-list" id="cat-list"></ul>
    <div id="seed-area" style="margin-top:14px;"></div>
    <div class="msg-strip info" id="msg-strip">&gt; Ready.</div>
  `;
  msgEl = document.querySelector('#msg-strip');
  loadCategories();
}

function showMessage(text, type = 'info') {
  msgEl.className = 'msg-strip ' + type;
  msgEl.textContent = '> ' + text;
}

// Flat rows -> { ...top, children: [...] }. One level deep, matching the schema.
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
  const select = () =>
    showMessage(`Accessing: ${cat.name} — table module pending (Phase 6).`);
  li.addEventListener('click', select);
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter') select(); });
  return li;
}

async function loadCategories() {
  const list = document.querySelector('#cat-list');
  const seedArea = document.querySelector('#seed-area');
  try {
    const cats = await getCategories();   // visible only
    list.innerHTML = '';
    if (cats.length === 0) {
      list.innerHTML = `<li class="empty">No categories found.</li>`;
      seedArea.innerHTML =
        `<button class="term-btn" id="seed">+ Seed sample categories</button>`;
      document.querySelector('#seed').addEventListener('click', seedSamples);
      showMessage('Database empty. Seed samples to see the list.', 'warn');
      return;
    }
    seedArea.innerHTML = '';
    for (const node of buildTree(cats)) {
      list.appendChild(catRow(node, false));
      for (const child of node.children) list.appendChild(catRow(child, true));
    }
    showMessage(`${cats.length} categories loaded.`);
  } catch (err) {
    showMessage('DB error: ' + err.message, 'err');
  }
}

// Temporary dev helper — real category creation arrives in Phase 8.
async function seedSamples() {
  try {
    const books = await addCategory('Books');
    await addCategoryColumn(books, 'author', 'text', 0);
    await addCategoryColumn(books, 'pages', 'number', 1);
    await addCategory('Fiction', books);   // a *visible* subcategory, to show nesting
    await addCategory('Games');
    await addCategory('Food');
    showMessage('Sample categories created.');
    loadCategories();
  } catch (err) {
    showMessage('Seed failed: ' + err.message, 'err');
  }
}