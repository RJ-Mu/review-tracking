import { getAllSettings, setSetting } from '../db/api.js';
import { applySettings } from './app.js';

const THEMES = [
    { id: 'green', label: 'Green' },
    { id: 'amber', label: 'Amber' },
    { id: 'blue', label: 'Blue' },
    { id: 'white', label: 'White' },
    { id: 'red', label: 'Red' },
    { id: 'purple', label: 'Purple' },
    { id: 'pink', label: 'Pink' },
];

export async function renderPreferencesScreen(container, { onBack }) {
    const s = await getAllSettings();
    const theme = s.theme || 'green';
    const crt = s.crt || 'on';
    const dateFmt = s.date_format || 'iso';

    container.innerHTML = `
    <div class="table-head">
      <button class="term-btn" id="back">&lt; Back</button>
      <span class="name">Preferences</span>
    </div>
    <div class="prefs-body">
      <div class="pref-group">
        <span class="field-label">Colour theme</span>
        <div class="pref-opts" id="theme-opts">
          ${THEMES.map((t) => `<button class="term-btn small theme-opt ${theme === t.id ? 'active' : ''}" data-v="${t.id}">${t.label}</button>`).join('')}
        </div>
      </div>
      <div class="pref-group">
        <span class="field-label">CRT effects (scanlines & flicker)</span>
        <div class="pref-opts" id="crt-opts">
          <button class="term-btn small crt-opt ${crt === 'on' ? 'active' : ''}" data-v="on">On</button>
          <button class="term-btn small crt-opt ${crt === 'off' ? 'active' : ''}" data-v="off">Off</button>
        </div>
      </div>
      <div class="pref-group">
        <span class="field-label">Date format</span>
        <div class="pref-opts" id="date-opts">
          <button class="term-btn small date-opt ${dateFmt === 'iso' ? 'active' : ''}" data-v="iso">2026-06-10</button>
          <button class="term-btn small date-opt ${dateFmt === 'dmy' ? 'active' : ''}" data-v="dmy">10/06/2026</button>
        </div>
      </div>
    </div>
  `;
  container.querySelector('#back').addEventListener('click', onBack);

  const wire = (selector, optClass, key) => {
    container.querySelectorAll(selector + ' .' + optClass).forEach((b) => {
      b.addEventListener('click', async () => {
        container.querySelectorAll(selector + ' .' + optClass).forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        await setSetting(key, b.dataset.v);
        await applySettings();   // re-apply so theme/crt update live
      });
    });
  };
  wire('#theme-opts', 'theme-opt', 'theme');
  wire('#crt-opts', 'crt-opt', 'crt');
  wire('#date-opts', 'date-opt', 'date_format');
}