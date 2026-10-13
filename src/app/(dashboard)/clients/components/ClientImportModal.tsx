'use client';

import React, { useState } from 'react';
import { X, Upload, Download, FileText, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

interface ClientImportModalProps {
  onClose: () => void;
  onImportDone: () => void;
}

export default function ClientImportModal({ onClose, onImportDone }: ClientImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (!f.name.toLowerCase().endsWith('.csv')) {
        setErrorMsg('Please select a valid CSV file');
        return;
      }
      setFile(f);
      setReport(null);
      setErrorMsg(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/clients/import/preview', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse CSV');
      }
      setReport(data.report);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing file');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/clients/import/commit', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import CSV');
      }
      onImportDone();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error committing import');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="wizard-modal ci-modal" onClick={e => e.stopPropagation()}>
        <div className="wizard-header">
          <div className="flex justify-between items-center">
            <div className="wizard-title">Import clients</div>
            <button type="button" className="action-icon-btn border-none" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="wizard-body">
          {errorMsg && (
            <div className="p-3 mb-4 bg-red-50 border-l-4 border-red-500 rounded text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {!report ? (
            <div>
              <div className="ci-intro">
                Upload a CSV of your clients. You will see what happens to every row before anything is saved.
                Columns are matched by name, with common variants understood (Mobile, Customer Name, PIN, Email ID).
                Problematic rows are imported with <b>Needs review</b> so you never lose data.
              </div>

              <label className="ci-drop" htmlFor="csvInput">
                <Upload size={24} className="text-stone-400" />
                <span>
                  {file ? file.name : 'Choose a CSV file'}
                  <small>
                    {file
                      ? `${Math.max(1, Math.round(file.size / 1024))} KB. Click to pick another`
                      : 'Click, or drag and drop your file here'}
                  </small>
                </span>
                <input
                  id="csvInput"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <a
                href="/api/clients/import-template"
                download="clients-import-template.csv"
                className="ci-template"
              >
                <Download size={14} /> Download standard template
              </a>
            </div>
          ) : (
            <div>
              <div className="ci-file">
                <FileText size={15} /> {file?.name}
                <span className="ci-faint">({report.totalRows} rows)</span>
              </div>

              {/* Stats Strip */}
              <div className="ci-stats">
                <div className="ci-stat">
                  <b>{report.willImport}</b>
                  <span>will be imported</span>
                </div>
                <div className="ci-stat ok">
                  <b>{report.ready}</b>
                  <span>ready to use</span>
                </div>
                {report.needsReview > 0 && (
                  <div className="ci-stat warn">
                    <b>{report.needsReview}</b>
                    <span>Needs review</span>
                  </div>
                )}
                {report.duplicates?.length > 0 && (
                  <div className="ci-stat">
                    <b>{report.duplicates.length}</b>
                    <span>duplicates skipped</span>
                  </div>
                )}
                {report.emptyRows > 0 && (
                  <div className="ci-stat">
                    <b>{report.emptyRows}</b>
                    <span>empty rows</span>
                  </div>
                )}
              </div>

              {/* Recognised Columns */}
              <details className="ci-box" open>
                <summary className="font-semibold text-xs text-stone-700">
                  {report.columns?.length || 0} columns recognised
                  {report.unknownColumns?.length ? `, ${report.unknownColumns.length} ignored` : ''}
                </summary>
                <div className="ci-cols mt-2">
                  {(report.columns || []).map((c: any, i: number) => (
                    <span key={i}>
                      {c.file}
                      {c.file.toLowerCase() !== c.as.toLowerCase() && (
                        <em className="text-stone-400"> as {c.as}</em>
                      )}
                    </span>
                  ))}
                </div>
              </details>

              {/* Issues Review Table */}
              {report.issues?.length > 0 && (
                <details className="ci-box" open>
                  <summary className="font-semibold text-xs text-amber-800 flex items-center gap-1">
                    <AlertTriangle size={13} className="text-amber-600" /> Rows that will need review
                  </summary>
                  <table className="ci-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Client</th>
                        <th>What to check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.issues.map((iss: any, i: number) => (
                        <tr key={i}>
                          <td>{iss.rowNumber}</td>
                          <td className="font-semibold">{iss.name}</td>
                          <td className="text-amber-900 text-xs">{iss.issues.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}

              {/* Duplicates Table */}
              {report.duplicates?.length > 0 && (
                <details className="ci-box">
                  <summary className="font-semibold text-xs text-stone-600">
                    Duplicates that will be skipped ({report.duplicates.length})
                  </summary>
                  <table className="ci-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Client</th>
                        <th>Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.duplicates.map((d: any, i: number) => (
                        <tr key={i}>
                          <td>{d.rowNumber}</td>
                          <td>{d.name}</td>
                          <td className="text-stone-500">{d.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="wizard-footer">
          <div>
            {report ? (
              <button
                type="button"
                className="wizard-back-btn"
                onClick={() => setReport(null)}
              >
                Choose another file
              </button>
            ) : (
              <button type="button" className="wizard-cancel-btn" onClick={onClose}>
                Cancel
              </button>
            )}
          </div>
          <div className="wizard-footer-right">
            {report && (
              <button type="button" className="wizard-cancel-btn" onClick={onClose}>
                Cancel
              </button>
            )}
            {report ? (
              <button
                type="button"
                className="btn-primary-orange"
                disabled={loading || report.willImport === 0}
                onClick={handleCommit}
              >
                {loading
                  ? 'Importing...'
                  : `Import ${report.willImport} client${report.willImport === 1 ? '' : 's'}`}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary-orange"
                disabled={!file || loading}
                onClick={handlePreview}
              >
                {loading ? 'Checking...' : 'Check the file'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
