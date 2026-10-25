import { format, parseISO } from 'date-fns';

/** Format an ISO date string as "DD MMM YYYY" */
export function formatDate(iso) {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'dd MMM yyyy'); }
  catch { return iso; }
}

/** Format as "DD MMM YYYY, HH:MM" */
export function formatDateTime(iso) {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'dd MMM yyyy, HH:mm'); }
  catch { return iso; }
}

/** Returns 'today' relative label for dashboard display */
export function relativeDate(iso) {
  if (!iso) return '—';
  try {
    const d = parseISO(iso);
    const now = new Date();
    const diff = Math.round((d - now) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 0) return `In ${diff} days`;
    return `${Math.abs(diff)} days ago`;
  } catch { return iso; }
}

/** Truncate long string */
export function truncate(str, n = 50) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

/** Get initials from a name */
export function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
