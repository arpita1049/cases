import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { getCases, getBureaus } from '../api/endpoints';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonTable } from '../components/Skeleton';
import { formatDate, truncate } from '../utils/format';
import CaseDrawer from './CaseDrawer';

const STATUSES = ['Pending', 'Under Process', 'Disposed', 'Overdue', 'Escalated', 'Closed'];
const REGIONS  = ['North', 'South', 'East', 'West', 'Central'];

export default function CasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [bureaus, setBureaus] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  // Filter state
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    bureau_id: '',
    region: '',
    date_from: '',
    date_to: '',
  });

  const PER_PAGE = 15;

  useEffect(() => {
    getBureaus().then(r => setBureaus(r.data)).catch(() => {});
  }, []);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: PER_PAGE };
      if (filters.search)   params.search = filters.search;
      if (filters.status)   params.status = filters.status;
      if (filters.bureau_id) params.bureau_id = filters.bureau_id;
      if (filters.region)   params.region = filters.region;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to)   params.date_to = filters.date_to;

      const res = await getCases(params);
      setCases(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const applyFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: '', status: '', bureau_id: '', region: '', date_from: '', date_to: '' });
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(Boolean);
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Cases</h1>
          <p className="page-subtitle">{total} case{total !== 1 ? 's' : ''} found</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: filterOpen ? 16 : 0 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 32 }}
              placeholder="Search by case ID, category, description…"
              value={filters.search}
              onChange={e => applyFilter('search', e.target.value)}
              aria-label="Search cases"
            />
          </div>
          <button
            className={`btn ${filterOpen ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setFilterOpen(o => !o)}
            aria-expanded={filterOpen}
            aria-label="Toggle filters"
          >
            <Filter size={14} /> Filters
            {hasFilters && <span style={{ background: 'var(--color-accent)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>●</span>}
            {filterOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {filterOpen && (
          <div className="filter-grid">
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={filters.status} onChange={e => applyFilter('status', e.target.value)}>
                <option value="">All statuses</option>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Bureau / Cell</label>
              <select className="form-select" value={filters.bureau_id} onChange={e => applyFilter('bureau_id', e.target.value)}>
                <option value="">All bureaus</option>
                {bureaus.map(b => <option key={b.id} value={b.id}>{b.code} – {b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Region</label>
              <select className="form-select" value={filters.region} onChange={e => applyFilter('region', e.target.value)}>
                <option value="">All regions</option>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Received From</label>
              <input className="form-input" type="date" value={filters.date_from} onChange={e => applyFilter('date_from', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Received To</label>
              <input className="form-input" type="date" value={filters.date_to} onChange={e => applyFilter('date_to', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? <SkeletonTable rows={8} cols={6} /> : (
        <>
          <div className="table-container" style={{ borderRadius: 12, border: '1px solid var(--color-border)', background: 'white' }}>
            <table>
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Institution</th>
                  <th>Bureau / Cell</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-state-icon">📂</div>
                        <div className="empty-state-title">No cases found</div>
                        <div className="empty-state-desc">Try adjusting your search or filters.</div>
                      </div>
                    </td>
                  </tr>
                )}
                {cases.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setSelectedCase(c)}
                    aria-label={`Case ${c.case_code}`}
                  >
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: 13 }}>
                        {c.case_code}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{truncate(c.institution?.name, 32)}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.institution?.aicte_permanent_id}</div>
                    </td>
                    <td>
                      <span style={{
                        background: 'rgba(30,58,95,.08)', color: 'var(--color-primary)',
                        borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 600
                      }}>
                        {c.bureau?.code}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <div className="truncate" style={{ fontSize: 13 }} title={c.category}>{c.category}</div>
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td style={{ fontSize: 13, color: c.status === 'Overdue' || c.status === 'Escalated' ? 'var(--color-status-overdue)' : 'var(--color-text-primary)' }}>
                      {formatDate(c.due_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination" style={{ justifyContent: 'flex-end' }}>
                <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                {totalPages > 7 && <span style={{ padding: '0 4px', color: 'var(--color-text-muted)' }}>…</span>}
                <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages} aria-label="Next page">›</button>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                  {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Case detail drawer */}
      {selectedCase && (
        <CaseDrawer
          caseId={selectedCase.id}
          caseData={selectedCase}
          onClose={() => setSelectedCase(null)}
          onUpdate={fetchCases}
        />
      )}
    </div>
  );
}
