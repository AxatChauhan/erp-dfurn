'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, Check, AlertCircle, Upload, Plus, Trash2 } from 'lucide-react';
import { autoCode } from '@/lib/products/codeGen';
import { computeCbm, dimensionsInInches, DELIVERY_MODES, UNITS, CREATION_MODES } from '@/lib/products/measures';

interface MasterProductWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: { id: string; name: string; isProduction: boolean }[];
  catalogues: { id: string; name: string }[];
}

export default function MasterProductWizardModal({
  isOpen,
  onClose,
  onSuccess,
  departments,
  catalogues,
}: MasterProductWizardModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hierarchy data for Step 1
  const [segments, setSegments] = useState<any[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState('');

  // Step 1: Identity
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeConflict, setCodeConflict] = useState<string | null>(null);
  const [isCodeAvailable, setIsCodeAvailable] = useState<boolean | null>(null);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

  // Step 2: Specifications
  const [specs, setSpecs] = useState<Array<{ key: string; kind: 'fixed' | 'customizable'; value: string; catalogueId?: string }>>([
    { key: 'Carcass', kind: 'fixed', value: '18mm Prelam HDHMR Grade A' },
    { key: 'Shade / Colour', kind: 'customizable', value: '', catalogueId: catalogues[0]?.id },
  ]);

  // Step 3: Dimensions (mm)
  const [nakedMm, setNakedMm] = useState({ l: 1200, w: 600, h: 750 });
  const [boxMm, setBoxMm] = useState({ l: 1250, w: 650, h: 800 });

  // Step 4: Pricing & Logistics
  const [baseSellingRate, setBaseSellingRate] = useState<number>(12500);
  const [marginTarget, setMarginTarget] = useState<number>(30);
  const [deliveryMode, setDeliveryMode] = useState<'RTA' | 'Pre-assembled'>('Pre-assembled');
  const [creationMode, setCreationMode] = useState<'In-house' | 'Outsource'>('In-house');
  const [unit, setUnit] = useState<'Nos' | 'Sq.Ft' | 'R.Ft' | 'kg'>('Nos');
  const [leadTimeDays, setLeadTimeDays] = useState<number>(7);
  const [moq, setMoq] = useState<number>(1);

  // Step 5: Images
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Load hierarchy
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/products/hierarchy')
      .then((res) => res.json())
      .then((d) => {
        if (d.ok && d.segments.length > 0) {
          setSegments(d.segments);
          setSelectedSegmentId(d.segments[0].id);
          if (d.segments[0].categories.length > 0) {
            setSelectedCategoryId(d.segments[0].categories[0].id);
            if (d.segments[0].categories[0].subCategories.length > 0) {
              setSelectedSubCategoryId(d.segments[0].categories[0].subCategories[0].id);
            }
          }
        }
      });
  }, [isOpen]);

  const activeSegment = segments.find((s) => s.id === selectedSegmentId);
  const activeCategories: any[] = activeSegment ? activeSegment.categories || [] : [];
  const activeCategory = activeCategories.find((c: any) => c.id === selectedCategoryId);
  const activeSubCategories: any[] = activeCategory ? activeCategory.subCategories || [] : [];

  // Live 350ms debounced code preview
  useEffect(() => {
    if (!selectedSubCategoryId || !name.trim()) {
      setIsCodeAvailable(null);
      setCodeConflict(null);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/products/master-products/preview-code?subCategoryId=${selectedSubCategoryId}&name=${encodeURIComponent(name)}`)
        .then((res) => res.json())
        .then((d) => {
          if (d.ok) {
            setCode(d.code);
            setIsCodeAvailable(d.available);
            setCodeConflict(d.conflictWith);
          }
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [selectedSubCategoryId, name]);

  if (!isOpen) return null;

  const handleDeptToggle = (deptId: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const cbm = computeCbm(boxMm);
  const nakedInches = dimensionsInInches(nakedMm);
  const boxInches = dimensionsInInches(boxMm);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const res = await fetch('/api/products/master-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          subCategoryId: selectedSubCategoryId,
          departmentIds: selectedDeptIds,
          specifications: specs,
          nakedDimensions: nakedMm,
          boxDimensions: boxMm,
          defaultDeliveryMode: deliveryMode,
          defaultCreationMode: creationMode,
          unitOfMeasurement: unit,
          baseSellingRate,
          grossMarginTargetPct: marginTarget,
          leadTimeDays,
          moq,
          thumbnail: imagePreview,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { n: 1, title: 'Identity' },
    { n: 2, title: 'Specifications' },
    { n: 3, title: 'Dimensions' },
    { n: 4, title: 'Pricing & Logistics' },
    { n: 5, title: 'Images & Confirm' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-gray-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-orange-600 mb-0.5">
              <span>Step {currentStep} of 5</span>
              <span>·</span>
              <span>{steps[currentStep - 1].title}</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#1A1A1A] tracking-tight">
              Create New Master Product
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Stepper Strip */}
        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0">
          {steps.map((st) => (
            <div key={st.n} className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  currentStep === st.n
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : currentStep > st.n
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {currentStep > st.n ? <Check size={12} /> : st.n}
              </div>
              <span className={`text-[11px] font-bold hidden sm:inline ${currentStep === st.n ? 'text-[#1A1A1A]' : 'text-gray-400'}`}>
                {st.title}
              </span>
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Step Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* STEP 1: IDENTITY */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Segment *</label>
                  <select
                    value={selectedSegmentId}
                    onChange={(e) => {
                      setSelectedSegmentId(e.target.value);
                      const s = segments.find((seg) => seg.id === e.target.value);
                      if (s?.categories?.length > 0) {
                        setSelectedCategoryId(s.categories[0].id);
                        if (s.categories[0].subCategories?.length > 0) {
                          setSelectedSubCategoryId(s.categories[0].subCategories[0].id);
                        }
                      }
                    }}
                    className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-orange-500"
                  >
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Category *</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => {
                      setSelectedCategoryId(e.target.value);
                      const c = activeCategories.find((cat: any) => cat.id === e.target.value);
                      if (c?.subCategories?.length > 0) {
                        setSelectedSubCategoryId(c.subCategories[0].id);
                      }
                    }}
                    className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-orange-500"
                  >
                    {activeCategories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Sub-Category *</label>
                  <select
                    value={selectedSubCategoryId}
                    onChange={(e) => setSelectedSubCategoryId(e.target.value)}
                    className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-orange-500"
                  >
                    {activeSubCategories.map((sc: any) => (
                      <option key={sc.id} value={sc.id}>{sc.name} ({sc.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amber Oak 3-Drawer Mobile Pedestal"
                  className="w-full h-11 px-3 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              {/* Live Previewed Code */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Generated Product Code</span>
                  <span className="text-xs font-mono font-bold text-gray-900">{code || '–'}</span>
                </div>
                {isCodeAvailable === true && (
                  <span className="text-[11px] font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Check size={12} /> Available
                  </span>
                )}
                {isCodeAvailable === false && (
                  <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
                    Collision with &quot;{codeConflict}&quot;
                  </span>
                )}
              </div>

              {/* Production Departments */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                  Production Departments * (Assign which shops handle this unit)
                </label>
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => {
                    const isSelected = selectedDeptIds.includes(dept.id);
                    return (
                      <button
                        type="button"
                        key={dept.id}
                        onClick={() => handleDeptToggle(dept.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1A1A1A] text-white shadow-xs'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {dept.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SPECIFICATIONS */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Product Specifications</span>
                <button
                  type="button"
                  onClick={() => setSpecs([...specs, { key: '', kind: 'fixed', value: '' }])}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Add Parameter
                </button>
              </div>

              {specs.map((sp, idx) => (
                <div key={idx} className="p-3 border border-gray-200 rounded-xl flex flex-col gap-2 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Parameter (e.g. Carcass, Finish)"
                      value={sp.key}
                      onChange={(e) => {
                        const copy = [...specs];
                        copy[idx].key = e.target.value;
                        setSpecs(copy);
                      }}
                      className="flex-1 h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-white"
                    />
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const copy = [...specs];
                          copy[idx].kind = 'fixed';
                          setSpecs(copy);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-bold ${
                          sp.kind === 'fixed' ? 'bg-[#1A1A1A] text-white' : 'bg-white text-gray-600'
                        }`}
                      >
                        Fixed
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const copy = [...specs];
                          copy[idx].kind = 'customizable';
                          if (!copy[idx].catalogueId && catalogues.length > 0) copy[idx].catalogueId = catalogues[0].id;
                          setSpecs(copy);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-bold ${
                          sp.kind === 'customizable' ? 'bg-orange-600 text-white' : 'bg-white text-gray-600'
                        }`}
                      >
                        Customizable
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSpecs(specs.filter((_, i) => i !== idx))}
                      className="p-1.5 text-gray-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {sp.kind === 'fixed' ? (
                    <input
                      type="text"
                      placeholder="Fixed value (e.g. 18mm Prelam Action TESA Board)"
                      value={sp.value}
                      onChange={(e) => {
                        const copy = [...specs];
                        copy[idx].value = e.target.value;
                        setSpecs(copy);
                      }}
                      className="w-full h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-white"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500">From Catalogue:</span>
                      <select
                        value={sp.catalogueId || ''}
                        onChange={(e) => {
                          const copy = [...specs];
                          copy[idx].catalogueId = e.target.value;
                          setSpecs(copy);
                        }}
                        className="flex-1 h-9 px-2 border border-gray-200 rounded-lg text-xs bg-white"
                      >
                        {catalogues.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* STEP 3: DIMENSIONS */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs font-bold text-gray-800 block mb-2">
                  Naked Dimensions (L B H mm) *
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-0.5">Length (L)</label>
                    <input
                      type="number"
                      value={nakedMm.l}
                      onChange={(e) => setNakedMm({ ...nakedMm, l: Number(e.target.value) })}
                      className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-0.5">Breadth / Depth (B)</label>
                    <input
                      type="number"
                      value={nakedMm.w}
                      onChange={(e) => setNakedMm({ ...nakedMm, w: Number(e.target.value) })}
                      className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-0.5">Height (H)</label>
                    <input
                      type="number"
                      value={nakedMm.h}
                      onChange={(e) => setNakedMm({ ...nakedMm, h: Number(e.target.value) })}
                      className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
                {nakedInches && (
                  <span className="text-[11px] text-gray-500 font-mono block mt-1">
                    Auto inches: {nakedInches.l}″ × {nakedInches.w}″ × {nakedInches.h}″
                  </span>
                )}
              </div>

              <div>
                <span className="text-xs font-bold text-gray-800 block mb-2">
                  Box / Shipping Dimensions (L B H mm) *
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-0.5">Box Length (L)</label>
                    <input
                      type="number"
                      value={boxMm.l}
                      onChange={(e) => setBoxMm({ ...boxMm, l: Number(e.target.value) })}
                      className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-0.5">Box Breadth (B)</label>
                    <input
                      type="number"
                      value={boxMm.w}
                      onChange={(e) => setBoxMm({ ...boxMm, w: Number(e.target.value) })}
                      className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-0.5">Box Height (H)</label>
                    <input
                      type="number"
                      value={boxMm.h}
                      onChange={(e) => setBoxMm({ ...boxMm, h: Number(e.target.value) })}
                      className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* CBM Box */}
              <div className="p-3 bg-orange-50/60 border border-orange-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-orange-900 tracking-wider block">
                    Calculated Shipping Volume (CBM)
                  </span>
                  <span className="text-xs font-mono font-bold text-orange-950">
                    {cbm !== null ? `${cbm} m³` : '–'}
                  </span>
                </div>
                <span className="text-[10px] text-orange-700">Derived from Box mm</span>
              </div>
            </div>
          )}

          {/* STEP 4: PRICING & LOGISTICS */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Base Selling Rate (₹) *</label>
                  <input
                    type="number"
                    value={baseSellingRate}
                    onChange={(e) => setBaseSellingRate(Number(e.target.value))}
                    className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Gross Margin Target (%)</label>
                  <input
                    type="number"
                    value={marginTarget}
                    onChange={(e) => setMarginTarget(Number(e.target.value))}
                    className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Delivery Mode Pills */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Default Delivery Mode</label>
                <div className="flex gap-2">
                  {DELIVERY_MODES.map((dm) => (
                    <button
                      type="button"
                      key={dm}
                      onClick={() => setDeliveryMode(dm)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        deliveryMode === dm ? 'bg-[#1A1A1A] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {dm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Creation Mode Pills */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Default Creation Mode</label>
                <div className="flex gap-2">
                  {CREATION_MODES.map((cm) => (
                    <button
                      type="button"
                      key={cm}
                      onClick={() => setCreationMode(cm)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        creationMode === cm ? 'bg-[#1A1A1A] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unit of Measurement Pills */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Unit of Measurement</label>
                <div className="flex gap-2">
                  {UNITS.map((u) => (
                    <button
                      type="button"
                      key={u}
                      onClick={() => setUnit(u)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        unit === u ? 'bg-[#1A1A1A] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Standard Lead Time (Days)</label>
                  <input
                    type="number"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                    className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Minimum Order Qty (MOQ)</label>
                  <input
                    type="number"
                    value={moq}
                    onChange={(e) => setMoq(Number(e.target.value))}
                    className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: IMAGES & CONFIRM */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs font-bold text-gray-800 block mb-1.5">Primary Product Image</span>
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-2 hover:border-orange-500 transition-colors cursor-pointer bg-gray-50/50">
                  {imagePreview ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-xl border border-gray-200 shadow-xs" />
                      <button
                        type="button"
                        onClick={() => setImagePreview(null)}
                        className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="text-gray-400" />
                      <div className="text-xs font-semibold text-gray-700">Click to upload or drag photo</div>
                      <div className="text-[10px] text-gray-400">PNG, JPG, WEBP up to 5MB</div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setImagePreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                        id="image-file-input"
                      />
                      <label
                        htmlFor="image-file-input"
                        className="mt-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 cursor-pointer shadow-xs"
                      >
                        Select Image
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Review Summary */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col gap-2">
                <span className="text-xs font-extrabold uppercase text-gray-900 tracking-wider">Review Summary</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-400">Code:</span> <span className="font-mono font-bold text-gray-900">{code}</span></div>
                  <div><span className="text-gray-400">Rate:</span> <span className="font-bold text-gray-900">₹{baseSellingRate}</span></div>
                  <div><span className="text-gray-400">Delivery:</span> <span className="font-medium text-gray-800">{deliveryMode}</span></div>
                  <div><span className="text-gray-400">CBM:</span> <span className="font-mono text-gray-800">{cbm || 0} m³</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(currentStep - 1)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-white disabled:opacity-30 cursor-pointer"
          >
            Back
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              disabled={
                (currentStep === 1 && (!name.trim() || selectedDeptIds.length === 0 || isCodeAvailable === false))
              }
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              <span>Next Step</span>
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{isSubmitting ? 'Creating Product...' : 'Save & Finish'}</span>
              <Check size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
