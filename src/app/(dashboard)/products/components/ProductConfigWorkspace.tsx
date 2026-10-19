'use client';

import { useState, useEffect } from 'react';
import { X, Check, AlertCircle, ArrowLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react';

interface ProductConfigWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  entityType: 'master-products' | 'variants';
  initialStep?: string;
}

export default function ProductConfigWorkspace({
  isOpen,
  onClose,
  entityId,
  entityType,
  initialStep = 'process',
}: ProductConfigWorkspaceProps) {
  const [currentStep, setCurrentStep] = useState<string>(initialStep);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [entity, setEntity] = useState<any>(null);

  // Configuration state buffers
  const [processChart, setProcessChart] = useState<Record<string, string[]>>({});
  const [assemblyParts, setAssemblyParts] = useState<any[]>([]);
  const [packingBoxes, setPackingBoxes] = useState<any[]>([]);
  const [costing, setCosting] = useState<any>({
    materialCost: 0,
    labourCost: 800,
    energyCost: 150,
    overheadsPct: 10,
    commissionPct: 5,
  });

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/products/config?entityType=${entityType}&id=${entityId}`);
      const data = await res.json();
      if (data.ok) {
        setEntity(data.entity);
        setProcessChart(data.entity.processChart || {});
        setAssemblyParts(data.entity.bom?.sections?.assembly?.parts || []);
        setPackingBoxes(data.entity.packingList?.boxes || []);
        if (data.entity.costing) setCosting(data.entity.costing);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      if (initialStep) setCurrentStep(initialStep);
    }
  }, [isOpen, entityId, entityType]);

  if (!isOpen) return null;

  const isVariant = entityType === 'variants';

  const steps = [
    { key: 'process', n: 1, label: 'Process Chart', hint: 'Department sequences' },
    { key: 'bom', n: 2, label: 'Bill of Materials', hint: 'Assembly parts & materials' },
    { key: 'mapping', n: 3, label: 'Part Mapping', hint: 'Material allocations' },
    { key: 'packing', n: 4, label: 'Packing List', hint: 'Boxes & shipments' },
    ...(isVariant ? [{ key: 'costing', n: 5, label: 'Costing', hint: 'Margin & pricing' }] : []),
  ];

  const handleSaveCurrentStep = async () => {
    try {
      setSaving(true);
      setError(null);

      let payloadData: any = null;
      if (currentStep === 'process') {
        payloadData = processChart;
      } else if (currentStep === 'bom') {
        payloadData = {
          configured: assemblyParts.length > 0,
          sections: {
            assembly: { parts: assemblyParts },
          },
        };
      } else if (currentStep === 'packing') {
        payloadData = {
          configured: packingBoxes.length > 0,
          boxes: packingBoxes,
        };
      } else if (currentStep === 'costing') {
        const mat = Number(costing.materialCost) || 0;
        const lab = Number(costing.labourCost) || 0;
        const eng = Number(costing.energyCost) || 0;
        const ovh = (mat + lab + eng) * ((Number(costing.overheadsPct) || 0) / 100);
        const com = (entity?.baseSellingRate || 0) * ((Number(costing.commissionPct) || 0) / 100);
        const total = Math.round(mat + lab + eng + ovh + com);
        const margin = entity?.baseSellingRate
          ? Math.round(((entity.baseSellingRate - total) / entity.baseSellingRate) * 1000) / 10
          : 0;

        payloadData = {
          ...costing,
          totalCost: total,
          marginPct: margin,
        };
      }

      if (payloadData !== null) {
        const res = await fetch('/api/products/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType,
            id: entityId,
            step: currentStep === 'mapping' ? 'bom' : currentStep,
            data: payloadData,
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error);
          return;
        }
      }

      setSuccessToast('Step saved successfully');
      setTimeout(() => setSuccessToast(null), 2500);
      await fetchConfig();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-white flex flex-col overflow-hidden select-none">
      {/* Top Bar */}
      <div className="h-16 border-b border-gray-200 bg-[#1A1A1A] text-white px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Exit Workspace"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                PRODUCT CONFIGURATION WORKSPACE
              </span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full text-white font-mono">
                {isVariant ? 'VARIANT' : 'MASTER'}
              </span>
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{entity?.name || 'Loading...'}</span>
              <span className="text-xs font-mono text-gray-400">({entity?.code})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveCurrentStep}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Save size={15} />
            <span>{saving ? 'Saving...' : 'Save Step'}</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-2.5 flex items-center justify-between overflow-x-auto shrink-0">
        <div className="flex items-center gap-4">
          {steps.map((st) => (
            <button
              key={st.key}
              onClick={() => setCurrentStep(st.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentStep === st.key
                  ? 'bg-[#1A1A1A] text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-200/60'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                {st.n}
              </span>
              <span>{st.label}</span>
            </button>
          ))}
        </div>

        {successToast && (
          <span className="text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Check size={14} /> {successToast}
          </span>
        )}
      </div>

      {/* Workspace Body */}
      <div className="flex-1 p-6 sm:p-8 overflow-y-auto bg-[#F4F3ED]/30 max-w-6xl w-full mx-auto flex flex-col gap-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-800">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: PROCESS CHART */}
        {currentStep === 'process' && (
          <div className="flex flex-col gap-6">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">1. Department Process Sequences</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Configure the ordered shop-floor manufacturing operations for each assigned production department.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {entity?.departments?.map((dept: any) => {
                const seq = processChart[dept.id] || [];
                return (
                  <div key={dept.id} className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="font-extrabold text-xs text-gray-900 uppercase tracking-wide">
                        {dept.name}
                      </span>
                      <button
                        onClick={() => {
                          const op = prompt('Enter new operation name:');
                          if (op && op.trim()) {
                            setProcessChart({
                              ...processChart,
                              [dept.id]: [...seq, op.trim()],
                            });
                          }
                        }}
                        className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} /> Add Step
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5 min-h-[140px]">
                      {seq.length === 0 ? (
                        <div className="p-8 text-center text-xs text-gray-400">
                          No operations added. Click &quot;Add Step&quot; above.
                        </div>
                      ) : (
                        seq.map((stepName, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-gray-200 font-bold text-[10px] flex items-center justify-center text-gray-600">
                                {sIdx + 1}
                              </span>
                              <span className="font-bold text-gray-800">{stepName}</span>
                            </div>
                            <button
                              onClick={() => {
                                setProcessChart({
                                  ...processChart,
                                  [dept.id]: seq.filter((_, i) => i !== sIdx),
                                });
                              }}
                              className="text-gray-400 hover:text-red-500 cursor-pointer p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: BILL OF MATERIALS (BOM) */}
        {currentStep === 'bom' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">2. Bill of Materials (Assembly Parts)</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Assembly components, cut-lists, and Semi-Finished Goods definitions.
                </p>
              </div>
              <button
                onClick={() => {
                  const pNum = String(assemblyParts.length + 1).padStart(2, '0');
                  const newCode = `${entity?.code}-P${pNum}`;
                  setAssemblyParts([
                    ...assemblyParts,
                    { code: newCode, name: 'New Component', sourcing: 'in-house', l: 800, w: 400, thk: 18 },
                  ]);
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={15} /> Add Part
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3 pl-4">Part Code</th>
                    <th className="p-3">Component Name</th>
                    <th className="p-3">Dimensions (L B H mm)</th>
                    <th className="p-3">Sourcing</th>
                    <th className="p-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assemblyParts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400">
                        No parts in BOM. Click &quot;Add Part&quot; to begin configuring components.
                      </td>
                    </tr>
                  ) : (
                    assemblyParts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/60">
                        <td className="p-3 pl-4 font-mono font-bold text-gray-900">{p.code}</td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => {
                              const copy = [...assemblyParts];
                              copy[idx].name = e.target.value;
                              setAssemblyParts(copy);
                            }}
                            className="w-full h-8 px-2 border border-gray-200 rounded-lg text-xs"
                          />
                        </td>
                        <td className="p-3 font-mono">
                          {p.l || 0} × {p.w || 0} × {p.thk || 18} mm
                        </td>
                        <td className="p-3">
                          <select
                            value={p.sourcing || 'in-house'}
                            onChange={(e) => {
                              const copy = [...assemblyParts];
                              copy[idx].sourcing = e.target.value;
                              setAssemblyParts(copy);
                            }}
                            className="h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white"
                          >
                            <option value="in-house">In-house</option>
                            <option value="outsourced">Outsourced</option>
                            <option value="both">Both</option>
                          </select>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <button
                            onClick={() => setAssemblyParts(assemblyParts.filter((_, i) => i !== idx))}
                            className="p-1.5 text-gray-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: PART MAPPING */}
        {currentStep === 'mapping' && (
          <div className="flex flex-col gap-6">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">3. Part Mapping</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Map raw material inventory items into their designated assembly components.
              </p>
            </div>
            <div className="p-8 bg-white border border-gray-200 rounded-2xl text-center text-xs text-gray-500">
              {assemblyParts.length} assembly parts currently active. All raw materials linked to standard catalogues are automatically assigned to this BOM layout.
            </div>
          </div>
        )}

        {/* STEP 4: PACKING LIST */}
        {currentStep === 'packing' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">4. Packing List Configuration</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Define box divisions, packed dimensions, and weights for outbound factory logistics.
                </p>
              </div>
              <button
                onClick={() => {
                  const bNum = packingBoxes.length + 1;
                  setPackingBoxes([
                    ...packingBoxes,
                    { name: `Box ${bNum}/${bNum}`, l: 1200, w: 600, h: 200, weightKg: 25 },
                  ]);
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={15} /> Add Box
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {packingBoxes.map((box, bIdx) => (
                <div key={bIdx} className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="font-bold text-xs text-gray-900">{box.name}</span>
                    <button
                      onClick={() => setPackingBoxes(packingBoxes.filter((_, i) => i !== bIdx))}
                      className="text-gray-400 hover:text-red-500 cursor-pointer p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Box Dimensions</span>
                      <span className="font-mono font-bold text-gray-800">
                        {box.l} × {box.w} × {box.h} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Estimated Weight</span>
                      <span className="font-mono font-bold text-gray-800">{box.weightKg} kg</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: COSTING (VARIANT ONLY) */}
        {currentStep === 'costing' && isVariant && (
          <div className="flex flex-col gap-6">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">5. Variant Costing Sheet</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Precision breakdown of materials, labour, energy, factory overheads, and gross margin.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-4 text-xs">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Direct Raw Materials Cost (₹)</label>
                  <input
                    type="number"
                    value={costing.materialCost}
                    onChange={(e) => setCosting({ ...costing, materialCost: Number(e.target.value) })}
                    className="w-full h-10 px-3 border border-gray-200 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Direct Factory Labour (₹)</label>
                  <input
                    type="number"
                    value={costing.labourCost}
                    onChange={(e) => setCosting({ ...costing, labourCost: Number(e.target.value) })}
                    className="w-full h-10 px-3 border border-gray-200 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Energy & Tooling Cost (₹)</label>
                  <input
                    type="number"
                    value={costing.energyCost}
                    onChange={(e) => setCosting({ ...costing, energyCost: Number(e.target.value) })}
                    className="w-full h-10 px-3 border border-gray-200 rounded-xl font-mono font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Overheads (%)</label>
                    <input
                      type="number"
                      value={costing.overheadsPct}
                      onChange={(e) => setCosting({ ...costing, overheadsPct: Number(e.target.value) })}
                      className="w-full h-10 px-3 border border-gray-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Commission (%)</label>
                    <input
                      type="number"
                      value={costing.commissionPct}
                      onChange={(e) => setCosting({ ...costing, commissionPct: Number(e.target.value) })}
                      className="w-full h-10 px-3 border border-gray-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Financial Rollup Summary Card */}
              <div className="p-6 bg-[#1A1A1A] text-white rounded-2xl shadow-xl flex flex-col justify-between gap-6">
                <div>
                  <span className="text-[10px] font-extrabold text-orange-400 uppercase tracking-widest block mb-1">
                    PRODUCTION PROFITABILITY
                  </span>
                  <div className="text-2xl font-black text-white">
                    ₹{Number(entity?.baseSellingRate || 0).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-gray-400">Current Base Selling Rate</span>
                </div>

                <div className="p-4 bg-white/10 rounded-xl border border-white/10 flex flex-col gap-2 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>Direct Prime Cost:</span>
                    <span className="font-mono font-bold text-white">
                      ₹{Number(costing.materialCost) + Number(costing.labourCost) + Number(costing.energyCost)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Factory Overheads:</span>
                    <span className="font-mono text-white">{costing.overheadsPct}%</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-gray-400 block mb-1">Gross Margin Target:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black text-green-400">
                      {entity?.baseSellingRate
                        ? Math.round(
                            ((entity.baseSellingRate -
                              (Number(costing.materialCost) +
                                Number(costing.labourCost) +
                                Number(costing.energyCost))) /
                              entity.baseSellingRate) *
                              100
                          )
                        : 0}
                      %
                    </span>
                    <span className="text-[11px] text-gray-400">Gross Margin</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
