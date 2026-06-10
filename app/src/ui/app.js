import { getCategories, setCategoryHidden } from '../db/api.js';
import { renderTable } from './table.js';
import { renderEntryForm } from './entry-form.js';
import { renderCategoryForm } from './category-form.js';
import { renderDataScreen } from './data-screen.js';
import { renderCategoryEdit } from './category-edit.js';
import { renderHelpScreen } from './help-screen.js';
import { renderPreferencesScreen } from './preferences-screen.js';

let msgEl, contentEl;

export function initApp() {
    const app = document.querySelector('#app');
    app.innerHTML = `
    <header class="term-header">
      <div class="hdr-main">
        <h1>P1: Review-Terminal<span class="cursor"></span></h1>
        <button class="icon-btn" id="menu-btn" title="Menu" aria-label="Menu">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
        </button>
      </div>
      <div class="sub">Local Database // Offline</div>
    </header>
    <div id="content"></div>
    <div class="msg-strip info" id="msg-strip">&gt; Ready.</div>
  `;
    msgEl = document.querySelector('#msg-strip');
    contentEl = document.querySelector('#content');
    document.querySelector('#menu-btn').addEventListener('click', openMenu);
    renderCategoryList();
}

function showMessage(text, type = 'info') {
    msgEl.className = 'msg-strip ' + type;
    msgEl.textContent = '> ' + text;
}

function catRow(cat) {
    const li = document.createElement('li');
    li.className = 'cat-item';
    li.textContent = cat.name;
    li.tabIndex = 0;
    const open = () => openCategory(cat);
    li.addEventListener('click', open);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    return li;
}

async function renderCategoryList() {
    try {
        const cats = await getCategories(); // visible only
        contentEl.innerHTML = `
      <div class="cat-toolbar">
        <div class="tb-left"><div class="prompt" style="margin:0;">// Categories</div></div>
        <div class="tb-right">
          <button class="term-btn" id="new-cat">+ New</button>
        </div>
      </div>
      <ul class="cat-list" id="cat-list"></ul>
    `;
        const list = contentEl.querySelector('#cat-list');
        contentEl.querySelector('#new-cat').addEventListener('click', openNewCategory);

        if (cats.length === 0) {
            list.innerHTML = `<li class="empty">No categories. Tap + New to begin.</li>`;
            showMessage('Database empty. Create your first category.', 'warn');
            return;
        }
        for (const cat of cats) list.appendChild(catRow(cat));
        showMessage(`${cats.length} categories loaded.`);
    } catch (err) {
        showMessage('DB error: ' + err.message, 'err');
    }
}

// Manage view: shows ALL categories incl. hidden, with hide/show toggles.
async function renderManageList() {
    try {
        const cats = await getCategories(true); // include hidden
        contentEl.innerHTML = `
      <div class="cat-toolbar">
        <div class="tb-left"><button class="term-btn" id="back-cats">&lt; Back</button></div>
        <div class="tb-right"><button class="term-btn" id="new-cat">+ New</button></div>
      </div>
      <div class="prompt">// Manage Categories</div>
      <ul class="cat-list" id="manage-list"></ul>
    `;
        contentEl.querySelector('#back-cats').addEventListener('click', renderCategoryList);
        contentEl.querySelector('#new-cat').addEventListener('click', openNewCategory);
        const list = contentEl.querySelector('#manage-list');

        if (cats.length === 0) {
            list.innerHTML = `<li class="empty">No categories yet.</li>`;
            showMessage('No categories to manage.', 'warn');
            return;
        }
        for (const cat of cats) {
            const li = document.createElement('li');
            li.className = 'manage-item' + (cat.is_hidden ? ' hidden-cat' : '');
            li.innerHTML = `
        <span class="mi-name">${cat.name}${cat.is_hidden ? ' <span class="tag">[hidden]</span>' : ''}</span>
        <span class="mi-actions">
          <button class="term-btn small edit-cat" data-id="${cat.id}">Edit</button>
          <button class="term-btn small toggle-hide" data-id="${cat.id}" data-hidden="${cat.is_hidden}">
            ${cat.is_hidden ? 'Show' : 'Hide'}
          </button>
        </span>`;
            li.querySelector('.toggle-hide').addEventListener('click', async(e) => {
                const id = Number(e.target.dataset.id);
                const nowHidden = e.target.dataset.hidden === '1' ? 0 : 1;
                try {
                    await setCategoryHidden(id, nowHidden);
                    showMessage(nowHidden ? 'Category hidden (data kept).' : 'Category shown.');
                    renderManageList();
                } catch (err) { showMessage('Failed: ' + err.message, 'err'); }
            });
            li.querySelector('.edit-cat').addEventListener('click', () => {
                renderCategoryEdit(contentEl, { id: cat.id, name: cat.name }, {
                    showMessage,
                    onBack: renderManageList,
                });
            });
            list.appendChild(li);
        }
        showMessage(`${cats.length} categories (incl. hidden).`);
    } catch (err) {
        showMessage('DB error: ' + err.message, 'err');
    }
}

