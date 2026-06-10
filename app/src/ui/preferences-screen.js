export function renderPreferencesScreen(container, { onBack }) {
  container.innerHTML = `
    <div class="table-head">
      <button class="term-btn" id="back">&lt; Back</button>
      <span class="name">Preferences</span>
    </div>
    <div class="prefs-body">
      <div class="pref-row">
        <span class="field-label">Colour theme</span>
        <span class="pref-stub">Coming soon</span>
      </div>
      <p class="prompt" style="margin-top:14px;">// More settings will appear here.</p>
    </div>
  `;
  container.querySelector('#back').addEventListener('click', onBack);
}