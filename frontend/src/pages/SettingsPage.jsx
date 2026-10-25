import { useEffect, useState } from 'react';
import { Users, Clock, FileText, ShieldCheck, Plus, Eye, EyeOff } from 'lucide-react';
import {
  getUsers, createUser, updateUser,
  getBureaus, getDeadlineRules, createDeadlineRule, updateDeadlineRule, getAuditLog
} from '../api/endpoints';
import { formatDateTime } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const ROLES = ['Administrator', 'Bureau/Cell Officer', 'Regional Official', 'Senior Management'];
const REGIONS = ['North', 'South', 'East', 'West', 'Central'];

function AddUserModal({ bureaus, onSave, onClose }) {
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '', role: 'Bureau/Cell Officer', bureau_id: '', region: '' });
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!form.username || !form.email || !form.password || !form.full_name) { setErr('All fields required.'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.bureau_id) payload.bureau_id = parseInt(payload.bureau_id);
      else delete payload.bureau_id;
      if (!payload.region) delete payload.region;
      await createUser(payload);
      onSave();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to create user.');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal>
      <div className="modal" style={{ maxWidth: 520 }}>
        <h2 className="modal-title">Add New User</h2>
        {err && <div style={{ color: 'var(--color-status-overdue)', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Full Name</label>
            <input className="form-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Username</label>
            <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ paddingRight: 36 }} />
              <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Bureau (if applicable)</label>
            <select className="form-select" value={form.bureau_id} onChange={e => setForm(f => ({ ...f, bureau_id: e.target.value }))}>
              <option value="">None</option>
              {bureaus.map(b => <option key={b.id} value={b.id}>{b.code} – {b.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Region (Regional Official)</label>
            <select className="form-select" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
              <option value="">None</option>
              {REGIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create User'}</button>
        </div>
      </div>
    </div>
  );
}

function AddRuleModal({ bureaus, onSave, onClose }) {
  const [form, setForm] = useState({ bureau_id: '', category: '', days_to_resolve: 30, warn_before_days: 5 });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const payload = { ...form, days_to_resolve: parseInt(form.days_to_resolve), warn_before_days: parseInt(form.warn_before_days) };
      if (payload.bureau_id) payload.bureau_id = parseInt(payload.bureau_id); else delete payload.bureau_id;
      if (!payload.category) delete payload.category;
      await createDeadlineRule(payload);
      onSave();
    } catch (e) { alert(e.response?.data?.detail || 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal>
      <div className="modal">
        <h2 className="modal-title">Add Deadline Rule</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 20px' }}>
          Configure custom resolution deadlines. These are not official AICTE timelines.
        </p>
        <div className="form-group">
          <label className="form-label">Bureau (leave blank for global)</label>
          <select className="form-select" value={form.bureau_id} onChange={e => setForm(f => ({ ...f, bureau_id: e.target.value }))}>
            <option value="">Global (all bureaus)</option>
            {bureaus.map(b => <option key={b.id} value={b.id}>{b.code} – {b.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Category (leave blank for all categories)</label>
          <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Student Grievance – Fee Refund" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Days to Resolve</label>
            <input className="form-input" type="number" min={1} value={form.days_to_resolve} onChange={e => setForm(f => ({ ...f, days_to_resolve: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Warn Before (days)</label>
            <input className="form-input" type="number" min={1} value={form.warn_before_days} onChange={e => setForm(f => ({ ...f, warn_before_days: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save Rule'}</button>
        </div>
      </div>
    </div>
  );
}

function EditRuleModal({ rule, bureaus, onSave, onClose }) {
  const [form, setForm] = useState({
    bureau_id: rule.bureau_id ? String(rule.bureau_id) : '',
    category: rule.category || '',
    days_to_resolve: rule.days_to_resolve,
    warn_before_days: rule.warn_before_days,
    is_active: rule.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setSaving(true);
    setErr('');
    try {
      const payload = {
        days_to_resolve: parseInt(form.days_to_resolve, 10),
        warn_before_days: parseInt(form.warn_before_days, 10),
        is_active: form.is_active,
      };
      if (form.bureau_id) payload.bureau_id = parseInt(form.bureau_id, 10);
      else payload.bureau_id = null;
      payload.category = form.category || null;

      await updateDeadlineRule(rule.id, payload);
      onSave();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to update rule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal aria-label="Edit Deadline Rule">
      <div className="modal">
        <h2 className="modal-title">Edit Deadline Rule</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 16px' }}>
          Configurable resolution timelines. Updates trigger automatic recalculation of due dates and alerts.
        </p>
        {err && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <div className="form-group">
          <label className="form-label">Bureau (leave blank for global)</label>
          <select className="form-select" value={form.bureau_id} onChange={e => setForm(f => ({ ...f, bureau_id: e.target.value }))}>
            <option value="">Global (all bureaus)</option>
            {bureaus.map(b => <option key={b.id} value={b.id}>{b.code} – {b.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Category (leave blank for all categories)</label>
          <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Student Grievance – Fee Refund" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Days to Resolve</label>
            <input className="form-input" type="number" min={1} value={form.days_to_resolve} onChange={e => setForm(f => ({ ...f, days_to_resolve: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Warn Before (days)</label>
            <input className="form-input" type="number" min={1} value={form.warn_before_days} onChange={e => setForm(f => ({ ...f, warn_before_days: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Rule is Active
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [bureaus, setBureaus] = useState([]);
  const [rules, setRules] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const { user: currentUser } = useAuth();

  if (currentUser?.role !== 'Administrator') {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <ShieldCheck size={48} style={{ opacity: 0.3 }} />
          <div className="empty-state-title">Administrator Access Required</div>
          <div className="empty-state-desc">This page is only accessible to system administrators.</div>
        </div>
      </div>
    );
  }

  const fetchData = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'users') {
        const [u, b] = await Promise.all([getUsers(), getBureaus()]);
        setUsers(u.data); setBureaus(b.data);
      } else if (tab === 'deadlines') {
        const [r, b] = await Promise.all([getDeadlineRules(), getBureaus()]);
        setRules(r.data); setBureaus(b.data);
      } else if (tab === 'audit') {
        const [a] = await Promise.all([getAuditLog({ per_page: 50 })]);
        setAuditLog(a.data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(activeTab); }, [activeTab]);

  const toggleUserActive = async (u) => {
    await updateUser(u.id, { is_active: !u.is_active });
    fetchData('users');
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Settings & Administration</h1>
        <p className="page-subtitle">User management, deadline configuration, and audit log</p>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {[
          { key: 'users',     label: 'User Management',   icon: Users },
          { key: 'deadlines', label: 'Deadline Rules',    icon: Clock },
          { key: 'audit',     label: 'Audit Log',         icon: FileText },
        ].map(t => (
          <button key={t.key} className={`tab-btn ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            <t.icon size={14} style={{ marginRight: 5, verticalAlign: 'text-bottom' }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-accent btn-sm" onClick={() => setShowAddUser(true)}>
              <Plus size={14} /> Add User
            </button>
          </div>
          <div className="table-container" style={{ background: 'white', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <table>
              <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Bureau</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Loading…</td></tr>}
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{u.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{u.email}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{u.username}</td>
                    <td><span style={{ fontSize: 12, background: 'rgba(30,58,95,.08)', color: 'var(--color-primary)', borderRadius: 5, padding: '2px 8px' }}>{u.role}</span></td>
                    <td style={{ fontSize: 13 }}>{u.bureau?.code || (u.region ? `${u.region} Region` : '—')}</td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-disposed' : 'badge-overdue'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {u.id !== currentUser.id && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleUserActive(u)}
                          style={{ fontSize: 12 }}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Deadline rules tab */}
      {activeTab === 'deadlines' && (
        <>
          <div style={{
            background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)',
            borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400E'
          }}>
            ℹ️ These are configurable deadline rules for the prototype. They do not represent official AICTE timelines.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-accent btn-sm" onClick={() => setShowAddRule(true)}>
              <Plus size={14} /> Add Rule
            </button>
          </div>
          <div className="table-container" style={{ background: 'white', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <table>
              <thead><tr><th>Bureau</th><th>Category</th><th>Days to Resolve</th><th>Warn Before</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Loading…</td></tr>}
                {rules.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{r.bureau?.code || 'Global'}</td>
                    <td style={{ fontSize: 13 }}>{r.category || 'All categories'}</td>
                    <td style={{ fontWeight: 700, fontSize: 16 }}>{r.days_to_resolve} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)' }}>days</span></td>
                    <td style={{ fontSize: 13 }}>{r.warn_before_days} days before</td>
                    <td><span className={`badge ${r.is_active ? 'badge-disposed' : 'badge-closed'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '2px 8px', fontSize: 12 }}
                        onClick={() => setEditingRule(r)}
                        aria-label={`Edit rule for ${r.bureau?.code || 'Global'}`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Audit log tab */}
      {activeTab === 'audit' && (
        <div className="table-container" style={{ background: 'white', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <table>
            <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>IP Address</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Loading…</td></tr>}
              {auditLog.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(l.timestamp)}</td>
                  <td style={{ fontSize: 13 }}>{l.user?.full_name || '—'}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-bg)', padding: '2px 8px', borderRadius: 5, border: '1px solid var(--color-border)' }}>
                      {l.action}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ''}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{l.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddUser && (
        <AddUserModal
          bureaus={bureaus}
          onSave={() => { setShowAddUser(false); fetchData('users'); }}
          onClose={() => setShowAddUser(false)}
        />
      )}
      {showAddRule && (
        <AddRuleModal
          bureaus={bureaus}
          onSave={() => { setShowAddRule(false); fetchData('deadlines'); }}
          onClose={() => setShowAddRule(false)}
        />
      )}
      {editingRule && (
        <EditRuleModal
          rule={editingRule}
          bureaus={bureaus}
          onSave={() => { setEditingRule(null); fetchData('deadlines'); }}
          onClose={() => setEditingRule(null)}
        />
      )}
    </div>
  );
}
