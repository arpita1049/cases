import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Building2, AlertTriangle, Bell,
  BarChart2, Settings, LogOut, ChevronLeft, ChevronRight,
  Search, User, Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';
import NotificationsPanel from './NotificationsPanel';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Case Management',
    items: [
      { to: '/cases',        icon: FileText,       label: 'Cases' },
      { to: '/institutions', icon: Building2,       label: 'Institutions' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/overlaps',      icon: AlertTriangle,  label: 'Overlap Detection' },
      { to: '/notifications', icon: Bell,           label: 'Alerts & Notifications' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/reports',   icon: BarChart2, label: 'Reports & Analytics' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
    roles: ['Administrator'],
  },
];

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Main navigation">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <span style={{ fontSize: 13, fontWeight: 800 }}>A</span>
          </div>
          <div className="sidebar-logo-text">
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>AICTE Dashboard</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}>SIH 2026 · SIH26264</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => {
            if (section.roles && !section.roles.includes(user?.role)) return null;
            return (
              <div key={section.label}>
                <div className="sidebar-section-label">{section.label}</div>
                {section.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    aria-label={label}
                    title={collapsed ? label : undefined}
                  >
                    <span className="nav-item-icon">
                      <Icon size={18} />
                    </span>
                    <span className="nav-item-label">{label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="sidebar-footer">
          <button
            className="nav-item"
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="nav-item-icon">
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </span>
            <span className="nav-item-label">Collapse</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-search" role="search">
            <Search size={15} className="topbar-search-icon" aria-hidden />
            <input
              type="search"
              placeholder="Search cases, institutions…"
              aria-label="Search"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  navigate(`/cases?search=${encodeURIComponent(e.target.value.trim())}`);
                }
              }}
            />
          </div>

          <div className="topbar-actions">
            {/* Notifications */}
            <div style={{ position: 'relative' }} ref={null}>
              <button
                className="icon-btn"
                aria-label="Notifications"
                onClick={() => setNotifOpen(o => !o)}
              >
                <Bell size={18} />
                <span className="notification-badge" aria-hidden />
              </button>
              {notifOpen && (
                <NotificationsPanel onClose={() => setNotifOpen(false)} />
              )}
            </div>

            {/* User menu */}
            <div style={{ position: 'relative' }} ref={userMenuRef}>
              <button
                className="user-menu-btn"
                onClick={() => setUserMenuOpen(o => !o)}
                aria-label="User menu"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <div className="user-avatar" aria-hidden>
                  {initials(user?.full_name || 'U')}
                </div>
                <div style={{ textAlign: 'left', display: window.innerWidth > 768 ? 'block' : 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {user?.full_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {user?.role}
                  </div>
                </div>
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 6,
                    background: 'white', border: '1px solid var(--color-border)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                    minWidth: 200, zIndex: 100, overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{user?.email}</div>
                  </div>
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    style={{
                      width: '100%', padding: '10px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                      fontSize: 14, color: 'var(--color-status-overdue)', textAlign: 'left',
                    }}
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <span>AICTE Complaint Monitoring Dashboard · SIH 2026 · Prototype v1.0</span>
          <span className="demo-badge" aria-label="This application contains synthetic demo data">
            ⚠ Demo Data — Not official AICTE statistics
          </span>
        </footer>
      </div>
    </div>
  );
}
