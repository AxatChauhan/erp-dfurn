'use client';

import React, { useState } from 'react';
import { X, Trash2, Info } from 'lucide-react';
import { COUNTRIES, findCountry, DEFAULT_COUNTRY_ISO2 } from '@/lib/countries';
import { phoneIssue, emailIssue, blankAddress, isIndia, splitPhone, Address } from '@/lib/phone';

interface ClientEditModalProps {
  client: any;
  sourceCategories: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (updatedClient: any) => void;
}

export default function ClientEditModal({
  client,
  sourceCategories,
  onClose,
  onSaved
}: ClientEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [type, setType] = useState<'Business' | 'Individual'>(
    client.clientType === 'Individual' ? 'Individual' : 'Business'
  );
  const [businessMode, setBusinessMode] = useState<'B2B' | 'B2B2C' | 'B2C'>(
    client.businessMode || (type === 'Individual' ? 'B2C' : 'B2B')
  );
  const [companyName, setCompanyName] = useState(client.companyName || client.name || '');
  const [name, setName] = useState(client.name || '');
  const [contactPerson, setContactPerson] = useState(client.contactPerson || '');
  const [countryIso2, setCountryIso2] = useState(client.countryIso2 || 'IN');

  // Convert raw phones to { iso2, number }
  const initialPhones = (client.phones || []).map((p: string) => {
    const split = splitPhone(p, client.countryIso2 || 'IN');
    return { iso2: split.iso2, number: split.number };
  });

  const [phones, setPhones] = useState<{ iso2: string; number: string }[]>(
    initialPhones.length ? initialPhones : [{ iso2: countryIso2, number: '' }]
  );

  const [emails, setEmails] = useState<string[]>(
    (client.emails && client.emails.length) ? client.emails : ['']
  );

  const initialAddrs = Array.isArray(client.addresses) ? client.addresses : [];
  const [addresses, setAddresses] = useState<Address[]>(
    initialAddrs.length ? initialAddrs : [blankAddress('India', true)]
  );

  const [sourceCategoryId, setSourceCategoryId] = useState(client.sourceCategoryId || '');
  const [sourceName, setSourceName] = useState(client.sourceName || '');
  const [gstin, setGstin] = useState(client.taxId || '');

  const handleCountryChange = (iso2: string) => {
    setCountryIso2(iso2);
    const country = findCountry(iso2);
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

  const handleSave = async () => {
    setErrorMsg(null);

    if (type === 'Business' && !companyName.trim()) {
      setErrorMsg('Company Name is required');
      return;
    }
    if (type === 'Individual' && !name.trim()) {
      setErrorMsg('Name is required');
      return;
    }
    if (!phones.some(p => p.number.trim())) {
      setErrorMsg('At least one phone number is required');
      return;
    }
    for (const p of phones) {
      const issue = phoneIssue(p.number, p.iso2);
      if (issue) {
        setErrorMsg(`Phone: ${issue}`);
        return;
      }
    }
    for (const e of emails) {
      const issue = emailIssue(e);
      if (issue) {
        setErrorMsg(`Email: ${issue}`);
        return;
      }
    }

    setSaving(true);
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
      taxId: gstin.trim() || null,
      phones: phones.filter(p => p.number.trim()),
      emails: emails.filter(e => e.trim()),
      addresses: filledAddresses
    };

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update client');
      }
      onSaved(data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="wizard-modal cw-modal" onClick={e => e.stopPropagation()}>
        <div className="wizard-header">
          <div className="flex justify-between items-center">
            <div className="wizard-title">
              Edit {client.displayName || client.name || client.clientCode}
            </div>
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

          <div className="wizard-field-row">
            <div className="wizard-field">
              <label className="field-label">Type *</label>
              <div className="pill-group">
                {(['Business', 'Individual'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`pill-btn ${type === t ? 'selected' : ''}`}
                    onClick={() => setType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="wizard-field">
              <label className="field-label flex items-center gap-1">
                Business mode *
                <span title="Changing business mode later does not change the client code (it keeps the mode it was created with).">
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
              <>
                <div className="wizard-field">
                  <label className="field-label">Company name *</label>
                  <input
                    className="field-input"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="wizard-field">
                  <label className="field-label">Contact person</label>
                  <input
                    className="field-input"
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="wizard-field">
                <label className="field-label">Name *</label>
                <input
                  className="field-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="wizard-field-row">
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

            {(countryIso2 === 'IN' || isIndia(findCountry(countryIso2)?.name)) && (
              <div className="wizard-field">
                <label className="field-label">GSTIN</label>
                <input
                  className="field-input"
                  value={gstin}
                  onChange={e => setGstin(e.target.value.toUpperCase())}
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              </div>
            )}
          </div>

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

          {/* Addresses */}
          <div className="cf-block">
            <label className="field-label">Addresses</label>
            {addresses.map((addr, idx) => (
              <div key={idx} className="cf-address">
                {addresses.length > 1 && (
                  <div className="cf-address-head">
                    <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer">
                      <input
                        type="radio"
                        name="editBillingSelect"
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
                  />
                </div>

                <div className="wizard-field">
                  <label className="field-label">Address Line 2 (Optional)</label>
                  <input
                    className="field-input"
                    value={addr.addressLine2 || ''}
                    onChange={e => handleAddressChange(idx, 'addressLine2', e.target.value)}
                  />
                </div>

                <div className="wizard-field-row">
                  <div className="wizard-field">
                    <label className="field-label">City</label>
                    <input
                      className="field-input"
                      value={addr.city || ''}
                      onChange={e => handleAddressChange(idx, 'city', e.target.value)}
                    />
                  </div>
                  <div className="wizard-field">
                    <label className="field-label">State</label>
                    <input
                      className="field-input"
                      value={addr.state || ''}
                      onChange={e => handleAddressChange(idx, 'state', e.target.value)}
                    />
                  </div>
                </div>

                <div className="wizard-field-row">
                  <div className="wizard-field">
                    <label className="field-label">Pincode / Postal code</label>
                    <input
                      className="field-input"
                      value={addr.pincode || ''}
                      onChange={e => handleAddressChange(idx, 'pincode', e.target.value)}
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

          {/* Source Attribution */}
          <div className="wizard-field-row">
            <div className="wizard-field">
              <label className="field-label">Source</label>
              <select
                className="wizard-select"
                value={sourceCategoryId}
                onChange={e => setSourceCategoryId(e.target.value)}
              >
                <option value="">Not recorded</option>
                {sourceCategories.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="wizard-field">
              <label className="field-label">Referred by</label>
              <input
                className="field-input"
                value={sourceName}
                onChange={e => setSourceName(e.target.value)}
                placeholder="Person or company"
              />
            </div>
          </div>
        </div>

        <div className="wizard-footer">
          <button type="button" className="wizard-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary-orange"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
