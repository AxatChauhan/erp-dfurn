'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Check, 
  Paperclip, 
  Upload, 
  MessageCircle, 
  Save, 
  Info,
  X
} from 'lucide-react';
import { COUNTRIES, findCountry, DEFAULT_COUNTRY_ISO2 } from '@/lib/countries';
import { toast } from 'sonner';

interface QuickEnquiryWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  clients: Array<{
    id: string;
    name: string;
    displayName?: string;
    clientType?: string;
    phones?: string[];
    phoneDetails?: any[];
    countryIso2?: string;
    emails?: string[];
  }>;
  categories: Array<{ id: string; name: string; code?: string }>;
  sourceCategories: Array<{ id: string; name: string }>;
  salespersons: Array<{ id: string; name: string; employeeCode?: string; role?: string }>;
}

const STEPS = ['Client', 'Interest', 'Source'];

const ATTACH_EXTENSIONS = [
  'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'dwg', 'dxf',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
];
const ATTACH_MAX_BYTES = 20 * 1024 * 1024;

const APPROX_PHONE_DIGITS: Record<string, number> = {
  IN: 10, AE: 9, US: 10, CA: 10, GB: 10, SA: 9, SG: 8, AU: 9,
  DE: 11, FR: 9, NL: 9, IT: 10, ES: 9, ZA: 9, NG: 10, KE: 9,
  EG: 10, QA: 8, KW: 8, OM: 8, BH: 8, NP: 10, BD: 10, LK: 9,
  PK: 10, MY: 9, ID: 10, TH: 9, PH: 10, VN: 9, CN: 11, JP: 10,
  KR: 10, HK: 8, NZ: 9, BR: 11, MX: 10, RU: 10, TR: 10, CH: 9
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function extOf(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  return m ? m[1].toLowerCase() : '';
}

export default function QuickEnquiryWizardModal({
  isOpen,
  onClose,
  onCreated,
  clients,
  categories,
  sourceCategories,
  salespersons,
}: QuickEnquiryWizardModalProps) {
  const [slide, setSlide] = useState(0);
  const [unlocked, setUnlocked] = useState(0);

  // Form State
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [creatingNewClient, setCreatingNewClient] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clientType, setClientType] = useState<'BUSINESS' | 'INDIVIDUAL'>('INDIVIDUAL');

  const [countryIso2, setCountryIso2] = useState<string>(DEFAULT_COUNTRY_ISO2);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSourceCategoryId, setSelectedSourceCategoryId] = useState<string>('');
  const [sourceName, setSourceName] = useState('');
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Validation Errors
  const [nameError, setNameError] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [emailWarn, setEmailWarn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState('Create Enquiry');

  const comboRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSlide(0);
      setUnlocked(0);
      setClientQuery('');
      setSelectedClientId(null);
      setCreatingNewClient(false);
      setDropdownOpen(false);
      setClientType('INDIVIDUAL');
      setCountryIso2(DEFAULT_COUNTRY_ISO2);
      setPhone('');
      setEmail('');
      setSelectedCategoryId('');
      setSelectedSourceCategoryId('');
      setSourceName('');
      setSelectedSalespersonId(salespersons.length > 0 ? salespersons[0].id : '');
      setPendingFiles([]);
      setNameError(false);
      setPhoneError('');
      setEmailWarn(false);
      setSubmitting(false);
      setSubmitStatusText('Create Enquiry');
    }
  }, [isOpen, salespersons]);

  // Handle outside click for client dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Filter clients
  const filteredClients = clients.filter(c => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return true;
    return (c.name || c.displayName || '').toLowerCase().includes(q) ||
      (c.phones && c.phones.some(p => p.toLowerCase().includes(q)));
  }).slice(0, 8);

  const handleSelectClient = (c: any) => {
    setSelectedClientId(c.id);
    setCreatingNewClient(false);
    setClientQuery(c.displayName || c.name);
    setDropdownOpen(false);
    setNameError(false);

    if (c.clientType) {
      setClientType(c.clientType === 'BUSINESS' || c.clientType === 'Business' ? 'BUSINESS' : 'INDIVIDUAL');
    }

    // Auto-fill phone and country if present
    const firstPhone = c.phones && c.phones[0] ? c.phones[0] : '';
    if (firstPhone) {
      const matchCountry = COUNTRIES.find(country => firstPhone.startsWith(country.dialCode));
      if (matchCountry) {
        setCountryIso2(matchCountry.iso2);
        setPhone(firstPhone.slice(matchCountry.dialCode.length));
      } else {
        setPhone(firstPhone);
      }
    }
    if (c.countryIso2) setCountryIso2(c.countryIso2);
    if (c.emails && c.emails[0]) setEmail(c.emails[0]);
    setPhoneError('');
  };

  const handleStartNewClient = () => {
    setSelectedClientId(null);
    setCreatingNewClient(true);
    setDropdownOpen(false);
    setClientQuery('');
  };

  const validatePhone = (val: string, iso: string): boolean => {
    const trimmed = val.trim();
    const digits = APPROX_PHONE_DIGITS[iso];
    const country = findCountry(iso) || findCountry(DEFAULT_COUNTRY_ISO2);

    if (!trimmed) {
      setPhoneError('Client phone is required.');
      return false;
    }
    if (trimmed.startsWith('0')) {
      setPhoneError('Remove the leading 0 and enter the local number only.');
      return false;
    }
    if (country && trimmed.startsWith(country.dialCode.replace('+', '')) && digits && trimmed.length > digits) {
      setPhoneError("Don't include the country code; it's already set above.");
      return false;
    }
    if (digits && trimmed.replace(/\D/g, '').length !== digits) {
      setPhoneError(`Should be exactly ${digits} digits for this country.`);
      return false;
    }

    setPhoneError('');
    return true;
  };

  const validateEmail = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setEmailWarn(false);
      return;
    }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    setEmailWarn(!ok);
  };

  const validateStep0 = (): boolean => {
    let valid = true;
    if (!clientQuery.trim()) {
      setNameError(true);
      valid = false;
    } else {
      setNameError(false);
    }

    if (!validatePhone(phone, countryIso2)) {
      valid = false;
    }

    return valid;
  };

  const handleNext = () => {
    if (slide === 0) {
      if (!validateStep0()) return;
      setSlide(1);
      setUnlocked(Math.max(unlocked, 1));
      return;
    }
    if (slide === 1) {
      if (!selectedCategoryId) {
        toast.error('Please select a Category Interest');
        return;
      }
      setSlide(2);
      setUnlocked(Math.max(unlocked, 2));
      return;
    }
    handleSubmit();
  };

  const handleCategoryPick = (catId: string) => {
    setSelectedCategoryId(catId);
    setTimeout(() => {
      setSlide(2);
      setUnlocked(prev => Math.max(prev, 2));
    }, 280);
  };

  const handleFilesPicked = (fileList: FileList | null) => {
    if (!fileList) return;
    const added: File[] = [];
    const rejected: string[] = [];

    Array.from(fileList).forEach(file => {
      const ext = extOf(file.name);
      if (!ATTACH_EXTENSIONS.includes(ext)) {
        rejected.push(`${file.name} (unsupported format)`);
        return;
      }
      if (file.size > ATTACH_MAX_BYTES) {
        rejected.push(`${file.name} (exceeds 20 MB)`);
        return;
      }
      added.push(file);
    });

    if (rejected.length > 0) {
      toast.error(`Skipped: ${rejected.join(', ')}`);
    }
    if (added.length > 0) {
      setPendingFiles(prev => [...prev, ...added]);
    }
  };

  const removeFile = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!selectedSalespersonId) {
      toast.error('Salesperson is required');
      return;
    }

    setSubmitting(true);
    setSubmitStatusText('Creating...');

    try {
      const payload = {
        clientId: selectedClientId || undefined,
        clientName: clientQuery.trim(),
        clientType,
        clientPhone: phone.trim(),
        clientCountry: countryIso2,
        clientEmail: email.trim() || undefined,
        categoryId: selectedCategoryId,
        sourceCategoryId: selectedSourceCategoryId || undefined,
        sourceName: sourceName.trim() || undefined,
        salespersonId: selectedSalespersonId,
      };

      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create enquiry');
      }

      const createdEnquiryId = data.enquiry.id;
      const baseMsg = data.clientWasExisting
        ? 'Enquiry created and linked to the existing client'
        : 'Enquiry created with a new client';

      if (pendingFiles.length > 0) {
        setSubmitStatusText('Uploading files...');
        let ok = 0;
        let failed = 0;

        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('stage', 'Enquiry');

          try {
            const upRes = await fetch(`/api/enquiries/${createdEnquiryId}/files`, {
              method: 'POST',
              body: fd
            });
            if (upRes.ok) ok++;
            else failed++;
          } catch {
            failed++;
          }
        }

        if (failed > 0) {
          toast.error(`${baseMsg}. ${ok} of ${pendingFiles.length} files attached, ${failed} failed.`);
        } else {
          toast.success(`${baseMsg}. ${ok} file${ok === 1 ? '' : 's'} attached.`);
        }
      } else {
        toast.success(baseMsg);
      }

      onClose();
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred');
      setSubmitting(false);
      setSubmitStatusText('Create Enquiry');
    }
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', background: '#FFFFFF', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        {/* Header - Clean title as shown in Image 5 */}
        <div style={{ padding: '20px 28px 12px' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111111' }}>Quick Enquiry</h2>
        </div>

        {/* Milestone Stepper matching Image 5 */}
        <div className="qe-stepper" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', paddingBottom: 16, borderBottom: '1px solid #E5DFD3', margin: '0 28px 14px' }}>
          {/* Connecting track line */}
          <div style={{ position: 'absolute', top: 12, left: '16.6%', right: '16.6%', height: 1.5, background: '#DCD5C8', zIndex: 0 }} />
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: '16.6%',
              height: 1.5,
              background: '#27AE60',
              zIndex: 1,
              width: `${(slide / (STEPS.length - 1)) * 66.8}%`,
              transition: 'width 0.35s ease'
            }}
          />

          {STEPS.map((label, i) => {
            const isDone = i < slide;
            const isCurrent = i === slide;
            return (
              <div
                key={label}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: i <= unlocked ? 'pointer' : 'default'
                }}
                onClick={() => { if (i <= unlocked) setSlide(i); }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    background: isDone ? '#27AE60' : isCurrent ? '#000000' : '#FFFFFF',
                    border: isDone ? '1.5px solid #27AE60' : isCurrent ? '1.5px solid #000000' : '1.5px solid #C9C2B0',
                    color: isDone || isCurrent ? '#FFFFFF' : '#A79F8F',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {isDone ? <Check size={12} strokeWidth={3} /> : (i + 1)}
                </div>
                <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#111111' : '#A79F8F' }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Body Slider Container */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 28px 20px' }}>
          <div className="qe-slider-wrap" style={{ width: '100%', position: 'relative' }}>
            <div className="qe-slides" style={{ width: '100%' }}>
              
              {/* SLIDE 0: CLIENT */}
              <div
                key="slide-0"
                className={`qe-slide ${slide === 0 ? 'qe-step-animated' : ''}`}
                style={{
                  display: slide === 0 ? 'block' : 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                {/* 1. Client Name */}
                <div className="qe-combo" ref={comboRef} style={{ position: 'relative', marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 6 }}>
                    Client Name *
                  </label>
                  <input
                    type="text"
                    className="field-input"
                    style={{
                      width: '100%',
                      height: 40,
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: nameError ? '1.5px solid #C0392B' : '1px solid #DCD5C8',
                      background: nameError ? '#FDF3F2' : '#FFFFFF',
                      fontSize: 14,
                      outline: 'none'
                    }}
                    placeholder="Search or select a client"
                    value={clientQuery}
                    onFocus={() => { if (!creatingNewClient) setDropdownOpen(true); }}
                    onChange={(e) => {
                      setClientQuery(e.target.value);
                      if (selectedClientId) setSelectedClientId(null);
                      setDropdownOpen(true);
                      setNameError(false);
                    }}
                  />

                  {nameError && <div className="qe-err show" style={{ color: '#C0392B', fontSize: 12, fontWeight: 600, marginTop: 4 }}>Client name is required.</div>}

                  {selectedClientId && (
                    <div className="qe-autofill-note show" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#3B6D11', marginTop: 5 }}>
                      <Save size={13} /> Country and phone auto-filled from this client's record
                    </div>
                  )}

                  {creatingNewClient && (
                    <div className="qe-newclient-note show" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF6ED', border: '1px solid #FFD9B3', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#B85C00', marginTop: 6 }}>
                      New client. Fill in their name and phone below.{' '}
                      <a
                        onClick={() => {
                          setCreatingNewClient(false);
                          setClientQuery('');
                          setDropdownOpen(true);
                        }}
                        style={{ color: '#B85C00', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Search existing instead
                      </a>
                    </div>
                  )}

                  {/* Dropdown with pinned + New client row */}
                  {dropdownOpen && !creatingNewClient && (
                    <div className="qe-client-dropdown open" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#FFFFFF', border: '1px solid #E5DFD3', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 30, maxHeight: 220, overflowY: 'auto' }}>
                      <div
                        className="qe-new-client-row"
                        onClick={handleStartNewClient}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', color: '#FF7700', fontWeight: 600, fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #F0EBE1', position: 'sticky', top: 0, background: '#FFFFFF' }}
                      >
                        <Plus size={14} /> New client
                      </div>
                      {filteredClients.length > 0 ? (
                        filteredClients.map(c => (
                          <div
                            key={c.id}
                            className="qe-client-row"
                            onClick={() => handleSelectClient(c)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', cursor: 'pointer', fontSize: 13 }}
                          >
                            <span style={{ color: '#333333', fontWeight: 600 }}>{c.displayName || c.name}</span>
                            <span style={{ color: '#A79F8F', fontSize: 12 }}>{(c.phones && c.phones[0]) || '–'}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '12px', color: '#A79F8F', fontSize: 12, textAlign: 'center' }}>
                          {clients.length ? 'No matching clients' : 'No existing clients yet'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Is the client a business or a person? * (from Image 5) */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 8 }}>
                    Is the client a business or a person? * <Info size={14} style={{ color: '#8B8778' }} />
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setClientType('BUSINESS')}
                      style={{
                        padding: '7px 22px',
                        borderRadius: 20,
                        border: clientType === 'BUSINESS' ? '1.5px solid #000000' : '1px solid #DCD5C4',
                        background: clientType === 'BUSINESS' ? '#000000' : '#FFFFFF',
                        color: clientType === 'BUSINESS' ? '#FFFFFF' : '#333333',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Business
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientType('INDIVIDUAL')}
                      style={{
                        padding: '7px 22px',
                        borderRadius: 20,
                        border: clientType === 'INDIVIDUAL' ? '1.5px solid #000000' : '1px solid #DCD5C4',
                        background: clientType === 'INDIVIDUAL' ? '#000000' : '#FFFFFF',
                        color: clientType === 'INDIVIDUAL' ? '#FFFFFF' : '#333333',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Individual
                    </button>
                  </div>
                </div>

                {/* 3. Country & Client Phone Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 6 }}>
                      Country *
                    </label>
                    <select
                      className="wizard-select"
                      style={{ width: '100%', height: 40, padding: '0 10px', borderRadius: 6, border: '1px solid #DCD5C8', fontSize: 13, background: '#FFFFFF' }}
                      value={countryIso2}
                      onChange={(e) => {
                        const newIso = e.target.value;
                        setCountryIso2(newIso);
                        if (phone) validatePhone(phone, newIso);
                      }}
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.iso2} value={c.iso2}>
                          {c.name} ({c.dialCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 6 }}>
                      Client Phone *
                    </label>
                    <input
                      type="text"
                      className="field-input"
                      style={{
                        width: '100%',
                        height: 40,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: phoneError ? '1.5px solid #C0392B' : '1px solid #DCD5C8',
                        background: phoneError ? '#FDF3F2' : '#FFFFFF',
                        fontSize: 14,
                        outline: 'none'
                      }}
                      placeholder="Local number, no country code or leading 0"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPhone(val);
                        validatePhone(val, countryIso2);
                      }}
                    />
                    {phoneError ? (
                      <div style={{ color: '#C0392B', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{phoneError}</div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#3B6D11', marginTop: 5 }}>
                        <MessageCircle size={13} /> Prefer a WhatsApp number, if the client has one
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Email (Optional) */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 6 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    className="field-input"
                    style={{ width: '100%', height: 40, padding: '8px 12px', borderRadius: 6, border: emailWarn ? '1px solid #FFB366' : '1px solid #DCD5C8', fontSize: 14, outline: 'none' }}
                    placeholder="Optional"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      validateEmail(e.target.value);
                    }}
                    onBlur={() => {
                      if (slide === 0 && clientQuery.trim() && validatePhone(phone, countryIso2)) {
                        setSlide(1);
                        setUnlocked(prev => Math.max(prev, 1));
                      }
                    }}
                  />
                  {emailWarn && <div style={{ color: '#B85C00', fontSize: 12, marginTop: 4 }}>That doesn't look like a valid email. Double check it.</div>}
                </div>
              </div>

              {/* SLIDE 1: INTEREST */}
              <div
                key="slide-1"
                className={`qe-slide ${slide === 1 ? 'qe-step-animated' : ''}`}
                style={{
                  display: slide === 1 ? 'block' : 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 12 }}>
                  Category Interest *
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {categories.map(c => {
                    const isSelected = selectedCategoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCategoryPick(c.id)}
                        style={{
                          padding: '9px 18px',
                          borderRadius: 24,
                          border: isSelected ? '1.5px solid #FF7700' : '1px solid #DCD5C4',
                          background: isSelected ? 'rgba(255, 119, 0, 0.12)' : '#FFFFFF',
                          color: isSelected ? '#FF7700' : '#333333',
                          fontWeight: 600,
                          fontSize: 13.5,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SLIDE 2: SOURCE & SALESPERSON */}
              <div
                key="slide-2"
                className={`qe-slide ${slide === 2 ? 'qe-step-animated' : ''}`}
                style={{
                  display: slide === 2 ? 'block' : 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 8 }}>
                    Source Category
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {sourceCategories.map(s => {
                      const isSelected = selectedSourceCategoryId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSourceCategoryId(isSelected ? '' : s.id)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: 20,
                            border: isSelected ? '1.5px solid #FF7700' : '1px solid #DCD5C4',
                            background: isSelected ? 'rgba(255, 119, 0, 0.12)' : '#FFFFFF',
                            color: isSelected ? '#FF7700' : '#333333',
                            fontWeight: 600,
                            fontSize: 12.5,
                            cursor: 'pointer',
                          }}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 6 }}>
                      Source Name
                    </label>
                    <input
                      type="text"
                      className="field-input"
                      style={{ width: '100%', height: 40, padding: '8px 12px', borderRadius: 6, border: '1px solid #DCD5C8', fontSize: 13 }}
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 6 }}>
                      Salesperson *
                    </label>
                    <select
                      className="wizard-select"
                      style={{ width: '100%', height: 40, padding: '0 10px', borderRadius: 6, border: '1px solid #DCD5C8', fontSize: 13, background: '#FFFFFF' }}
                      value={selectedSalespersonId}
                      onChange={(e) => setSelectedSalespersonId(e.target.value)}
                    >
                      <option value="">Select Salesperson...</option>
                      {salespersons.map(sp => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name} {sp.employeeCode ? `(${sp.employeeCode})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Attachments Section */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 4 }}>
                    Attachments
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      handleFilesPicked(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 6,
                      background: '#F4F1EC',
                      border: '1px solid #DCD5C8',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#333333',
                      cursor: 'pointer',
                      marginTop: 4
                    }}
                  >
                    <Upload size={14} /> Attach files
                  </button>
                  <div style={{ fontSize: 12, color: '#A79F8F', marginTop: 5 }}>
                    Drawings, site photos, or reference docs: PDF, images, DWG/DXF, or Office files, up to 20 MB each.
                  </div>

                  {pendingFiles.length > 0 && (
                    <div className="qe-attach-list" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pendingFiles.map((f, i) => (
                        <div key={i} className="qe-attach-chip" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: '1px solid #E5DFD3', borderRadius: 6, background: '#F4F1EC', color: '#8B8778' }}>
                          <Paperclip size={14} color="#8B8778" />
                          <span style={{ color: '#333333', fontWeight: 600, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                          <span style={{ fontSize: 12, color: '#A79F8F' }}>{formatFileSize(f.size)}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B8778', padding: 2 }}
                            title="Remove file"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer matching Image 5 */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid #E5DFD3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF' }}>
          <div>
            {slide > 0 ? (
              <button
                type="button"
                onClick={() => setSlide(s => Math.max(0, s - 1))}
                style={{ padding: '8px 18px', borderRadius: 6, background: '#FFFFFF', border: '1px solid #DCD5C8', fontSize: 13, fontWeight: 600, color: '#333333', cursor: 'pointer' }}
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={{ background: 'none', border: 'none', fontSize: 13.5, fontWeight: 600, color: '#8B8778', cursor: 'pointer', padding: '8px 0' }}
              >
                Cancel
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {slide > 0 && (
              <button
                type="button"
                onClick={onClose}
                style={{ background: 'none', border: 'none', fontSize: 13.5, fontWeight: 600, color: '#8B8778', cursor: 'pointer', padding: '8px 6px' }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={handleNext}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 24px',
                borderRadius: 6,
                background: '#FF7700',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(255,119,0,0.25)'
              }}
            >
              {slide === STEPS.length - 1 ? submitStatusText : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
