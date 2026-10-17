'use client';

import React, { useState } from 'react';

interface ReviseConfirmationModalProps {
  isOpen: boolean;
  nextVersionLabel: string;
  currentVersionLabel: string;
  isSubmitted: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}

export default function ReviseConfirmationModal({
  isOpen,
  nextVersionLabel,
  currentVersionLabel,
  isSubmitted,
  onCancel,
  onConfirm,
  loading = false
}: ReviseConfirmationModalProps) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="wizard-overlay" onClick={e => e.target === e.currentTarget && !loading && onCancel()}>
      <div className="qd-dlg" role="dialog" aria-modal="true" style={{ maxWidth: 480 }}>
        <div className="qd-dlg-head">
          <h3>Save these changes as {nextVersionLabel}?</h3>
          <p>
            All your changes will be saved together as <b>{nextVersionLabel}</b>. <b>{currentVersionLabel}</b> will stay
            exactly as it was.
            {isSubmitted && ' The new version starts as a draft and must be submitted and approved again.'}
          </p>
        </div>

        <div className="qd-dlg-body">
          <label className="field-label" htmlFor="qdReasonInput" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Reason <span style={{ color: '#A39B8B', fontWeight: 400 }}>(optional, kept with the version)</span>
          </label>
          <textarea
            id="qdReasonInput"
            className="field-input"
            rows={3}
            placeholder="For example: the client reduced the quantity"
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={loading}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D9D2C4', fontSize: 13 }}
            autoFocus
          />
        </div>

        <div className="qd-dlg-actions">
          <button type="button" className="hier-cancel-btn" onClick={onCancel} disabled={loading}>
            No
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onConfirm(reason)}
            disabled={loading}
          >
            {loading ? 'Saving...' : `Yes, save as ${nextVersionLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
