import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, Clock, AlertTriangle, GitMerge,
  ArrowRight, ChevronRight, TrendingUp
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { getDashboard } from '../api/endpoints';
import { StatusBadge, MatchBadge } from '../components/StatusBadge';
import { SkeletonCard } from '../components/Skeleton';
import { formatDate, truncate } from '../utils/format';

const STATUS_COLORS = {
  'Pending':       '#F59E0B',
  'Under Process': '#3B82F6',
  'Disposed':      '#16A34A',
  'Overdue':       '#DC2626',
  'Escalated':     '#DC2626',
  'Closed':        '#9CA3AF',
};

const SUMMARY_CONFIG = [
  { key: 'total_cases',    label: 'Total Cases',     icon: FileText,      iconBg: 'rgba(30,58,95,.1)',  filterKey: null },
  { key: 'pending_cases',  label: 'Pending / Active',icon: Clock,         iconBg: 'rgba(59,130,246,.1)',filterKey: 'status=Pending' },
  { key: 'overdue_cases',  label: 'Overdue / Escalated', icon: TrendingUp,iconBg: 'rgba(220,38,38,.1)', filterKey: 'status=Overdue' },
  { key: 'overlap_alerts', label: 'Overlap Alerts',  icon: AlertTriangle, iconBg: 'rgba(124,58,237,.1)',filterKey: null, route: '/overlaps' },
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getDashboard()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const goToFilter = (cfg) => {
    if (cfg.route) return navigate(cfg.route);
    if (cfg.filterKey) return navigate(`/cases?${cfg.filterKey}`);
    navigate('/cases');
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="summary-cards">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const chartStatusData = (data?.cases_by_status || []).map(s => ({
    name: s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || '#9CA3AF',
  })).filter(d => d.value > 0);

  const chartBureauData = (data?.cases_by_bureau || []).map(b => ({
    id: b.id,
    name: b.code,
    fullName: b.name,
    cases: b.count,
  }));

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Live case-level overview across all AICTE Bureaus and Cells</p>
      </div>

      {/* Summary cards (max 4) */}
      <div className="summary-cards">
        {SUMMARY_CONFIG.map(cfg => {
          const Icon = cfg.icon;
          return (
            <div
              key={cfg.key}
              className="summary-card"
              onClick={() => goToFilter(cfg)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && goToFilter(cfg)}
              aria-label={`${cfg.label}: ${data?.[cfg.key] ?? 0}`}
            >
              <div className="summary-card-top">
                <span className="summary-card-label">{cfg.label}</span>
                <div className="summary-card-icon" style={{ background: cfg.iconBg }}>
                  <Icon size={18} style={{ color: 'var(--color-primary)' }} />
                </div>
              </div>
              <div className="summary-card-value">{data?.[cfg.key] ?? 0}</div>
              <div className="summary-card-trend">Click to view details →</div>
            </div>
          );
        })}
      </div>

      {/* Charts (max 2 visible) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Donut: Cases by status */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="card-title">Cases by Status</h2>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Click segment to filter</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartStatusData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                onClick={(entry) => navigate(`/cases?status=${encodeURIComponent(entry.name)}`)}
                style={{ cursor: 'pointer' }}
              >
                {chartStatusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val, name) => [val, `${name} (Click to view)`]}
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(val) => <span style={{ fontSize: 12 }}>{val}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar: Cases by Bureau */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="card-title">Cases by Bureau / Cell</h2>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Click bar to filter</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartBureauData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                formatter={(val, _n, props) => [val, `${props.payload.fullName} (Click to view)`]}
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
              />
              <Bar
                dataKey="cases"
                fill="var(--color-primary)"
                radius={[4,4,0,0]}
                onClick={(data) => data?.id && navigate(`/cases?bureau_id=${data.id}`)}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Needs attention */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} color="var(--color-status-overdue)" />
              Needs Attention
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/cases')}>
              View all <ChevronRight size={13} />
            </button>
          </div>
          {!data?.needs_attention?.length ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No urgent cases.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.needs_attention.slice(0, 5).map(c => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    background: 'var(--color-bg)', borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer', transition: 'background 150ms',
                  }}
                  className="hover:bg-blue-50"
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
                      {c.case_code}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {truncate(c.institution?.name, 35)} · {c.bureau?.code}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      Due: {formatDate(c.due_date)}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overlap alerts panel */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} color="var(--color-status-overlap)" />
              Potential Overlap Alerts
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/overlaps')}>
              View all <ChevronRight size={13} />
            </button>
          </div>

          {/* Disclaimer */}
          <div style={{
            background: 'rgba(124,58,237,.06)', border: '1px solid rgba(124,58,237,.2)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 14,
            fontSize: 12, color: '#5B21B6', lineHeight: 1.5
          }}>
            ℹ️ Flagged for human review only. Same institution does not mean duplicate complaint.
          </div>

          {!data?.recent_overlap_alerts?.length ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No pending overlap alerts.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.recent_overlap_alerts.slice(0, 3).map(a => (
                <div
                  key={a.id}
                  onClick={() => navigate(`/overlaps`)}
                  style={{
                    padding: '10px 14px', background: 'var(--color-bg)',
                    borderRadius: 8, border: '1px solid rgba(124,58,237,.2)',
                    cursor: 'pointer', transition: 'background 150ms',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>
                      {a.case_a?.case_code} ↔ {a.case_b?.case_code}
                    </span>
                    <MatchBadge level={a.match_level} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {truncate(a.case_a?.institution?.name, 40)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
                    {a.case_a?.bureau?.code} ↔ {a.case_b?.bureau?.code}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
