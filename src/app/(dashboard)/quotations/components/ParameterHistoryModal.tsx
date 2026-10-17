'use client';

import React from 'react';
import { formatDateTime } from '@/lib/dates';
import { X } from 'lucide-react';

interface ParameterHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineId: string;
  field: string;
  label: string;
  lineName: string;
  versions: any[];
}

export default function ParameterHistoryModal({
  isOpen,
  onClose,
  lineId,
  field,
  label,
  lineName,
  versions
}: ParameterHistoryModalProps) {
  if (!isOpen) return null;

  // Collect changes for this lineId and field across versions (oldest first)
  const changesList: Array<{ version: any; change: any }> = [];
  const sortedVersions = [...versions].sort((a, b) => a.versionNo - b.versionNo);

  sortedVersions.forEach(v => {
    const list = Array.isArray(v.changes) ? v.changes : [];
    list.forEach((c: any) => {
      if (c.scope === 'line' && c.lineId === lineId && c.field === field) {
        changesList.push({ version: v, change: c });
      }
    });
  });

  const formatValue = (type: string, val: any) => {
    if (val === null || val === undefined) return '–';
    if (type === 'money') return `₹${Number(val).toLocaleString('en-IN')}`;
    return String(val);
  };

  const addedInVersion = sortedVersions.find(v =>
    (Array.isArray(v.changes) ? v.changes : []).some(
      (c: any) => c.lineId === lineId && c.field === 'line' && c.type === 'added'
    )
  );

  const initialLabel = addedInVersion ? `Added in ${addedInVersion.versionLabel}` : 'Original (v0)';
  const firstChange = changesList[0]?.change;

  return (
    <div className="wizard-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="qd-dlg" role="dialog" aria-modal="true" style={{ maxWidth: 460 }}>
        <div className="qd-dlg-head">
          <h3>
            {label} · {lineName}
          </h3>
          <p>Every change to this parameter across the versions of this quotation.</p>
        </div>

        <div className="qd-dlg-body">
          {changesList.length === 0 ? (
            <p style={{ color: '#8B8778', fontSize: 13 }}>No changes recorded for this parameter.</p>
          ) : (
            <ul className="hd-list">
              {/* Initial state */}
              <li className="hd-row">
                <b>{initialLabel}</b>
                <span className="hd-val">{formatValue(firstChange?.type, firstChange?.from)}</span>
              </li>

              {/* Subsequent revisions */}
              {changesList.map(({ version, change }, idx) => (
                <li key={idx} className="hd-row cur">
                  <b>{version.versionLabel}</b>
                  <span className="hd-val">{formatValue(change.type, change.to)}</span>
                  <small>
                    {formatDateTime(version.createdAt)} · {version.createdByName || 'Admin'}
                  </small>
                  <span className="hd-from">was {formatValue(change.type, change.from)}</span>
                  {version.reason && (
                    <small style={{ fontStyle: 'italic', color: '#6F6858', marginTop: 2 }}>
                      “{version.reason}”
                    </small>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="qd-dlg-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
