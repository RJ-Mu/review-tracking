import { exportAll } from '../db/api.js';
import { setSetting } from '../db/api.js';

export async function runExport({ showMessage }) {
    try {
        const dump = await exportAll();
        const json = JSON.stringify(dump, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = url;
        a.download = `review-terminal-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showMessage(`Exported ${dump.categories.length} categories, ${dump.entries.length} entries.`);
        await setSetting('last_backup', new Date().toISOString());
    } catch (err) {
        showMessage('Export failed: ' + err.message, 'err');
    }
}