import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, CheckCircle, X, GitMerge, RefreshCw } from 'lucide-react';
import { getOverlaps, reviewOverlap, runDetection } from '../api/endpoints';
import { StatusBadge, MatchBadge, ReviewBadge } from '../components/StatusBadge';
import { formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const REVIEW_OPTIONS = [
  { value: 'Confirmed', label: 'Confirm Related', icon: CheckCircle, color: 'var(--color-status-disposed)' },
  { value: 'Dismissed', label: 'Dismiss', icon: X, color: 'var(--color-text-muted)' },
  { value: 'Coordinating', label: 'Coordinate', icon: GitMerge, color: 'var(--color-status-process)' },
];

function ReviewModal({ alert, onReview, onClose }) {
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!status) return;
    setSaving(true);
    try {
      await onReview(alert.id, status, notes);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal aria-label="Review overlap alert">
      <div className="modal" style={{ maxWidth: 520 }}>
        <h2 className="modal-title">Review Overlap Alert</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '6px 0 20px', lineHeight: 1.5 }}>
          {alert.reason}
        </p>

        {/* Important note */}
        <div style={{
          background: 'rgba(124,58,237,.07)', border: '1px solid rgba(124,58,237,.2)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 20,
          fontSize: 12, color: '#5B21B6', lineHeight: 1.5
        }}>
          ⚠️ <strong>Important:</strong> This action only records your review. It does NOT merge, close, or modify
          any underlying cases. Same institution does not mean duplicate complaint.
        </div>

        <div className="form-group">
          <label className="form-label">Action</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {REVIEW_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 8,
                  border: `2px solid ${status === opt.value ? opt.color : 'var(--color-border)'}`,
                  background: status === opt.value ? opt.color + '15' : 'white',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  color: status === opt.value ? opt.color : 'var(--color-text-secondary)',
                  transition: 'all 150ms', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                }}
              >
                <opt.icon size={16} color={status === opt.value ? opt.color : 'currentColor'} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Review Notes (optional)</label>
          <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add your review notes…" style={{ minHeight: 70 }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" onClick={submit} disabled={!status || saving}>
            {saving ? 'Saving…' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OverlapsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('Pending');
  const [running, setRunning] = useState(false);
  const [reviewAlert, setReviewAlert] = useState(null);
  const { user } = useAuth();
  const readOnly = user?.role === 'Senior Management';

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.review_status = filterStatus;
      const res = await getOverlaps(params);
      setAlerts(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAlerts(); }, [filterStatus]);

  const handleRunDetection = async () => {
    setRunning(true);
    try {
      const res = await runDetection();
      alert(res.data.message);
      fetchAlerts();
    } catch (e) {
      alert(e.response?.data?.detail || 'Detection failed.');
    } finally { setRunning(false); }
  };

  const handleReview = async (id, status, notes) => {
    await reviewOverlap(id, { review_status: status, review_notes: notes });
    fetchAlerts();
  };

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Overlap Detection</h1>
          <p className="page-subtitle">Rule-based matching of cases across Bureaus involving the same institution</p>
        </div>
        {!readOnly && (
          <button className="btn btn-outline" onClick={handleRunDetection} disabled={running}>
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
            {running ? 'Detecting…' : 'Run Detection'}
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div style={{
        background: 'rgba(124,58,237,.06)', border: '1px solid rgba(124,58,237,.25)',
        borderRadius: 10, padding: '14px 18px', marginBottom: 24,
        fontSize: 13, color: '#5B21B6', lineHeight: 1.6
      }}>
        <strong>⚠️ Flagged for human review only.</strong> Same institution does not mean duplicate complaint.
        The system NEVER auto-merges, auto-closes, or blocks any case. All actions require human authorisation.
      </div>

      {/* Filter tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {['Pending', 'Confirmed', 'Dismissed', 'Coordinating', ''].map(s => (
          <button
            key={s || 'all'}
            className={`tab-btn ${filterStatus === s ? 'active' : ''}`}
            onClick={() => { setFilterStatus(s); }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Alert cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading overlap alerts…</div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><AlertTriangle size={40} style={{ opacity: 0.3 }} /></div>
          <div className="empty-state-title">No overlap alerts</div>
          <div className="empty-state-desc">No alerts match the selected filter.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {alerts.map(a => (
            <div key={a.id} className="overlap-card">
              {/* Card header */}
              <div className="overlap-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertTriangle size={15} color="var(--color-status-overlap)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                    Overlap Alert #{a.id}
                  </span>
                  <MatchBadge level={a.match_level} />
                  <ReviewBadge status={a.review_status} />
                </div>
                {a.similarity_score != null && (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Similarity: {Math.round(a.similarity_score * 100)}%
                  </span>
                )}
              </div>

              {/* Side-by-side cases */}
              <div className="overlap-cases-grid">
                {[a.case_a, a.case_b].map((c, idx) => (
                  <div key={idx} className="overlap-case-panel">
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                      Case {idx === 0 ? 'A' : 'B'}
                    </div>
                    {c ? (
                      <>
                        <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>
                          {c.case_code}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{c.institution?.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                          ID: {c.institution?.aicte_permanent_id}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                          <span style={{ background: 'rgba(30,58,95,.08)', color: 'var(--color-primary)', borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                            {c.bureau?.code}
                          </span>
                          <StatusBadge status={c.status} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{c.category}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Received: {formatDate(c.received_date)}</div>
                      </>
                    ) : <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Case data unavailable.</div>}
                  </div>
                ))}
                <div className="overlap-divider">↔</div>
              </div>

              {/* Match reason */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', background: '#FAFBFC' }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Match Reason</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{a.reason}</div>
                {a.review_notes && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#5B21B6', background: 'rgba(124,58,237,.06)', borderRadius: 6, padding: '6px 10px' }}>
                    Review note: {a.review_notes}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              {!readOnly && a.review_status === 'Pending' && (
                <div className="overlap-card-footer">
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Awaiting review</span>
                  <button className="btn btn-outline btn-sm" onClick={() => setReviewAlert(a)}>
                    <Eye size={13} /> Review
                  </button>
                </div>
              )}
              {a.review_status !== 'Pending' && (
                <div className="overlap-card-footer">
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Reviewed {a.reviewed_at ? formatDate(a.reviewed_at) : ''}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewAlert && (
        <ReviewModal
          alert={reviewAlert}
          onReview={handleReview}
          onClose={() => setReviewAlert(null)}
        />
      )}
    </div>
  );
}
