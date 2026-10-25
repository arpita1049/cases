import { useEffect, useState } from 'react';
import { BarChart2, Download, Filter } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import {
  getReportSummary, getMonthlyReport, getWorkloadReport,
  getOverlapReport, getBureaus
} from '../api/endpoints';
import { SkeletonCard } from '../components/Skeleton';

const STATUS_COLORS = {
  'Pending': '#F59E0B', 'Under Process': '#3B82F6', 'Disposed': '#16A34A',
  'Overdue': '#DC2626', 'Escalated': '#DC2626', 'Closed': '#9CA3AF',
};

function exportCSV(data, filename) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [workload, setWorkload] = useState([]);
  const [overlapReport, setOverlapReport] = useState([]);
  const [bureaus, setBureaus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('summary');
  const [filters, setFilters] = useState({ bureau_id: '', year: new Date().getFullYear().toString() });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.bureau_id) params.bureau_id = filters.bureau_id;
      const [s, m, w, o, b] = await Promise.all([
        getReportSummary(params),
        getMonthlyReport({ year: filters.year }),
        getWorkloadReport(),
        getOverlapReport(),
        getBureaus(),
      ]);
      setSummary(s.data);
      setMonthly(m.data);
      setWorkload(w.data);
      setOverlapReport(o.data);
      setBureaus(b.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [filters]);

  // Prepare chart data
  const statusChartData = summary
    ? Object.entries(summary.by_status).map(([status, count]) => ({ name: status, value: count, color: STATUS_COLORS[status] || '#9CA3AF' })).filter(d => d.value > 0)
    : [];

  const monthlyChartData = monthly
    ? Object.entries(monthly).map(([month, count]) => ({ month, count }))
    : [];

  const ageingData = summary
    ? Object.entries(summary.ageing_distribution).map(([range, count]) => ({ range, count }))
    : [];

  const tabs = [
    { key: 'summary',   label: 'Summary' },
    { key: 'monthly',   label: 'Monthly Trend' },
    { key: 'workload',  label: 'Dept. Workload' },
    { key: 'ageing',    label: 'Case Ageing' },
    { key: 'overlaps',  label: 'Overlap Report' },
  ];

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Aggregate complaint analytics. All data is synthetic demo data.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              const rows = activeReport === 'overlaps'
                ? overlapReport.map(a => ({ id: a.id, case_a: a.case_a?.case_code, case_b: a.case_b?.case_code, match_level: a.match_level, review_status: a.review_status, reason: a.reason }))
                : workload.map(w => ({ bureau: w.code, open_cases: w.open_cases }));
              exportCSV(rows, `aicte_report_${activeReport}_${Date.now()}.csv`);
            }}
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Bureau / Cell</label>
            <select className="form-select" style={{ width: 200 }} value={filters.bureau_id} onChange={e => setFilters(f => ({ ...f, bureau_id: e.target.value }))}>
              <option value="">All bureaus</option>
              {bureaus.map(b => <option key={b.id} value={b.id}>{b.code} – {b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Year</label>
            <select className="form-select" style={{ width: 120 }} value={filters.year} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}>
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Report tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} className={`tab-btn ${activeReport === t.key ? 'active' : ''}`} onClick={() => setActiveReport(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SkeletonCard /><SkeletonCard />
        </div>
      ) : (
        <>
          {/* Summary */}
          {activeReport === 'summary' && summary && (
            <div>
              {/* KPI strip */}
              <div className="summary-cards" style={{ marginBottom: 24 }}>
                <div className="card" style={{ cursor: 'default' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Total Cases</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-primary)' }}>{summary.total_cases}</div>
                </div>
                <div className="card" style={{ cursor: 'default' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Disposal Rate</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-status-disposed)' }}>{summary.disposal_rate_pct}%</div>
                </div>
                <div className="card" style={{ cursor: 'default' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Overdue</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-status-overdue)' }}>
                    {(summary.by_status['Overdue'] || 0) + (summary.by_status['Escalated'] || 0)}
                  </div>
                </div>
                <div className="card" style={{ cursor: 'default' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Disposed</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-status-disposed)' }}>{summary.by_status['Disposed'] || 0}</div>
                </div>
              </div>

              {/* Status donut */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="card">
                  <h3 className="card-title" style={{ marginBottom: 20 }}>Cases by Status</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                        {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                      <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 12 }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Status table */}
                <div className="card">
                  <h3 className="card-title" style={{ marginBottom: 16 }}>Status Breakdown</h3>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, paddingBottom: 8 }}>Status</th>
                        <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, paddingBottom: 8 }}>Count</th>
                        <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, paddingBottom: 8 }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(summary.by_status).map(([status, count]) => (
                        count > 0 && (
                          <tr key={status}>
                            <td style={{ padding: '7px 0', fontSize: 13 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[status] || '#9CA3AF', display: 'inline-block' }} />
                                {status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>{count}</td>
                            <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--color-text-muted)' }}>
                              {summary.total_cases > 0 ? Math.round(count / summary.total_cases * 100) : 0}%
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Monthly trend */}
          {activeReport === 'monthly' && monthly && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 20 }}>Monthly Complaint Intake — {filters.year}</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Bar dataKey="count" name="Complaints" fill="var(--color-primary)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Department workload */}
          {activeReport === 'workload' && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 20 }}>Open Cases by Bureau / Cell</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workload} layout="vertical" barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="code" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} formatter={(v, n, p) => [v, p.payload.name]} />
                  <Bar dataKey="open_cases" name="Open Cases" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Table */}
              <div className="table-container" style={{ marginTop: 24 }}>
                <table>
                  <thead><tr><th>Bureau</th><th>Name</th><th style={{ textAlign: 'right' }}>Open Cases</th></tr></thead>
                  <tbody>
                    {workload.map(w => (
                      <tr key={w.code}>
                        <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{w.code}</td>
                        <td style={{ fontSize: 13 }}>{w.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 16, color: w.open_cases > 10 ? 'var(--color-status-overdue)' : 'var(--color-text-primary)' }}>{w.open_cases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ageing */}
          {activeReport === 'ageing' && summary && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 4 }}>Pending Case Ageing Distribution</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>Days since the complaint was received (excludes disposed/closed cases)</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ageingData} barSize={60}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 13 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Bar dataKey="count" name="Cases" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Overlap report */}
          {activeReport === 'overlaps' && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
                <h3 className="card-title">Overlap Alert Summary</h3>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Alert ID</th>
                      <th>Case A</th>
                      <th>Case B</th>
                      <th>Institution</th>
                      <th>Match Level</th>
                      <th>Review Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overlapReport.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--color-text-muted)' }}>No overlap alerts.</td></tr>
                    )}
                    {overlapReport.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>#{a.id}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{a.case_a?.case_code || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{a.case_b?.case_code || '—'}</td>
                        <td style={{ fontSize: 13 }}>{a.case_a?.institution?.name || '—'}</td>
                        <td>
                          <span className={`badge badge-${(a.match_level || '').toLowerCase()}`}>{a.match_level}</span>
                        </td>
                        <td>
                          <span className={`badge ${
                            a.review_status === 'Pending' ? 'badge-pending' :
                            a.review_status === 'Confirmed' ? 'badge-disposed' :
                            a.review_status === 'Dismissed' ? 'badge-closed' : 'badge-process'
                          }`}>{a.review_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
