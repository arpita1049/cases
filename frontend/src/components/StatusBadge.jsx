/** Status badge utilities */

export const STATUS_CONFIG = {
  'Pending':          { className: 'badge-pending',   dot: '#F59E0B' },
  'Under Process':    { className: 'badge-process',   dot: '#3B82F6' },
  'Action initiated': { className: 'badge-process',   dot: '#0F9D8A' },
  'Action Initiated': { className: 'badge-process',   dot: '#0F9D8A' },
  'Disposed':         { className: 'badge-disposed',  dot: '#16A34A' },
  'Overdue':          { className: 'badge-overdue',   dot: '#DC2626' },
  'Escalated':        { className: 'badge-escalated', dot: '#DC2626' },
  'Closed':           { className: 'badge-closed',    dot: '#6B7280' },
};

export const MATCH_CONFIG = {
  'Low':    { className: 'badge-low' },
  'Medium': { className: 'badge-medium' },
  'High':   { className: 'badge-high' },
};

export const REVIEW_STATUS_CONFIG = {
  'Pending':      { className: 'badge-pending' },
  'Confirmed':    { className: 'badge-disposed' },
  'Dismissed':    { className: 'badge-closed' },
  'Coordinating': { className: 'badge-process' },
};

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { className: 'badge-closed' };
  return (
    <span className={`badge ${cfg.className}`}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.dot || 'currentColor',
        display: 'inline-block', flexShrink: 0
      }} />
      {status}
    </span>
  );
}

export function MatchBadge({ level }) {
  const cfg = MATCH_CONFIG[level] || { className: 'badge-low' };
  return <span className={`badge ${cfg.className}`}>{level} Match</span>;
}

export function ReviewBadge({ status }) {
  const cfg = REVIEW_STATUS_CONFIG[status] || { className: 'badge-closed' };
  return <span className={`badge ${cfg.className}`}>{status}</span>;
}
