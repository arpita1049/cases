import { useState } from 'react';
import { X, UploadCloud, CheckCircle, AlertTriangle, FileText, Download } from 'lucide-react';
import { previewBulkImport, confirmBulkImport } from '../api/endpoints';

export default function CsvImportModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewData(null);
      setErrorMsg('');
    }
  };

  const handleDownloadSample = () => {
    const sampleHeaders = 'case_code,aicte_permanent_id,bureau_code,category,description,source,reference_number\n';
    const sampleRow1 = 'AICTE-2026-IMP01,AICTE-12345,PGRC,Faculty salary dispute,Faculty complaint regarding non-payment of arrears,Portal,REF-2026-901\n';
    const sampleRow2 = 'AICTE-2026-IMP02,AICTE-23456,RB,Infrastructure non-compliance,Laboratory equipment shortage and inspection report,Email,REF-2026-902\n';
    const blob = new Blob([sampleHeaders + sampleRow1 + sampleRow2], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aicte_cases_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    if (!file) {
      setErrorMsg('Please select a CSV file first.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await previewBulkImport(formData);
      setPreviewData(res.data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to parse and validate CSV file.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!previewData || !previewData.rows) return;
    const validCases = previewData.rows
      .filter(r => r.valid)
      .map(r => r.data);

    if (validCases.length === 0) {
      setErrorMsg('No valid rows found to import.');
      return;
    }

    setConfirming(true);
    setErrorMsg('');
    try {
      await confirmBulkImport({ cases: validCases });
      onSuccess();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to complete bulk import.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F7F9FC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(30, 58, 95, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <UploadCloud size={18} />
            </div>
            <div>
              <h2 id="import-modal-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
                Bulk Import Complaints via CSV
              </h2>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                Upload complaints data with validation against AICTE institutions and deadline rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: 6 }}
            aria-label="Close import dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                background: '#FEF2F2',
                color: '#DC2626',
                border: '1px solid #FCA5A5',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {errorMsg}
            </div>
          )}

          {!previewData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  border: '2px dashed var(--color-border)',
                  borderRadius: 12,
                  padding: 32,
                  textAlign: 'center',
                  background: '#FAFAFA',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('csv-file-input')?.click()}
              >
                <FileText size={36} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>
                  {file ? file.name : 'Click or drag a CSV file here'}
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Supported headers: case_code, aicte_permanent_id, bureau_code, category, description, source, reference_number
                </p>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleDownloadSample}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)' }}
                >
                  <Download size={14} /> Download Sample CSV Template
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePreview}
                  disabled={!file || loading}
                  id="btn-validate-csv"
                >
                  {loading ? 'Validating…' : 'Validate & Preview'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Summary stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div className="card" style={{ padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Rows</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>{previewData.total_rows}</div>
                </div>
                <div className="card" style={{ padding: 12, textAlign: 'center', borderLeft: '4px solid #16A34A' }}>
                  <div style={{ fontSize: 11, color: '#16A34A', textTransform: 'uppercase' }}>Valid Rows</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#16A34A' }}>{previewData.valid_count}</div>
                </div>
                <div className="card" style={{ padding: 12, textAlign: 'center', borderLeft: '4px solid #DC2626' }}>
                  <div style={{ fontSize: 11, color: '#DC2626', textTransform: 'uppercase' }}>Invalid Rows</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#DC2626' }}>{previewData.invalid_count}</div>
                </div>
              </div>

              {/* Preview table */}
              <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Case Code</th>
                      <th>AICTE ID</th>
                      <th>Bureau</th>
                      <th>Category</th>
                      <th>Status / Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row) => (
                      <tr key={row.row_num} style={{ background: row.valid ? 'white' : '#FFF5F5' }}>
                        <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{row.row_num}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>
                          {row.data.case_code || '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>{row.data.aicte_permanent_id || '—'}</td>
                        <td style={{ fontSize: 12 }}>{row.data.bureau_code || '—'}</td>
                        <td style={{ fontSize: 12 }}>{row.data.category || '—'}</td>
                        <td>
                          {row.valid ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16A34A', fontSize: 12, fontWeight: 600 }}>
                              <CheckCircle size={14} /> Valid
                            </span>
                          ) : (
                            <div style={{ color: '#DC2626', fontSize: 11 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                <AlertTriangle size={13} /> Invalid
                              </div>
                              <ul style={{ margin: '2px 0 0', paddingLeft: 14 }}>
                                {row.errors.map((e, idx) => (
                                  <li key={idx}>{e}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setPreviewData(null);
                    setFile(null);
                  }}
                >
                  Upload Different File
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirm}
                    disabled={previewData.valid_count === 0 || confirming}
                    id="btn-confirm-bulk-import"
                  >
                    {confirming ? 'Importing…' : `Import ${previewData.valid_count} Valid Cases`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
