import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, ChevronDown, ChevronUp, X, Columns, ArrowUp, ArrowDown, ArrowUpDown, UploadCloud } from 'lucide-react';
import { getCases, getBureaus, getInstitutions } from '../api/endpoints';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonTable } from '../components/Skeleton';
import { formatDate, truncate } from '../utils/format';
import CaseDrawer from './CaseDrawer';
import CsvImportModal from '../components/CsvImportModal';

const STATUSES = ['Pending', 'Under Process', 'Action initiated', 'Disposed', 'Overdue', 'Escalated', 'Closed'];
const REGIONS  = ['North', 'South', 'East', 'West', 'Central'];
const PER_PAGE_OPTIONS = [10, 15, 25, 50];

const ALL_COLUMNS = [
  { id: 'case_code', label: 'Case ID', sortable: true, default: true },
  { id: 'institution', label: 'Institution', sortable: true, default: true },
  { id: 'bureau', label: 'Bureau / Cell', sortable: true, default: true },
  { id: 'category', label: 'Category', sortable: true, default: true },
  { id: 'status', label: 'Status', sortable: true, default: true },
  { id: 'due_date', label: 'Due Date', sortable: true, default: true },
  { id: 'received_date', label: 'Received Date', sortable: true, default: true },
  { id: 'region', label: 'Region', sortable: false, default: false },
  { id: 'complainant_type', label: 'Complainant Type', sortable: false, default: false },
];

