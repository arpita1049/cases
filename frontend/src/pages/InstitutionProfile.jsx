import { useEffect, useState } from 'react';
import { ArrowLeft, Building2, MapPin, AlertTriangle } from 'lucide-react';
import { getInstitution, getInstitutionCases } from '../api/endpoints';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../utils/format';
import CaseDrawer from './CaseDrawer';

export default function InstitutionProfile({ institutionId, onBack }) {
  const [inst, setInst] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getInstitution(institutionId),
      getInstitutionCases(institutionId),
    ]).then(([iRes, cRes]) => {
      setInst(iRes.data);
      setCases(cRes.data);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [institutionId]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading institution profile…</div>
      </div>
    );
  }

  if (!inst) return null;

  // Group cases by bureau
  const bureauGroups = cases.reduce((acc, c) => {
    const code = c.bureau?.code || 'Unknown';
    if (!acc[code]) acc[code] = [];
    acc[code].push(c);
    return acc;
  }, {});

  const filteredCases = activeTab === 'all' ? cases : cases.filter(c => c.bureau?.code === activeTab);

  return (
    <div className="page-wrapper">
      {/* Back button */}
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Institutions
      </button>

      {/* Institution header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(30,58,95,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Building2 size={26} color="var(--color-primary)" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="page-title" style={{ marginBottom: 4 }}>{inst.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, background: 'rgba(30,58,95,.08)', padding: '2px 10px', borderRadius: 5, color: 'var(--color-primary)', fontWeight: 600 }}>
                {inst.aicte_permanent_id}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} /> {inst.city}, {inst.state} · {inst.region} Region
              </span>
              {inst.institution_type && (
                <span style={{ fontSize: 12, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 5, padding: '2px 8px' }}>
                  {inst.institution_type}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="info-strip" style={{ marginTop: 20, marginBottom: 0 }}>
          <div className="info-strip-item">
            <div className="info-strip-value">{inst.total_cases}</div>
            <div className="info-strip-label">Total Cases</div>
          </div>
          <div className="info-strip-item">
            <div className="info-strip-value" style={{ color: inst.open_cases > 0 ? 'var(--color-status-overdue)' : 'var(--color-status-disposed)' }}>
              {inst.open_cases}
            </div>
            <div className="info-strip-label">Open Cases</div>
          </div>
          <div className="info-strip-item">
            <div className="info-strip-value">{inst.bureaus_involved}</div>
            <div className="info-strip-label">Bureaus Involved</div>
          </div>
          <div className="info-strip-item">
            <div className="info-strip-value" style={{ color: inst.active_overlap_alerts > 0 ? '#7C3AED' : 'var(--color-text-primary)' }}>
              {inst.active_overlap_alerts}
            </div>
            <div className="info-strip-label">Overlap Alerts</div>
          </div>
        </div>

        {inst.active_overlap_alerts > 0 && (
          <div style={{
            marginTop: 16, padding: '10px 14px',
            background: 'rgba(124,58,237,.06)', border: '1px solid rgba(124,58,237,.2)',
            borderRadius: 8, fontSize: 13, color: '#5B21B6',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <AlertTriangle size={14} />
            {inst.active_overlap_alerts} pending overlap alert{inst.active_overlap_alerts !== 1 ? 's' : ''} flagged for human review.
            Same institution does not mean duplicate complaint.
          </div>
        )}
      </div>

      {/* Case list by bureau */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Complaint History — All Bureaus</h2>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{cases.length} total</span>
        </div>

        {/* Bureau filter tabs */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All</button>
          {Object.keys(bureauGroups).map(code => (
            <button key={code} className={`tab-btn ${activeTab === code ? 'active' : ''}`} onClick={() => setActiveTab(code)}>
              {code} ({bureauGroups[code].length})
            </button>
          ))}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Bureau</th>
                <th>Category</th>
                <th>Status</th>
                <th>Received</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--color-text-muted)' }}>No cases found.</td></tr>
              )}
              {filteredCases.map(c => (
                <tr key={c.id} onClick={() => setSelectedCase(c)} style={{ cursor: 'pointer' }}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{c.case_code}</span></td>
                  <td><span style={{ background: 'rgba(30,58,95,.08)', color: 'var(--color-primary)', borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{c.bureau?.code}</span></td>
                  <td style={{ fontSize: 13, maxWidth: 220 }}><div className="truncate">{c.category}</div></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ fontSize: 13 }}>{formatDate(c.received_date)}</td>
                  <td style={{ fontSize: 13 }}>{formatDate(c.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCase && (
        <CaseDrawer
          caseId={selectedCase.id}
          caseData={selectedCase}
          onClose={() => setSelectedCase(null)}
          onUpdate={() => {
            getInstitutionCases(institutionId).then(r => setCases(r.data));
          }}
        />
      )}
    </div>
  );
}
