import { useEffect, useState, useRef } from 'react';
import { Download, FileText, Filter } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  getReportSummary, getMonthlyReport, getWorkloadReport,
  getOverlapReport, getBureaus, logReportExport
} from '../api/endpoints';
import { SkeletonCard } from '../components/Skeleton';

const STATUS_COLORS = {
  'Pending': '#F59E0B',
  'Under Process': '#3B82F6',
  'Action initiated': '#0F9D8A',
  'Disposed': '#16A34A',
  'Overdue': '#DC2626',
  'Escalated': '#991B1B',
  'Closed': '#9CA3AF',
};

function exportCSV(data, filename) {
  if (!data || !data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [
    keys.join(','),
    ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [workload, setWorkload] = useState([]);
  const [overlapReport, setOverlapReport] = useState([]);
  const [bureaus, setBureaus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activeReport, setActiveReport] = useState('summary');
  const [filters, setFilters] = useState({
    bureau_id: '',
    year: new Date().getFullYear().toString(),
    date_from: '',
    date_to: '',
  });

  const reportContainerRef = useRef(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.bureau_id) params.bureau_id = filters.bureau_id;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [filters]);

  const getFilterSummaryString = () => {
    const parts = [];
    if (filters.bureau_id) {
      const b = bureaus.find(x => String(x.id) === String(filters.bureau_id));
      parts.push(`Bureau: ${b ? b.code : filters.bureau_id}`);
    } else {
      parts.push('Bureau: All');
    }
    if (filters.date_from || filters.date_to) {
      parts.push(`Dates: ${filters.date_from || 'start'} to ${filters.date_to || 'now'}`);
    } else {
      parts.push(`Year: ${filters.year}`);
    }
    return parts.join(' | ');
  };

  const handleExportCSV = async () => {
    const filterDesc = getFilterSummaryString();
    let rows = [];
    let name = activeReport;

    if (activeReport === 'summary' && summary) {
      rows = Object.entries(summary.by_status).map(([status, count]) => ({
        status,
        count,
        percentage: summary.total_cases > 0 ? `${Math.round((count / summary.total_cases) * 100)}%` : '0%',
      }));
    } else if (activeReport === 'ageing' && summary) {
      rows = Object.entries(summary.ageing_distribution).map(([range, count]) => ({
        ageing_bucket: `${range} days`,
        open_cases_count: count,
      }));
    } else if (activeReport === 'monthly' && monthly) {
      rows = Object.entries(monthly).map(([month, count]) => ({
        year: filters.year,
        month,
        intake_count: count,
      }));
    } else if (activeReport === 'workload') {
      rows = workload.map(w => ({
        bureau_code: w.code,
        bureau_name: w.name,
        open_cases: w.open_cases,
      }));
    } else if (activeReport === 'overlaps') {
      rows = overlapReport.map(a => ({
        id: a.id,
        case_a: a.case_a?.case_code,
        case_b: a.case_b?.case_code,
        institution: a.case_a?.institution?.name,
        match_level: a.match_level,
        review_status: a.review_status,
        reason: a.reason,
      }));
    }

    if (!rows.length) return;
    exportCSV(rows, `aicte_report_${name}_${Date.now()}.csv`);

    try {
      await logReportExport({
        export_type: 'CSV',
        report_name: name,
        filters_applied: filterDesc,
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }
  };

  const handleExportPDF = async () => {
    if (!reportContainerRef.current) return;
    setExportingPdf(true);
    const filterDesc = getFilterSummaryString();

    try {
      const canvas = await html2canvas(reportContainerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // AICTE Header band (Navy #1E3A5F)
      pdf.setFillColor(30, 58, 95);
      pdf.rect(0, 0, pdfWidth, 24, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text('ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)', 14, 10);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`Integrated Complaint Monitoring System — ${activeReport.toUpperCase()} Report`, 14, 17);

      // Filter summary metadata
      pdf.setTextColor(100, 116, 139);
      pdf.setFontSize(8);
      pdf.text(`Active Filters: ${filterDesc} | Generated: ${new Date().toLocaleString()}`, 14, 30);

      // Embed captured report canvas
      const imgWidth = pdfWidth - 28;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 14, 34, imgWidth, Math.min(imgHeight, pdfHeight - 40));

      pdf.save(`aicte_${activeReport}_report_${Date.now()}.pdf`);

      await logReportExport({
        export_type: 'PDF',
        report_name: activeReport,
        filters_applied: filterDesc,
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  // Prepare chart data
  const statusChartData = summary
    ? Object.entries(summary.by_status)
        .map(([status, count]) => ({
          name: status,
          value: count,
          color: STATUS_COLORS[status] || '#9CA3AF',
        }))
        .filter(d => d.value > 0)
    : [];

  const monthlyChartData = monthly
    ? Object.entries(monthly).map(([month, count]) => ({ month, count }))
    : [];

  const ageingData = summary
    ? [
        { range: '0-7 days', count: summary.ageing_distribution['0-7'] || 0 },
        { range: '8-15 days', count: summary.ageing_distribution['8-15'] || 0 },
        { range: '16-30 days', count: summary.ageing_distribution['16-30'] || 0 },
        { range: '30+ days', count: summary.ageing_distribution['30+'] || 0 },
      ]
    : [];

  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'monthly', label: 'Monthly Trend' },
    { key: 'workload', label: 'Dept. Workload' },
    { key: 'ageing', label: 'Case Ageing' },
    { key: 'overlaps', label: 'Overlap Report' },
  ];

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Aggregate complaint analytics with live drill-down and certified export audit logging.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleExportCSV}
            id="btn-export-csv"
            aria-label="Export CSV"
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleExportPDF}
            disabled={exportingPdf}
            id="btn-export-pdf"
            aria-label="Export PDF"
          >
            <FileText size={13} /> {exportingPdf ? 'Exporting PDF…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Bureau / Cell</label>
            <select
              className="form-select"
              style={{ width: 220 }}
              value={filters.bureau_id}
              onChange={e => setFilters(f => ({ ...f, bureau_id: e.target.value }))}
              id="report-filter-bureau"
            >
              <option value="">All bureaus</option>
              {bureaus.map(b => <option key={b.id} value={b.id}>{b.code} – {b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Year (Trends)</label>
            <select
              className="form-select"
              style={{ width: 120 }}
              value={filters.year}
              onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}
              id="report-filter-year"
            >
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Received From</label>
            <input
              type="date"
              className="form-input"
              value={filters.date_from}
              onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
              id="report-filter-date-from"
            />
          </div>
          <div>
            <label className="form-label">Received To</label>
            <input
              type="date"
              className="form-input"
              value={filters.date_to}
              onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
              id="report-filter-date-to"
            />
          </div>
        </div>
      </div>

      {/* Report tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab-btn ${activeReport === t.key ? 'active' : ''}`}
            onClick={() => setActiveReport(t.key)}
            id={`tab-report-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SkeletonCard /><SkeletonCard />
        </div>
      ) : (
        <div ref={reportContainerRef} id="report-export-container" style={{ background: '#F7F9FC', padding: 8, borderRadius: 8 }}>
          {/* Summary Tab */}
          {activeReport === 'summary' && summary && (
            <div>
              {/* Max 4 KPI summary cards per page guideline */}
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
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Overdue / Escalated</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-status-overdue)' }}>
                    {(summary.by_status['Overdue'] || 0) + (summary.by_status['Escalated'] || 0)}
                  </div>
                </div>
                <div className="card" style={{ cursor: 'default' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Disposed</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-status-disposed)' }}>{summary.by_status['Disposed'] || 0}</div>
                </div>
              </div>

              {/* Status donut & table (Max 1 chart here) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
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
                              {summary.total_cases > 0 ? Math.round((count / summary.total_cases) * 100) : 0}%
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

          {/* Ageing (0-7, 8-15, 16-30, 30+ days) per Requirement 5 */}
          {activeReport === 'ageing' && summary && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 4 }}>Pending Case Ageing Distribution</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
                Days since complaint was received (0-7, 8-15, 16-30, 30+ days; excludes disposed and closed cases)
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ageingData} barSize={60}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 13 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Bar dataKey="count" name="Cases" fill="#0F9D8A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="table-container" style={{ marginTop: 24 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Ageing Category</th>
                      <th style={{ textAlign: 'right' }}>Pending Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ageingData.map(item => (
                      <tr key={item.range}>
                        <td style={{ fontWeight: 500, fontSize: 13 }}>{item.range}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
        </div>
      )}
    </div>
  );
}
