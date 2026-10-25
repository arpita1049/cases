/** Loading skeleton components */

export function SkeletonLine({ width = '100%', height = 16, mb = 8 }) {
  return (
    <div className="skeleton" style={{ width, height, marginBottom: mb, borderRadius: 6 }} />
  );
}

export function SkeletonCard() {
  return (
    <div className="card" aria-label="Loading...">
      <SkeletonLine width="60%" height={18} mb={12} />
      <SkeletonLine width="40%" height={36} mb={8} />
      <SkeletonLine width="80%" height={13} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><div className="skeleton" style={{ height: 12, width: 80 }} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}><div className="skeleton" style={{ height: 13, width: c === 0 ? 100 : 70 }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
