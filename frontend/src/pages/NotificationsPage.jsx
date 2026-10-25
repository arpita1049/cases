import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Clock, ArrowRight, CheckCheck, Filter } from 'lucide-react';
import { getNotifications, markNotifRead, markAllNotifsRead } from '../api/endpoints';
import { formatDateTime } from '../utils/format';

const TYPE_CONFIG = {
  overlap:  { label: 'Overlap',            color: '#7C3AED', bg: 'rgba(124,58,237,.08)', icon: AlertTriangle },
  deadline: { label: 'Approaching Deadline', color: '#F59E0B', bg: 'rgba(245,158,11,.08)', icon: Clock },
  overdue:  { label: 'Overdue',            color: '#DC2626', bg: 'rgba(220,38,38,.08)', icon: Clock },
  transfer: { label: 'Transfer/Escalation', color: '#3B82F6', bg: 'rgba(59,130,246,.08)', icon: ArrowRight },
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('');

  useEffect(() => {
    getNotifications()
      .then(r => setNotifs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    await markNotifRead(id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const markAll = async () => {
    await markAllNotifsRead();
    setNotifs(n => n.map(x => ({ ...x, is_read: true })));
  };

  const unread = notifs.filter(n => !n.is_read).length;
  const filtered = activeType ? notifs.filter(n => n.notification_type === activeType) : notifs;

  // Group by type for display
  const grouped = {};
  filtered.forEach(n => {
    const type = n.notification_type || 'other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(n);
  });

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Alerts & Notifications</h1>
          <p className="page-subtitle">
            {unread > 0 ? `${unread} unread notification${unread !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button className="btn btn-outline btn-sm" onClick={markAll}>
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {/* Type filter tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab-btn ${!activeType ? 'active' : ''}`} onClick={() => setActiveType('')}>
          All ({notifs.length})
        </button>
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const count = notifs.filter(n => n.notification_type === key).length;
          if (!count) return null;
          return (
            <button key={key} className={`tab-btn ${activeType === key ? 'active' : ''}`} onClick={() => setActiveType(key)}>
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading notifications…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Bell size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div className="empty-state-title">No notifications</div>
          <div className="empty-state-desc">You're all caught up.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(grouped).map(([type, items]) => {
            const cfg = TYPE_CONFIG[type] || { label: type, color: '#6B7280', bg: '#f0f0f0', icon: Bell };
            const IconComp = cfg.icon;
            return (
              <div key={type} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Group header */}
                <div style={{
                  padding: '12px 20px', borderBottom: '1px solid var(--color-border)',
                  background: cfg.bg, display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <IconComp size={15} color={cfg.color} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>({items.length})</span>
                </div>

                {/* Notification items */}
                {items.map((n, idx) => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markRead(n.id)}
                    style={{
                      padding: '14px 20px',
                      borderBottom: idx < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                      background: n.is_read ? 'white' : `${cfg.bg}`,
                      display: 'flex', gap: 14, alignItems: 'flex-start',
                      cursor: n.is_read ? 'default' : 'pointer',
                      transition: 'background 150ms',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: cfg.color + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <IconComp size={16} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: n.is_read ? 400 : 700, fontSize: 14, marginBottom: 3 }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {formatDateTime(n.created_at)}
                      </div>
                    </div>
                    {!n.is_read && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: cfg.color, marginTop: 6, flexShrink: 0
                      }} />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
