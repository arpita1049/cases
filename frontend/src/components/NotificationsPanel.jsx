import { useEffect, useState, useRef } from 'react';
import { getNotifications, markNotifRead, markAllNotifsRead } from '../api/endpoints';
import { formatDateTime } from '../utils/format';
import { Bell, AlertTriangle, Clock, ArrowRight, CheckCheck } from 'lucide-react';

const TYPE_ICONS = {
  overlap:  { icon: AlertTriangle, color: 'var(--color-status-overlap)' },
  deadline: { icon: Clock,         color: 'var(--color-status-pending)' },
  overdue:  { icon: Clock,         color: 'var(--color-status-overdue)' },
  transfer: { icon: ArrowRight,    color: 'var(--color-status-process)' },
};

export default function NotificationsPanel({ onClose }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef(null);

  useEffect(() => {
    getNotifications()
      .then(r => setNotifs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const markRead = async (id) => {
    await markNotifRead(id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const markAll = async () => {
    await markAllNotifsRead();
    setNotifs(n => n.map(x => ({ ...x, is_read: true })));
  };

  const grouped = {
    overlap:  notifs.filter(n => n.notification_type === 'overlap'),
    deadline: notifs.filter(n => n.notification_type === 'deadline'),
    overdue:  notifs.filter(n => n.notification_type === 'overdue'),
    transfer: notifs.filter(n => n.notification_type === 'transfer'),
  };

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute', right: 0, top: 'calc(100% + 8px)',
        width: 380, maxHeight: 520,
        background: 'white', borderRadius: 12,
        border: '1px solid var(--color-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,.14)',
        zIndex: 200, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} color="var(--color-primary)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
          {unread > 0 && (
            <span style={{
              background: 'var(--color-status-overdue)', color: 'white',
              borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600
            }}>{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-accent)' }}
          >
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading…
          </div>
        )}
        {!loading && notifs.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Bell size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            No notifications
          </div>
        )}
        {!loading && notifs.map(n => {
          const cfg = TYPE_ICONS[n.notification_type] || TYPE_ICONS.deadline;
          const IconComp = cfg.icon;
          return (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--color-border)',
                background: n.is_read ? 'white' : 'rgba(15,157,138,.04)',
                cursor: 'pointer',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                transition: 'background 150ms',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: cfg.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <IconComp size={14} color={cfg.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: 'var(--color-text-primary)' }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {n.message}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {formatDateTime(n.created_at)}
                </div>
              </div>
              {!n.is_read && (
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--color-accent)', marginTop: 5, flexShrink: 0
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
