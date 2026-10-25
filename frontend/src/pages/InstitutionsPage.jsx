import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, ChevronRight } from 'lucide-react';
import { getInstitutions } from '../api/endpoints';
import { SkeletonTable } from '../components/Skeleton';
import InstitutionProfile from './InstitutionProfile';

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const PER_PAGE = 15;

  useEffect(() => {
    setLoading(true);
    const params = { page, per_page: PER_PAGE };
    if (search.trim()) params.search = search.trim();
    getInstitutions(params)
      .then(r => { setInstitutions(r.data.items); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search]);

  const totalPages = Math.ceil(total / PER_PAGE);

  if (selected) {
    return <InstitutionProfile institutionId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Institutions</h1>
        <p className="page-subtitle">Consolidated view of all AICTE-affiliated institutions and their complaint histories</p>
      </div>

      {/* Search */}
      <div className="filter-bar">
        <div style={{ position: 'relative', maxWidth: 420 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 32 }}
            placeholder="Search by institution name or AICTE ID…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            aria-label="Search institutions"
          />
        </div>
      </div>

      {loading ? <SkeletonTable rows={10} cols={5} /> : (
        <div className="table-container" style={{ background: 'white', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <table>
            <thead>
              <tr>
                <th>AICTE Permanent ID</th>
                <th>Institution Name</th>
                <th>Type</th>
                <th>Region / State</th>
                <th style={{ textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {institutions.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><Building2 size={40} style={{ opacity: 0.3 }} /></div>
                      <div className="empty-state-title">No institutions found</div>
                      <div className="empty-state-desc">Try a different search term.</div>
                    </div>
                  </td>
                </tr>
              )}
              {institutions.map(inst => (
                <tr
                  key={inst.id}
                  onClick={() => setSelected(inst.id)}
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelected(inst.id)}
                  aria-label={`${inst.name} – view profile`}
                >
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
                      {inst.aicte_permanent_id}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{inst.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{inst.city}, {inst.state}</div>
                  </td>
                  <td>
                    <span style={{
                      background: 'rgba(30,58,95,.07)', color: 'var(--color-primary)',
                      borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 500
                    }}>
                      {inst.institution_type || '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 500 }}>{inst.region}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{inst.state}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ChevronRight size={16} color="var(--color-text-muted)" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination" style={{ justifyContent: 'flex-end' }}>
              <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
