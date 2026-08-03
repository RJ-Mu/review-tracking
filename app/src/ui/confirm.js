function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Returns a Promise<boolean>: true = confirmed, false = cancelled.
export function confirmDialog(message, { confirmLabel = 'Confirm', cancelLabel = 'Cancel' } = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <div class="modal-msg">${escapeHtml(message)}</div>
        <div class="modal-actions">
          <button class="term-btn" data-act="cancel">${escapeHtml(cancelLabel)}</button>
          <button class="term-btn danger" data-act="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
        document.body.appendChild(overlay);

        const close = (val) => {
            overlay.remove();
            document.removeEventListener('keydown', onKey);
            resolve(val);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') close(false);
            else if (e.key === 'Enter') close(true);
        };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
        overlay.querySelector('[data-act="confirm"]').addEventListener('click', () => close(true));
        document.addEventListener('keydown', onKey);
        overlay.querySelector('[data-act="confirm"]').focus();
    });
}

// Three-way choice dialog. options: [{ id, label, danger? }].
// Resolves with the chosen id, or null if cancelled/dismissed.
export function choiceDialog(message, options) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const btns = options.map((o) =>
            `<button class="term-btn ${o.danger ? 'danger' : ''}" data-id="${o.id}">${escapeHtml(o.label)}</button>`
        ).join('');
        overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <div class="modal-msg">${escapeHtml(message)}</div>
        <div class="modal-actions modal-actions-col">${btns}</div>
      </div>`;
        document.body.appendChild(overlay);

        const close = (val) => {
            overlay.remove();
            document.removeEventListener('keydown', onKey);
            resolve(val);
        };
        const onKey = (e) => { if (e.key === 'Escape') close(null); };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
        overlay.querySelectorAll('[data-id]').forEach((b) =>
            b.addEventListener('click', () => close(b.dataset.id)));
        document.addEventListener('keydown', onKey);
    });
}

// Confirmation that requires typing an exact string. Resolves true/false.
export function confirmTypedDialog(message, requiredText, { confirmLabel = 'Delete' } = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <div class="modal-msg">${escapeHtml(message)}</div>
        <input class="term-input" id="tc-input" type="text" autocomplete="off"
               placeholder="${escapeHtml(requiredText)}" style="margin-bottom:14px;" />
        <div class="modal-actions modal-actions-col">
          <button class="term-btn danger" id="tc-ok" disabled>${escapeHtml(confirmLabel)}</button>
          <button class="term-btn" id="tc-cancel">Cancel</button>
        </div>
      </div>`;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('#tc-input');
        const ok = overlay.querySelector('#tc-ok');
        const close = (val) => {
            overlay.remove();
            document.removeEventListener('keydown', onKey);
            resolve(val);
        };
        const onKey = (e) => { if (e.key === 'Escape') close(false); };
        input.addEventListener('input', () => {
            ok.disabled = input.value.trim() !== requiredText;
        });
        ok.addEventListener('click', () => { if (!ok.disabled) close(true); });
        overlay.querySelector('#tc-cancel').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        document.addEventListener('keydown', onKey);
        input.focus();
    });
}