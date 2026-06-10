// Format an ISO date string (YYYY-MM-DD) per the user's setting.
// fmt: 'iso' (default) or 'dmy'.
export function formatDate(iso, fmt) {
    if (!iso || typeof iso !== 'string') return iso;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    if (fmt === 'dmy') return `${m[3]}/${m[2]}/${m[1]}`;
    return `${m[1]}-${m[2]}-${m[3]}`;
}