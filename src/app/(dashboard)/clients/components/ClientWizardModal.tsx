'use client';

import React, { useState } from 'react';
import { X, Trash2, Check, Info } from 'lucide-react';
import { COUNTRIES, findCountry, DEFAULT_COUNTRY_ISO2 } from '@/lib/countries';
import { phoneIssue, emailIssue, blankAddress, isIndia, Address } from '@/lib/phone';

interface ClientWizardModalProps {
  sourceCategories: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (client: any) => void;
}

export default function ClientWizardModal({
  sourceCategories,
  onClose,
  onCreated
}: ClientWizardModalProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState<'Business' | 'Individual'>('Business');
  const [businessMode, setBusinessMode] = useState<'B2B' | 'B2B2C' | 'B2C'>('B2B');
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [countryIso2, setCountryIso2] = useState('IN');

  const [sourceCategoryId, setSourceCategoryId] = useState('');
  const [sourceName, setSourceName] = useState('');

  const [contactPerson, setContactPerson] = useState('');
  const [phones, setPhones] = useState<{ iso2: string; number: string }[]>([
    { iso2: 'IN', number: '' }
  ]);
  const [emails, setEmails] = useState<string[]>(['']);

  const [addresses, setAddresses] = useState<Address[]>([
    blankAddress('India', true)
  ]);

  const STEPS = ['Who', 'Source', 'Contact', 'Address'];
  const TITLES = [
    'Who is the client?',
    'How did they reach us?',
    'How do we reach them?',
    'Where are they?'
  ];

  const handleCountryChange = (iso2: string) => {
    setCountryIso2(iso2);
    const country = findCountry(iso2);
    // Update blank phones and addresses with chosen country
    setPhones(prev =>
      prev.map(p => (!p.number.trim() ? { ...p, iso2 } : p))
    );
    setAddresses(prev =>
      prev.map(a => (!a.addressLine1.trim() ? { ...a, country: country?.name || 'India' } : a))
    );
  };

  const handleAddPhone = () => {
    setPhones(prev => [...prev, { iso2: countryIso2, number: '' }]);
  };

  const handleRemovePhone = (index: number) => {
    if (phones.length > 1) {
      setPhones(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handlePhoneChange = (index: number, field: 'iso2' | 'number', value: string) => {
    setPhones(prev =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleAddEmail = () => {
    setEmails(prev => [...prev, '']);
  };

  const handleRemoveEmail = (index: number) => {
    if (emails.length > 1) {
      setEmails(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleEmailChange = (index: number, val: string) => {
    setEmails(prev => prev.map((e, i) => (i === index ? val : e)));
  };

  const handleAddAddress = () => {
    const country = findCountry(countryIso2);
    setAddresses(prev => [...prev, blankAddress(country?.name || 'India', false)]);
  };

  const handleRemoveAddress = (index: number) => {
    if (addresses.length > 1) {
      const remaining = addresses.filter((_, i) => i !== index);
      // Ensure at least one is billing
      if (!remaining.some(a => a.isBilling)) {
        remaining[0].isBilling = true;
      }
      setAddresses(remaining);
    }
  };

  const handleAddressChange = (index: number, field: keyof Address, val: any) => {
    setAddresses(prev =>
      prev.map((a, i) => {
        if (i === index) return { ...a, [field]: val };
        if (field === 'isBilling' && val === true) return { ...a, isBilling: false };
        return a;
      })
    );
  };

  const validateStep = (currentStep: number): boolean => {
    setErrorMsg(null);
    if (currentStep === 0) {
      if (type === 'Business' && !companyName.trim()) {
        setErrorMsg('Company Name is required');
        return false;
      }
      if (type === 'Individual' && !name.trim()) {
        setErrorMsg('Name is required');
        return false;
      }
    } else if (currentStep === 2) {
      const validPhone = phones.some(p => p.number.trim());
      if (!validPhone) {
        setErrorMsg('At least one phone number is required');
        return false;
      }
      for (const p of phones) {
        const issue = phoneIssue(p.number, p.iso2);
        if (issue) {
          setErrorMsg(`Phone: ${issue}`);
          return false;
        }
      }
      for (const e of emails) {
        const issue = emailIssue(e);
        if (issue) {
          setErrorMsg(`Email: ${issue}`);
          return false;
        }
      }
    } else if (currentStep === 3) {
      for (let i = 0; i < addresses.length; i++) {
        const a = addresses[i];
        if (a.addressLine1.trim() && isIndia(a.country)) {
          if (!a.state?.trim()) {
            setErrorMsg(`Address ${i + 1}: State is required for India`);
            return false;
          }
          if (!a.pincode?.trim()) {
            setErrorMsg(`Address ${i + 1}: Pincode is required for India`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);

    const countryObj = findCountry(countryIso2) || findCountry(DEFAULT_COUNTRY_ISO2)!;
    const filledAddresses = addresses
      .filter(a => a.addressLine1?.trim())
      .map((a, idx) => ({ ...a, isBilling: a.isBilling ?? idx === 0 }));

    const payload = {
      type,
      businessMode,
      companyName: type === 'Business' ? companyName.trim() : undefined,
      contactPerson: type === 'Business' ? contactPerson.trim() : undefined,
      name: type === 'Individual' ? name.trim() : companyName.trim(),
      countryIso2: countryObj.iso2,
      country: countryObj.name,
      sourceCategoryId: sourceCategoryId || null,
      sourceName: sourceName.trim() || null,
      phones: phones.filter(p => p.number.trim()),
      emails: emails.filter(e => e.trim()),
      addresses: filledAddresses.length ? filledAddresses : undefined
    };

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save client');
      }
      onCreated(data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="wizard-modal cw-modal" onClick={e => e.stopPropagation()}>
        {/* Header & Stepper */}
        <div className="wizard-header">
          <div className="flex justify-between items-center">
            <div className="wizard-title">New client</div>
            <button type="button" className="action-icon-btn border-none" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div className="wizard-stepper">
            {STEPS.map((label, idx) => {
              const isDone = idx < step;
              const isCurrent = idx === step;
              return (
                <React.Fragment key={idx}>
                  <div
                    className={`wizard-step ${isDone ? 'done' : isCurrent ? 'current' : ''}`}
                    onClick={() => isDone && setStep(idx)}
                  >
                    <div className="wizard-step-dot">{isDone ? <Check size={11} /> : idx + 1}</div>
                    <div className="wizard-step-label">{label}</div>
                  </div>
                  {idx < STEPS.length - 1 && <div className="wizard-step-connector" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Wizard Body */}
        <div className="wizard-body">
          <div className="wizard-step-title">{TITLES[step]}</div>

          {errorMsg && (
            <div className="p-3 mb-4 bg-red-50 border-l-4 border-red-500 rounded text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {/* STEP 0: WHO */}
          {step === 0 && (
            <div>
              <div className="wizard-field-row">
                <div className="wizard-field">
                  <label className="field-label">Type *</label>
                  <div className="pill-group">
                    {(['Business', 'Individual'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        className={`pill-btn ${type === t ? 'selected' : ''}`}
                        onClick={() => {
                          setType(t);
                          setBusinessMode(t === 'Individual' ? 'B2C' : 'B2B');
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="wizard-field">
                  <label className="field-label flex items-center gap-1">
                    Business mode *
                    <span title="B2B for business, B2C for individual direct, B2B2C for retail distributors">
                      <Info size={13} className="text-stone-400" />
                    </span>
                  </label>
                  <div className="pill-group">
                    {(['B2B', 'B2B2C', 'B2C'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        className={`pill-btn ${businessMode === m ? 'selected' : ''}`}
                        onClick={() => setBusinessMode(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="wizard-field-row">
                {type === 'Business' ? (
                  <div className="wizard-field">
                    <label className="field-label">Company name *</label>
                    <input
                      className="field-input"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="e.g. Acme Corporation"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="wizard-field">
                    <label className="field-label">Name *</label>
                    <input
                      className="field-input"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      autoFocus
                    />
                  </div>
                )}

                <div className="wizard-field">
                  <label className="field-label">Country *</label>
                  <select
                    className="wizard-select"
                    value={countryIso2}
                    onChange={e => handleCountryChange(e.target.value)}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.iso2} value={c.iso2}>
                        {c.name} ({c.dialCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: SOURCE */}
          {step === 1 && (
            <div>
              <div className="wizard-field">
                <label className="field-label">Source</label>
                <div className="pill-group">
                  {sourceCategories.map(s => {
                    const isSelected = sourceCategoryId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`pill-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSourceCategoryId(isSelected ? '' : s.id)}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="wizard-field max-w-md">
                <label className="field-label">Referred by</label>
                <input
                  className="field-input"
                  value={sourceName}
                  onChange={e => setSourceName(e.target.value)}
                  placeholder="Person or company (optional)"
                />
              </div>
            </div>
          )}

          {/* STEP 2: CONTACT */}
          {step === 2 && (
            <div>
              {type === 'Business' && (
                <div className="wizard-field max-w-md">
                  <label className="field-label">Contact person</label>
                  <input
                    className="field-input"
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    placeholder="Point of contact name"
                  />
                </div>
              )}

              {/* Dynamic Phone Rows */}
              <div className="cf-block">
                <label className="field-label">Phone *</label>
                {phones.map((p, idx) => {
                  const issue = phoneIssue(p.number, p.iso2);
                  return (
                    <div key={idx} className="mb-2">
                      <div className="cf-phone-row">
                        <label className="cf-dial">
                          <select
                            value={p.iso2}
                            onChange={e => handlePhoneChange(idx, 'iso2', e.target.value)}
                          >
                            {COUNTRIES.map(c => (
                              <option key={c.iso2} value={c.iso2}>
                                {c.iso2} {c.dialCode}
                              </option>
                            ))}
                          </select>
                        </label>
                        <input
                          className={`field-input ${issue ? 'cf-bad' : ''}`}
                          value={p.number}
                          onChange={e => handlePhoneChange(idx, 'number', e.target.value)}
                          placeholder="Phone number"
                          inputMode="tel"
                        />
                        {phones.length > 1 && (
                          <button
                            type="button"
                            className="wizard-remove-row-btn"
                            onClick={() => handleRemovePhone(idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {issue && <div className="cf-msg">{issue}</div>}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="wizard-add-row-btn"
                  onClick={handleAddPhone}
                >
                  + Phone
                </button>
              </div>

              {/* Dynamic Email Rows */}
              <div className="cf-block">
                <label className="field-label">Email</label>
                {emails.map((e, idx) => {
                  const issue = emailIssue(e);
                  return (
                    <div key={idx} className="mb-2">
                      <div className="cf-phone-row">
                        <input
                          type="email"
                          className={`field-input ${issue ? 'cf-bad' : ''}`}
                          value={e}
                          onChange={ev => handleEmailChange(idx, ev.target.value)}
                          placeholder="name@company.com"
                        />
                        {emails.length > 1 && (
                          <button
                            type="button"
                            className="wizard-remove-row-btn"
                            onClick={() => handleRemoveEmail(idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {issue && <div className="cf-msg">{issue}</div>}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="wizard-add-row-btn"
                  onClick={handleAddEmail}
                >
                  + Email
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ADDRESS */}
          {step === 3 && (
            <div>
              {addresses.map((addr, idx) => (
                <div key={idx} className="cf-address">
                  {addresses.length > 1 && (
                    <div className="cf-address-head">
                      <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer">
                        <input
                          type="radio"
                          name="billingSelect"
                          checked={addr.isBilling}
                          onChange={() => handleAddressChange(idx, 'isBilling', true)}
                        />
                        Billing address
                      </label>
                      <button
                        type="button"
                        className="wizard-remove-row-btn"
                        onClick={() => handleRemoveAddress(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  <div className="wizard-field">
                    <label className="field-label">Address Line 1</label>
                    <input
                      className="field-input"
                      value={addr.addressLine1}
                      onChange={e => handleAddressChange(idx, 'addressLine1', e.target.value)}
                      placeholder="Building, Street, Landmark"
                    />
                  </div>

                  <div className="wizard-field">
                    <label className="field-label">Address Line 2 (Optional)</label>
                    <input
                      className="field-input"
                      value={addr.addressLine2 || ''}
                      onChange={e => handleAddressChange(idx, 'addressLine2', e.target.value)}
                      placeholder="Suite, unit, floor"
                    />
                  </div>

                  <div className="wizard-field-row">
                    <div className="wizard-field">
                      <label className="field-label">City</label>
                      <input
                        className="field-input"
                        value={addr.city || ''}
                        onChange={e => handleAddressChange(idx, 'city', e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div className="wizard-field">
                      <label className="field-label">
                        {isIndia(addr.country) ? 'State *' : 'State / Province'}
                      </label>
                      <input
                        className="field-input"
                        value={addr.state || ''}
                        onChange={e => handleAddressChange(idx, 'state', e.target.value)}
                        placeholder="State"
                      />
                    </div>
                  </div>

                  <div className="wizard-field-row">
                    <div className="wizard-field">
                      <label className="field-label">
                        {isIndia(addr.country) ? 'Pincode *' : 'Postal code'}
                      </label>
                      <input
                        className="field-input"
                        value={addr.pincode || ''}
                        onChange={e => handleAddressChange(idx, 'pincode', e.target.value)}
                        placeholder={isIndia(addr.country) ? '6 digits' : 'Postal code'}
                      />
                    </div>
                    <div className="wizard-field">
                      <label className="field-label">Country</label>
                      <select
                        className="wizard-select"
                        value={addr.country}
                        onChange={e => handleAddressChange(idx, 'country', e.target.value)}
                      >
                        {COUNTRIES.map(c => (
                          <option key={c.iso2} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="wizard-add-row-btn"
                onClick={handleAddAddress}
              >
                + Another address
              </button>
            </div>
          )}
        </div>

        {/* Wizard Footer */}
        <div className="wizard-footer">
          <div>
            {step > 0 ? (
              <button
                type="button"
                className="wizard-back-btn"
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            ) : (
              <button type="button" className="wizard-cancel-btn" onClick={onClose}>
                Cancel
              </button>
            )}
          </div>
          <div className="wizard-footer-right">
            {step > 0 && (
              <button type="button" className="wizard-cancel-btn" onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className="btn-primary-orange"
              disabled={saving}
              onClick={handleNext}
            >
              {saving
                ? 'Saving...'
                : step === STEPS.length - 1
                ? 'Save client'
                : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
