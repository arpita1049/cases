import { useEffect, useState } from 'react';
import { X, Clock, User, Building, ArrowRight, AlertTriangle, Plus, Printer, ExternalLink, ShieldAlert } from 'lucide-react';
import { getCase, getCaseActions, addCaseAction, getBureaus, getOverlaps } from '../api/endpoints';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatDateTime, truncate } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const ACTION_TYPES = ['Remark Added', 'Status Changed', 'Transferred', 'Escalated', 'Document Uploaded'];
const STATUSES = ['Pending', 'Under Process', 'Action initiated', 'Disposed', 'Overdue', 'Escalated', 'Closed'];

function EscalateModal({ caseCode, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState('');

  return (
    <div className="modal-overlay" role="dialog" aria-modal aria-label="Escalate Case">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-status-overdue)', marginBottom: 12 }}>
          <ShieldAlert size={24} />
          <h2 className="modal-title" style={{ margin: 0 }}>Escalate Case {caseCode}</h2>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: '0 0 16px' }}>
          This action marks the complaint as <strong>ESCALATED</strong>, alerts the Bureau Head and Senior Management, and creates a permanent entry in the immutable audit log.
        </p>

        <div className="form-group">
          <label className="form-label" htmlFor="escalate-reason">
            Escalation Reason <span style={{ color: '#DC2626' }}>* (Required)</span>
          </label>
          <textarea
            id="escalate-reason"
            className="form-textarea"
            rows={4}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="State the justification for escalating this case (e.g. repeated deadline breach, jurisdictional conflict, severe allegation)…"
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => onConfirm(reason.trim())}
            disabled={!reason.trim() || loading}
            id="btn-confirm-escalate"
          >
            {loading ? 'Escalating…' : 'Confirm Escalation'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CaseDrawer({ caseId, caseData: initialData, onClose, onUpdate }) {
  const [caseDetail, setCaseDetail] = useState(initialData);
  const [actions, setActions] = useState([]);
  const [overlaps, setOverlaps] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [bureaus, setBureaus] = useState([]);
  const [addingAction, setAddingAction] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [actionForm, setActionForm] = useState({
    action_type: 'Remark Added',
    remarks: '',
    new_status: '',
    transferred_to_bureau_id: '',
  });

  const { user } = useAuth();
  const readOnly = user?.role === 'Senior Management';

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getCase(caseId),
      getCaseActions(caseId),
      getBureaus(),
      getOverlaps({ case_id: caseId }),
    ])
      .then(([cRes, aRes, bRes, oRes]) => {
        setCaseDetail(cRes.data);
        setActions(aRes.data);
        setBureaus(bRes.data);
        setOverlaps(oRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [caseId]);

  const submitAction = async () => {
    if (!actionForm.remarks && !actionForm.new_status && !actionForm.transferred_to_bureau_id) return;
    try {
      const payload = {
        action_type: actionForm.action_type,
        remarks: actionForm.remarks,
      };
      if (actionForm.new_status) payload.new_status = actionForm.new_status;
      if (actionForm.transferred_to_bureau_id) payload.transferred_to_bureau_id = parseInt(actionForm.transferred_to_bureau_id, 10);

      await addCaseAction(caseId, payload);
      await loadData();
      setAddingAction(false);
      setActionForm({ action_type: 'Remark Added', remarks: '', new_status: '', transferred_to_bureau_id: '' });
      onUpdate?.();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to add action.');
    }
  };

  const handleEscalateConfirm = async (reason) => {
    setEscalating(true);
    try {
      await addCaseAction(caseId, {
        action_type: 'Escalated',
        remarks: reason,
        new_status: 'Escalated',
      });
      await loadData();
      setShowEscalateModal(false);
      onUpdate?.();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to escalate case.');
    } finally {
      setEscalating(false);
    }
  };

  const handlePrintTimeline = () => {
    window.print();
  };

  const c = caseDetail;

  return (
    <>
      {/* Overlay */}
      <div className="drawer-overlay open" onClick={onClose} aria-hidden />

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
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'history', label: `Timeline (${actions.length})` },
              { id: 'related', label: `Related Cases (${overlaps.length})` },
              { id: 'documents', label: 'Documents' },
            ].map(t => (
              <button
                key={t.id}
                className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
                id={`tab-drawer-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {/* Overview Tab */}
          {activeTab === 'overview' && c && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Institution', value: c.institution?.name },
                  { label: 'AICTE ID', value: c.institution?.aicte_permanent_id },
                  { label: 'Region', value: c.institution?.region || '—' },
                  { label: 'Bureau / Cell', value: `${c.bureau?.code} – ${c.bureau?.name}` },
                  { label: 'Assigned Officer', value: c.officer?.full_name || '—' },
                  { label: 'Received Date', value: formatDate(c.received_date) },
                  { label: 'Due Date', value: formatDate(c.due_date) },
                  { label: 'Source', value: c.source || 'Portal' },
                  { label: 'Reference No.', value: c.reference_number || '—' },
                  { label: 'Complainant', value: c.complainant_name || 'Anonymous' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Category</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.category}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, background: '#FAFAFA', padding: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                  {c.description || 'No description provided.'}
                </div>
              </div>
            </div>
          )}

          {/* Action History / Timeline Tab */}
          {activeTab === 'history' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                {!readOnly && !addingAction && (
                  <button className="btn btn-outline btn-sm" onClick={() => setAddingAction(true)} id="btn-add-action">
                    <Plus size={14} /> Add Action
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={handlePrintTimeline} style={{ marginLeft: 'auto' }} aria-label="Print audit timeline">
                  <Printer size={14} /> Print Timeline
                </button>
              </div>

              {addingAction && (
                <div style={{
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  borderRadius: 10, padding: 18, marginBottom: 20
                }}>
                  <div className="form-group">
                    <label className="form-label">Action Type</label>
                    <select className="form-select" value={actionForm.action_type} onChange={e => setActionForm(f => ({ ...f, action_type: e.target.value }))}>
                      {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {actionForm.action_type === 'Status Changed' && (
                    <div className="form-group">
                      <label className="form-label">New Status</label>
                      <select className="form-select" value={actionForm.new_status} onChange={e => setActionForm(f => ({ ...f, new_status: e.target.value }))}>
                        <option value="">Select status…</option>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                  {actionForm.action_type === 'Transferred' && (
                    <div className="form-group">
                      <label className="form-label">Transfer to Bureau</label>
                      <select className="form-select" value={actionForm.transferred_to_bureau_id} onChange={e => setActionForm(f => ({ ...f, transferred_to_bureau_id: e.target.value }))}>
                        <option value="">Select destination bureau…</option>
                        {bureaus.filter(b => b.id !== c?.bureau_id).map(b => (
                          <option key={b.id} value={b.id}>{b.code} – {b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Remarks</label>
                    <textarea className="form-textarea" value={actionForm.remarks} onChange={e => setActionForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Enter your remarks…" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-accent btn-sm" onClick={submitAction}>Submit Action</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAddingAction(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Timeline list */}
              <div className="timeline">
                {actions.length === 0 && (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No action history recorded yet.</p>
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
                      <div className="timeline-action-type" style={{ fontWeight: 600 }}>{a.action_type}</div>
                      {a.remarks && <div className="timeline-remarks" style={{ fontSize: 13, marginTop: 4 }}>{a.remarks}</div>}
                      {a.previous_status && a.new_status && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <StatusBadge status={a.previous_status} />
                          <ArrowRight size={12} color="var(--color-text-muted)" />
                          <StatusBadge status={a.new_status} />
                        </div>
                      )}
                      <div className="timeline-meta" style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {a.user?.full_name && <span>By {a.user.full_name}</span>}
                        {a.bureau?.code && <span> · {a.bureau.code}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Cases Tab (Requirement 7) */}
          {activeTab === 'related' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                Complaints flagged by the cross-bureau overlap engine involving the same institution or correlated claims.
              </p>
              {overlaps.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🛡️</div>
                  <div className="empty-state-title">No Cross-Bureau Overlaps</div>
                  <div className="empty-state-desc">No overlapping complaints detected across other bureaus for this institution.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {overlaps.map(alert => {
                    const otherCase = alert.case_a_id === caseId ? alert.case_b : alert.case_a;
                    return (
                      <div key={alert.id} className="card" style={{ padding: 14, borderLeft: alert.match_level === 'HIGH' ? '4px solid #DC2626' : alert.match_level === 'MEDIUM' ? '4px solid #F59E0B' : '4px solid #0F9D8A' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--color-primary)' }}>
                              {otherCase?.case_code}
                            </span>
                            <span style={{ marginLeft: 8, fontSize: 12, background: 'rgba(30,58,95,.08)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                              {otherCase?.bureau?.code}
                            </span>
                          </div>
                          <span className={`badge badge-${(alert.match_level || '').toLowerCase()}`}>
                            {alert.match_level} Match
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                          <strong>Reason:</strong> {alert.reason}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
                          <span>Review: <strong>{alert.review_status}</strong> {alert.reviewer?.full_name ? `by ${alert.reviewer.full_name}` : ''}</span>
                          <a
                            href={`/cases?search=${otherCase?.case_code}`}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '2px 6px' }}
                            onClick={() => onClose()}
                          >
                            Open Case <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="empty-state">
              <div className="empty-state-icon">📎</div>
              <div className="empty-state-title">No documents attached</div>
              <div className="empty-state-desc">Document upload is available in the connected production record vault.</div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!readOnly && (
          <div className="drawer-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowEscalateModal(true)}
              id="btn-escalate-case"
              style={{ color: 'var(--color-status-overdue)', borderColor: 'var(--color-status-overdue)' }}
            >
              <AlertTriangle size={13} /> Escalate Case
            </button>
            <button className="btn btn-outline btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </aside>

      {/* Escalate Dialog (Requirement 6) */}
      {showEscalateModal && (
        <EscalateModal
          caseCode={c?.case_code}
          onConfirm={handleEscalateConfirm}
          onCancel={() => setShowEscalateModal(false)}
          loading={escalating}
        />
      )}
    </>
  );
}
