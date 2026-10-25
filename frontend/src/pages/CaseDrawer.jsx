import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Clock, User, Building, ArrowRight, AlertTriangle, Plus, ChevronRight } from 'lucide-react';
import { getCase, getCaseActions, addCaseAction, getBureaus } from '../api/endpoints';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatDateTime, truncate } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const ACTION_TYPES = ['Remark Added', 'Status Changed', 'Transferred', 'Escalated', 'Document Uploaded'];
const STATUSES = ['Pending', 'Under Process', 'Disposed', 'Overdue', 'Escalated', 'Closed'];

function ConfirmDialog({ title, message, onConfirm, onCancel, dangerous }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal aria-label={title}>
      <div className="modal">
        {dangerous && (
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        )}
        <h2 className="modal-title">{title}</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, margin: '8px 0 24px' }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className={`btn ${dangerous ? 'btn-danger' : 'btn-accent'}`} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default function CaseDrawer({ caseId, caseData: initialData, onClose, onUpdate }) {
  const [caseDetail, setCaseDetail] = useState(initialData);
  const [actions, setActions] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [bureaus, setBureaus] = useState([]);
  const [addingAction, setAddingAction] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [actionForm, setActionForm] = useState({
    action_type: 'Remark Added',
    remarks: '',
    new_status: '',
    transferred_to_bureau_id: '',
  });
  const { user } = useAuth();

  const readOnly = user?.role === 'Senior Management';

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCase(caseId),
      getCaseActions(caseId),
      getBureaus(),
    ]).then(([cRes, aRes, bRes]) => {
      setCaseDetail(cRes.data);
      setActions(aRes.data);
      setBureaus(bRes.data);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [caseId]);

  const submitAction = async () => {
    if (!actionForm.remarks && !actionForm.new_status) return;
    try {
      const payload = {
        action_type: actionForm.action_type.replace(' ', '_').toUpperCase(),
        remarks: actionForm.remarks,
      };
      if (actionForm.new_status) payload.new_status = actionForm.new_status;
      if (actionForm.transferred_to_bureau_id) payload.transferred_to_bureau_id = parseInt(actionForm.transferred_to_bureau_id);

      // Fix action type format
      const typeMap = {
        'Remark Added': 'Remark Added',
        'Status Changed': 'Status Changed',
        'Transferred': 'Transferred',
        'Escalated': 'Escalated',
        'Document Uploaded': 'Document Uploaded',
      };
      payload.action_type = typeMap[actionForm.action_type] || actionForm.action_type;

      await addCaseAction(caseId, payload);
      const [cRes, aRes] = await Promise.all([getCase(caseId), getCaseActions(caseId)]);
      setCaseDetail(cRes.data);
      setActions(aRes.data);
      setAddingAction(false);
      setActionForm({ action_type: 'Remark Added', remarks: '', new_status: '', transferred_to_bureau_id: '' });
      onUpdate?.();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to add action.');
    }
  };

  const c = caseDetail;

  return (
    <>
      {/* Overlay */}
      <div
        className="drawer-overlay open"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside className="drawer open" role="complementary" aria-label="Case details">
        {/* Header */}
        <div className="drawer-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: 'var(--color-primary)' }}>
                {c?.case_code}
              </span>
              {c && <StatusBadge status={c.status} />}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {c?.institution?.name} · {c?.bureau?.name}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close drawer">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 28px', borderBottom: '1px solid var(--color-border)' }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {['overview', 'history', 'documents'].map(t => (
              <button
                key={t}
                className={`tab-btn ${activeTab === t ? 'active' : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t === 'overview' ? 'Overview' : t === 'history' ? 'Action History' : 'Documents'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {activeTab === 'overview' && c && (
            <div>
              {/* Key info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Institution',   value: c.institution?.name },
                  { label: 'AICTE ID',      value: c.institution?.aicte_permanent_id },
                  { label: 'Bureau / Cell', value: `${c.bureau?.code} – ${c.bureau?.name}` },
                  { label: 'Assigned Officer', value: c.officer?.full_name || '—' },
                  { label: 'Received Date',  value: formatDate(c.received_date) },
                  { label: 'Due Date',       value: formatDate(c.due_date) },
                  { label: 'Source',         value: c.source || '—' },
                  { label: 'Reference No.',  value: c.reference_number || '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Category & Description */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Category</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.category}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Description</div>
                <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{c.description || '—'}</div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {/* Add action form */}
              {!readOnly && !addingAction && (
                <button className="btn btn-outline btn-sm" onClick={() => setAddingAction(true)} style={{ marginBottom: 20 }}>
                  <Plus size={14} /> Add Action
                </button>
              )}

              {addingAction && (
                <div style={{
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  borderRadius: 10, padding: 18, marginBottom: 20
                }}>
                  <div className="form-group">
                    <label className="form-label">Action Type</label>
                    <select className="form-select" value={actionForm.action_type} onChange={e => setActionForm(f => ({ ...f, action_type: e.target.value }))}>
                      {ACTION_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  {(actionForm.action_type === 'Status Changed') && (
                    <div className="form-group">
                      <label className="form-label">New Status</label>
                      <select className="form-select" value={actionForm.new_status} onChange={e => setActionForm(f => ({ ...f, new_status: e.target.value }))}>
                        <option value="">Select status…</option>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                  {(actionForm.action_type === 'Transferred') && (
                    <div className="form-group">
                      <label className="form-label">Transfer to Bureau</label>
                      <select className="form-select" value={actionForm.transferred_to_bureau_id} onChange={e => setActionForm(f => ({ ...f, transferred_to_bureau_id: e.target.value }))}>
                        <option value="">Select bureau…</option>
                        {bureaus.map(b => <option key={b.id} value={b.id}>{b.code} – {b.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Remarks</label>
                    <textarea className="form-textarea" value={actionForm.remarks} onChange={e => setActionForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Enter your remarks…" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-accent btn-sm" onClick={submitAction}>Submit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAddingAction(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="timeline">
                {actions.length === 0 && (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No actions recorded yet.</p>
                )}
                {[...actions].reverse().map(a => (
                  <div key={a.id} className="timeline-item">
                    <div className="timeline-dot" style={{
                      background: a.action_type === 'Escalated' ? 'var(--color-status-overdue)'
                        : a.action_type === 'Transferred' ? 'var(--color-status-process)'
                        : a.action_type === 'Created' ? 'var(--color-status-disposed)'
                        : 'var(--color-accent)'
                    }} />
                    <div className="timeline-time">{formatDateTime(a.timestamp)}</div>
                    <div className="timeline-content">
                      <div className="timeline-action-type">{a.action_type}</div>
                      {a.remarks && <div className="timeline-remarks">{a.remarks}</div>}
                      {a.previous_status && a.new_status && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <StatusBadge status={a.previous_status} />
                          <ArrowRight size={12} color="var(--color-text-muted)" />
                          <StatusBadge status={a.new_status} />
                        </div>
                      )}
                      <div className="timeline-meta">
                        {a.user?.full_name && <span>By {a.user.full_name}</span>}
                        {a.bureau?.code && <span> · {a.bureau.code}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="empty-state">
              <div className="empty-state-icon">📎</div>
              <div className="empty-state-title">No documents attached</div>
              <div className="empty-state-desc">Document upload is available in the full production system.</div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!readOnly && (
          <div className="drawer-footer">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setConfirm({
                title: 'Escalate Case',
                message: `Are you sure you want to escalate case ${c?.case_code} to Senior Management? This will log an escalation action.`,
                dangerous: true,
                onConfirm: async () => {
                  await addCaseAction(caseId, { action_type: 'Escalated', remarks: 'Escalated to Senior Management.', new_status: 'Escalated' });
                  const [cRes, aRes] = await Promise.all([getCase(caseId), getCaseActions(caseId)]);
                  setCaseDetail(cRes.data); setActions(aRes.data); setConfirm(null); onUpdate?.();
                }
              })}
            >
              <AlertTriangle size={13} /> Escalate
            </button>
          </div>
        )}
      </aside>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          dangerous={confirm.dangerous}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
