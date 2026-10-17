'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface NewQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newQuoteId: string) => void;
}

export default function NewQuotationModal({ isOpen, onClose, onCreated }: NewQuotationModalProps) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/quotations/waiting-enquiries')
        .then(res => res.json())
        .then(data => {
          setEnquiries(data.enquiries || []);
        })
        .catch(err => {
          console.error(err);
          toast.error('Failed to load waiting enquiries');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = enquiries.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const str = `${e.clientName} ${e.code} ${e.brief}`.toLowerCase();
    return str.includes(q);
  });

  const handlePick = async (enquiryId: string) => {
    try {
      setCreating(true);
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create quotation draft');
      }
      toast.success('Quotation draft started');
      onClose();
      onCreated(data.id);
    } catch (err: any) {
      toast.error(err.message || 'Error creating quotation');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="wizard-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="qd-dlg wide" role="dialog" aria-modal="true">
        <div className="qd-dlg-head">
          <h3>New quotation</h3>
          <p>
            Choose the qualified enquiry to quote. Everything the enquiry knows is copied in, as a draft.
            Nothing is numbered or changed until you submit it.
          </p>
        </div>

        <div className="qd-dlg-body">
          {loading ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#8B8778' }}>
              <Loader2 className="animate-spin inline mr-2" size={18} />
              Loading qualified enquiries...
            </div>
          ) : enquiries.length === 0 ? (
            <div className="clt-empty" style={{ padding: '28px 0', textAlign: 'center' }}>
              No qualified enquiry is waiting for a quotation. Qualify an enquiry first: it needs a brief.
            </div>
          ) : (
            <>
              <div className="pp-search qn-search" style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#A39B8B' }} />
                <input
                  type="search"
                  placeholder="Search client, enquiry code or brief"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    paddingLeft: 34,
                    paddingRight: 12,
                    borderRadius: 8,
                    border: '1px solid #D9D2C4',
                    fontSize: 13
                  }}
                  autoFocus
                />
              </div>

              <div className="qn-list">
                {filtered.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    className="qn-row"
                    onClick={() => handlePick(e.id)}
                    disabled={creating}
                  >
                    <span className="qn-main">
                      <b>{e.clientName}</b>
                      <small>
                        {e.code}
                        {e.salespersonName ? ` · ${e.salespersonName}` : ''}
                      </small>
                      {e.brief && (
                        <span className="qn-brief">
                          {e.brief.length > 140 ? `${e.brief.slice(0, 140)}...` : e.brief}
                        </span>
                      )}
                    </span>
                    <span className="qn-side">
                      <span>
                        {e.itemsCount ? `${e.itemsCount} product${e.itemsCount === 1 ? '' : 's'}` : 'No products yet'}
                      </span>
                      {e.opportunityValue > 0 && (
                        <small>₹{Math.round(e.opportunityValue).toLocaleString('en-IN')}</small>
                      )}
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#8B8778', fontSize: 13 }}>
                    Nothing matches your search.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="qd-dlg-actions">
          <button type="button" className="hier-cancel-btn" onClick={onClose} disabled={creating}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