function openNewCategory() {
    renderCategoryForm(contentEl, {
        showMessage,
        onSaved: () => renderCategoryList(),
        onCancel: () => renderCategoryList(),
    });
}

function openCategory(cat) {
    contentEl.innerHTML = `
    <div class="cat-toolbar">
      <div class="tb-left">
        <button class="term-btn" id="back-cats">&lt; Categories</button>
        <button class="term-btn" id="new-entry">+ New Entry</button>
      </div>
      <div class="tb-right" id="tb-right"></div>
    </div>
    <div id="table-host"></div>
  `;
    const tbRight = contentEl.querySelector('#tb-right');
    const tableHost = contentEl.querySelector('#table-host');
    contentEl.querySelector('#back-cats').addEventListener('click', renderCategoryList);
    contentEl.querySelector('#new-entry').addEventListener('click', () => {
        renderEntryForm(contentEl, cat, null, {
            showMessage,
            onSaved: () => openCategory(cat),
            onCancel: () => openCategory(cat),
        });
    });
    renderTable(tableHost, cat, {
        showMessage,
        onEdit: (entry) => renderEntryForm(contentEl, cat, entry, {
            showMessage,
            onSaved: () => openCategory(cat),
            onCancel: () => openCategory(cat),
        }),
        controlsHost: tbRight,
    });
}

function openMenu() {
    // build drawer once
    let drawer = document.querySelector('#menu-drawer');
    if (drawer) {
        drawer.classList.add('open');
        document.querySelector('#menu-scrim').classList.add('open');
        return;
    }

    const scrim = document.createElement('div');
    scrim.id = 'menu-scrim';
    scrim.className = 'menu-scrim';
    drawer = document.createElement('nav');
    drawer.id = 'menu-drawer';
    drawer.className = 'menu-drawer';
    drawer.innerHTML = `
    <div class="menu-head">Menu</div>
    <button class="menu-item" data-go="manage">Manage Categories</button>
    <button class="menu-item" data-go="data">Data</button>
    <button class="menu-item" data-go="prefs">Preferences</button>
    <button class="menu-item" data-go="help">Help</button>
  `;
    document.body.appendChild(scrim);
    document.body.appendChild(drawer);

    const close = () => {
        drawer.classList.remove('open');
        scrim.classList.remove('open');
    };
    scrim.addEventListener('click', close);
    drawer.querySelectorAll('.menu-item').forEach((b) =>
        b.addEventListener('click', () => {
            close();
            goTo(b.dataset.go);
        }));

    requestAnimationFrame(() => {
        drawer.classList.add('open');
        scrim.classList.add('open');
    });
}

function goTo(dest) {
    if (dest === 'manage') return renderManageList();
    if (dest === 'data')
        return renderDataScreen(contentEl, { showMessage, onBack: renderCategoryList, onDataChanged: renderCategoryList });
    if (dest === 'prefs')
        return renderPreferencesScreen(contentEl, { onBack: renderCategoryList });
    if (dest === 'help')
        return renderHelpScreen(contentEl, { onBack: renderCategoryList });
}