export default function CasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-synced filter parameters
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    bureau_id: searchParams.get('bureau_id') || '',
    institution_id: searchParams.get('institution_id') || '',
    category: searchParams.get('category') || '',
    region: searchParams.get('region') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
  });

  const [sortBy, setSortBy] = useState(searchParams.get('sort_by') || 'received_date');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sort_order') || 'desc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [perPage, setPerPage] = useState(parseInt(searchParams.get('per_page') || '15', 10));

  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bureaus, setBureaus] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnToggleOpen, setColumnToggleOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('cases_visible_columns');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    const def = {};
    ALL_COLUMNS.forEach(c => { def[c.id] = c.default; });
    return def;
  });

  const columnMenuRef = useRef(null);

  // Close column menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target)) {
        setColumnToggleOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch bureaus and institutions
  useEffect(() => {
    getBureaus().then(r => setBureaus(r.data)).catch(() => {});
    getInstitutions({ per_page: 100 }).then(r => setInstitutions(r.data.items || [])).catch(() => {});
  }, []);

  // Synchronize state with URL search params
  const syncUrl = useCallback((newFilters, newSortBy, newSortOrder, newPage, newPerPage) => {
    const params = new URLSearchParams();
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.bureau_id) params.set('bureau_id', newFilters.bureau_id);
    if (newFilters.institution_id) params.set('institution_id', newFilters.institution_id);
    if (newFilters.category) params.set('category', newFilters.category);
    if (newFilters.region) params.set('region', newFilters.region);
    if (newFilters.date_from) params.set('date_from', newFilters.date_from);
    if (newFilters.date_to) params.set('date_to', newFilters.date_to);
    if (newSortBy && newSortBy !== 'received_date') params.set('sort_by', newSortBy);
    if (newSortOrder && newSortOrder !== 'desc') params.set('sort_order', newSortOrder);
    if (newPage > 1) params.set('page', String(newPage));
    if (newPerPage !== 15) params.set('per_page', String(newPerPage));

    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        per_page: perPage,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.bureau_id) params.bureau_id = filters.bureau_id;
      if (filters.institution_id) params.institution_id = filters.institution_id;
      if (filters.category) params.category = filters.category;
      if (filters.region) params.region = filters.region;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const res = await getCases(params);
      setCases(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, sortBy, sortOrder, filters]);

  useEffect(() => {
    fetchCases();
    syncUrl(filters, sortBy, sortOrder, page, perPage);
  }, [fetchCases, syncUrl, filters, sortBy, sortOrder, page, perPage]);

  const applyFilter = (key, val) => {
    setFilters(f => {
      const updated = { ...f, [key]: val };
      return updated;
    });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      bureau_id: '',
      institution_id: '',
      category: '',
      region: '',
      date_from: '',
      date_to: '',
    });
    setPage(1);
  };

  const handleSort = (columnId) => {
    if (sortBy === columnId) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(columnId);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const toggleColumn = (columnId) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [columnId]: !prev[columnId] };
      try {
        localStorage.setItem('cases_visible_columns', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const hasFilters = Object.values(filters).some(Boolean);
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Cases</h1>
          <p className="page-subtitle">{total} case{total !== 1 ? 's' : ''} found</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowImportModal(true)}
            id="btn-bulk-import"
            aria-label="Bulk import cases"
          >
            <UploadCloud size={14} /> Bulk Import CSV
          </button>
        </div>
      </div>

      {/* Filter and Tool Bar */}
      <div className="filter-bar">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: filterOpen ? 16 : 0 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 32 }}
              placeholder="Search case ID, institution, complainant, keywords…"
              value={filters.search}
              onChange={e => applyFilter('search', e.target.value)}
              aria-label="Search cases"
              id="cases-search-input"
            />
          </div>

          {/* Filters toggle */}
          <button
            className={`btn ${filterOpen ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setFilterOpen(o => !o)}
            aria-expanded={filterOpen}
            aria-label="Toggle filters"
            id="cases-filter-btn"
          >
            <Filter size={14} /> Filters
            {hasFilters && <span style={{ background: 'var(--color-accent)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>●</span>}
            {filterOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Column Visibility Menu */}
          <div style={{ position: 'relative' }} ref={columnMenuRef}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setColumnToggleOpen(o => !o)}
              aria-label="Toggle column visibility"
              aria-expanded={columnToggleOpen}
              id="cases-columns-btn"
            >
              <Columns size={14} /> Columns
            </button>
            {columnToggleOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 6,
                  zIndex: 50,
                  background: 'white',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  padding: 12,
                  minWidth: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Toggle Visible Columns
                </div>
                {ALL_COLUMNS.map(col => (
                  <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!visibleColumns[col.id]}
                      onChange={() => toggleColumn(col.id)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters} id="cases-clear-filters-btn">
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {filterOpen && (
          <div className="filter-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={filters.status} onChange={e => applyFilter('status', e.target.value)} id="filter-status">
                <option value="">All statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Bureau / Cell</label>
              <select className="form-select" value={filters.bureau_id} onChange={e => applyFilter('bureau_id', e.target.value)} id="filter-bureau">
                <option value="">All bureaus</option>
                {bureaus.map(b => <option key={b.id} value={b.id}>{b.code} – {b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Institution</label>
              <select className="form-select" value={filters.institution_id} onChange={e => applyFilter('institution_id', e.target.value)} id="filter-institution">
                <option value="">All institutions</option>
                {institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.aicte_permanent_id} - {truncate(inst.name, 30)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Category</label>
              <input
                className="form-input"
                placeholder="e.g. Salary, Admission…"
                value={filters.category}
                onChange={e => applyFilter('category', e.target.value)}
                id="filter-category"
              />
            </div>
            <div>
              <label className="form-label">Region</label>
              <select className="form-select" value={filters.region} onChange={e => applyFilter('region', e.target.value)} id="filter-region">
                <option value="">All regions</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Received From</label>
              <input className="form-input" type="date" value={filters.date_from} onChange={e => applyFilter('date_from', e.target.value)} id="filter-date-from" />
            </div>
            <div>
              <label className="form-label">Received To</label>
              <input className="form-input" type="date" value={filters.date_to} onChange={e => applyFilter('date_to', e.target.value)} id="filter-date-to" />
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
                  {visibleColumns.case_code && (
                    <th onClick={() => handleSort('case_code')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Case ID
                        {sortBy === 'case_code' ? (sortOrder === 'asc' ? <ArrowUp size={13} color="var(--color-primary)" /> : <ArrowDown size={13} color="var(--color-primary)" />) : <ArrowUpDown size={12} color="var(--color-text-muted)" />}
                      </div>
                    </th>
                  )}
                  {visibleColumns.institution && (
                    <th onClick={() => handleSort('institution')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Institution
                        {sortBy === 'institution' ? (sortOrder === 'asc' ? <ArrowUp size={13} color="var(--color-primary)" /> : <ArrowDown size={13} color="var(--color-primary)" />) : <ArrowUpDown size={12} color="var(--color-text-muted)" />}
                      </div>
                    </th>
                  )}
                  {visibleColumns.bureau && (
                    <th onClick={() => handleSort('bureau')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Bureau / Cell
                        {sortBy === 'bureau' ? (sortOrder === 'asc' ? <ArrowUp size={13} color="var(--color-primary)" /> : <ArrowDown size={13} color="var(--color-primary)" />) : <ArrowUpDown size={12} color="var(--color-text-muted)" />}
                      </div>
                    </th>
                  )}
                  {visibleColumns.category && (
                    <th onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Category
                        {sortBy === 'category' ? (sortOrder === 'asc' ? <ArrowUp size={13} color="var(--color-primary)" /> : <ArrowDown size={13} color="var(--color-primary)" />) : <ArrowUpDown size={12} color="var(--color-text-muted)" />}
                      </div>
                    </th>
                  )}
                  {visibleColumns.status && (
                    <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Status
                        {sortBy === 'status' ? (sortOrder === 'asc' ? <ArrowUp size={13} color="var(--color-primary)" /> : <ArrowDown size={13} color="var(--color-primary)" />) : <ArrowUpDown size={12} color="var(--color-text-muted)" />}
                      </div>
                    </th>
                  )}
                  {visibleColumns.due_date && (
                    <th onClick={() => handleSort('due_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Due Date
                        {sortBy === 'due_date' ? (sortOrder === 'asc' ? <ArrowUp size={13} color="var(--color-primary)" /> : <ArrowDown size={13} color="var(--color-primary)" />) : <ArrowUpDown size={12} color="var(--color-text-muted)" />}
                      </div>
                    </th>
                  )}
                  {visibleColumns.received_date && (
                    <th onClick={() => handleSort('received_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Received Date
                        {sortBy === 'received_date' ? (sortOrder === 'asc' ? <ArrowUp size={13} color="var(--color-primary)" /> : <ArrowDown size={13} color="var(--color-primary)" />) : <ArrowUpDown size={12} color="var(--color-text-muted)" />}
                      </div>
                    </th>
                  )}
                  {visibleColumns.region && <th>Region</th>}
                  {visibleColumns.complainant_type && <th>Complainant Type</th>}
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 && (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 6}>
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
                    style={{ cursor: 'pointer', transition: 'background-color 150ms ease' }}
                  >
                    {visibleColumns.case_code && (
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: 13 }}>
                          {c.case_code}
                        </span>
                      </td>
                    )}
                    {visibleColumns.institution && (
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{truncate(c.institution?.name, 32)}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.institution?.aicte_permanent_id}</div>
                      </td>
                    )}
                    {visibleColumns.bureau && (
                      <td>
                        <span style={{
                          background: 'rgba(30,58,95,.08)', color: 'var(--color-primary)',
                          borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 600
                        }}>
                          {c.bureau?.code}
                        </span>
                      </td>
                    )}
                    {visibleColumns.category && (
                      <td style={{ maxWidth: 220 }}>
                        <div className="truncate" style={{ fontSize: 13 }} title={c.category}>{c.category}</div>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td><StatusBadge status={c.status} /></td>
                    )}
                    {visibleColumns.due_date && (
                      <td style={{ fontSize: 13, color: c.status === 'Overdue' || c.status === 'Escalated' ? 'var(--color-status-overdue)' : 'var(--color-text-primary)' }}>
                        {formatDate(c.due_date)}
                      </td>
                    )}
                    {visibleColumns.received_date && (
                      <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                        {formatDate(c.received_date)}
                      </td>
                    )}
                    {visibleColumns.region && (
                      <td style={{ fontSize: 13 }}>{c.institution?.region || '—'}</td>
                    )}
                    {visibleColumns.complainant_type && (
                      <td style={{ fontSize: 13 }}>{c.complainant_type || '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination & Per-Page Selector */}
            <div className="pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <span>Rows per page:</span>
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '2px 8px', fontSize: 12 }}
                  value={perPage}
                  onChange={e => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  id="per-page-select"
                >
                  {PER_PAGE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <span style={{ marginLeft: 8 }}>
                  {total > 0 ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}` : '0 cases'}
                </span>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  ))}
                  {totalPages > 7 && <span style={{ padding: '0 4px', color: 'var(--color-text-muted)' }}>…</span>}
                  <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages} aria-label="Next page">›</button>
                </div>
              )}
            </div>
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

      {/* CSV Import Modal (Requirement 9) */}
      {showImportModal && (
        <CsvImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            fetchCases();
          }}
        />
      )}
    </div>
  );
}
