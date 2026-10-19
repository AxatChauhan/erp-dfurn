'use client';

import { useState, useEffect } from 'react';
import { Layers, Plus, Pencil, Trash2, ChevronRight, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { autoCode } from '@/lib/products/codeGen';

interface SubCategoryItem {
  id: string;
  name: string;
  code: string;
  _count?: { masterProducts: number };
}

interface CategoryItem {
  id: string;
  name: string;
  code: string | null;
  segmentId: string | null;
  subCategories: SubCategoryItem[];
  _count?: { subCategories: number; masterProducts: number };
}

interface SegmentItem {
  id: string;
  name: string;
  code: string;
  categories: CategoryItem[];
  _count?: { categories: number };
}

export default function ProductHierarchyPage() {
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Selection states
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Modal / Inline Edit states
  const [addModal, setAddModal] = useState<{
    open: boolean;
    type: 'segment' | 'category' | 'subcategory';
    parentId?: string;
  }>({ open: false, type: 'segment' });

  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingItem, setEditingItem] = useState<{
    type: 'segment' | 'category' | 'subcategory';
    id: string;
    name: string;
    code: string;
  } | null>(null);

  const fetchHierarchy = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products/hierarchy');
      const data = await res.json();
      if (data.ok) {
        setSegments(data.segments);
        if (data.segments.length > 0 && !selectedSegmentId) {
          setSelectedSegmentId(data.segments[0].id);
          if (data.segments[0].categories.length > 0) {
            setSelectedCategoryId(data.segments[0].categories[0].id);
          }
        }
      } else {
        setError(data.error || 'Failed to load hierarchy');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHierarchy();
  }, []);

  const activeSegment = segments.find((s) => s.id === selectedSegmentId);
  const activeCategories = activeSegment ? activeSegment.categories : [];
  const activeCategory = activeCategories.find((c) => c.id === selectedCategoryId);
  const activeSubCategories = activeCategory ? activeCategory.subCategories : [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch('/api/products/hierarchy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: addModal.type,
          name: formName,
          code: formCode || autoCode(formName),
          parentId: addModal.parentId,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }

      setAddModal({ open: false, type: 'segment' });
      setFormName('');
      setFormCode('');
      setSuccessToast(`Successfully created ${addModal.type}`);
      setTimeout(() => setSuccessToast(null), 3000);
      await fetchHierarchy();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch(`/api/products/hierarchy/${editingItem.type}/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingItem.name,
          code: editingItem.code,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }

      setEditingItem(null);
      setSuccessToast('Updated successfully');
      setTimeout(() => setSuccessToast(null), 3000);
      await fetchHierarchy();
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (type: 'segment' | 'category' | 'subcategory', id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${type} "${name}"?`)) return;

    try {
      setError(null);
      const res = await fetch(`/api/products/hierarchy/${type}/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }
      setSuccessToast(`Deleted ${type} successfully`);
      setTimeout(() => setSuccessToast(null), 3000);
      await fetchHierarchy();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  };

  return (
    <div className="p-6 max-w-[1720px] mx-auto min-h-screen bg-[#F4F3ED]/40 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            <span>Products</span>
            <ChevronRight size={12} />
            <span className="text-orange-600">Product Hierarchy</span>
          </div>
          <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight">Product Hierarchy</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            3-tier master catalog structure: Segment · Category · Sub-Category with company-wide collision guards
          </p>
        </div>

        <button
          onClick={() => {
            setAddModal({ open: true, type: 'segment' });
            setFormName('');
            setFormCode('');
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>New Segment</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {successToast && (
        <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-xs text-green-800">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* 3-Column Hierarchy Browser */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 items-start">
        {/* Column 1: Segments */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-gray-900">1. Segments</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">{segments.length} total</span>
            </div>
          </div>

          <div className="p-2 flex flex-col gap-1 min-h-[360px] max-h-[640px] overflow-y-auto">
            {segments.map((seg) => {
              const isSelected = seg.id === selectedSegmentId;
              return (
                <div
                  key={seg.id}
                  onClick={() => {
                    setSelectedSegmentId(seg.id);
                    if (seg.categories.length > 0) setSelectedCategoryId(seg.categories[0].id);
                    else setSelectedCategoryId(null);
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-xs'
                      : 'bg-white border-gray-100 text-gray-800 hover:bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs truncate leading-snug">{seg.name}</div>
                    <div className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                      {seg.code} · {seg.categories?.length || 0} categories
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem({ type: 'segment', id: seg.id, name: seg.name, code: seg.code });
                      }}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isSelected ? 'hover:bg-white/10 text-gray-200' : 'hover:bg-gray-100 text-gray-500'
                      }`}
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('segment', seg.id, seg.name);
                      }}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isSelected ? 'hover:bg-red-500/20 text-red-300' : 'hover:bg-red-50 text-red-500'
                      }`}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2: Categories (Filtered by selected Segment) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-gray-900">2. Categories</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">
                {activeSegment ? `in ${activeSegment.name}` : 'Select a segment'}
              </span>
            </div>

            {selectedSegmentId && (
              <button
                onClick={() => {
                  setAddModal({ open: true, type: 'category', parentId: selectedSegmentId });
                  setFormName('');
                  setFormCode('');
                }}
                className="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                title="Add Category"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            )}
          </div>

          <div className="p-2 flex flex-col gap-1 min-h-[360px] max-h-[640px] overflow-y-auto">
            {activeCategories.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">No categories in this segment</div>
            ) : (
              activeCategories.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-xs'
                        : 'bg-white border-gray-100 text-gray-800 hover:bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-xs truncate leading-snug">{cat.name}</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                        {cat.code || '–'} · {cat.subCategories?.length || 0} sub-categories
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem({ type: 'category', id: cat.id, name: cat.name, code: cat.code || '' });
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isSelected ? 'hover:bg-white/10 text-gray-200' : 'hover:bg-gray-100 text-gray-500'
                        }`}
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete('category', cat.id, cat.name);
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isSelected ? 'hover:bg-red-500/20 text-red-300' : 'hover:bg-red-50 text-red-500'
                        }`}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Sub-Categories (Filtered by selected Category) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-gray-900">3. Sub-Categories</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">
                {activeCategory ? `in ${activeCategory.name}` : 'Select a category'}
              </span>
            </div>

            {selectedCategoryId && (
              <button
                onClick={() => {
                  setAddModal({ open: true, type: 'subcategory', parentId: selectedCategoryId });
                  setFormName('');
                  setFormCode('');
                }}
                className="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                title="Add Sub-Category"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            )}
          </div>

          <div className="p-2 flex flex-col gap-1 min-h-[360px] max-h-[640px] overflow-y-auto">
            {activeSubCategories.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">No sub-categories in this category</div>
            ) : (
              activeSubCategories.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs text-gray-900 truncate leading-snug">{sub.name}</div>
                    <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                      {sub.code} · {sub._count?.masterProducts || 0} master products
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingItem({ type: 'subcategory', id: sub.id, name: sub.name, code: sub.code })}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete('subcategory', sub.id, sub.name)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {addModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                New {addModal.type === 'segment' ? 'Segment' : addModal.type === 'category' ? 'Category' : 'Sub-Category'}
              </h2>
              <button
                onClick={() => setAddModal({ open: false, type: 'segment' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!formCode || formCode === autoCode(formName)) {
                      setFormCode(autoCode(e.target.value));
                    }
                  }}
                  placeholder="e.g. Workspace Pedestals"
                  className="w-full h-11 px-3 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Code * (Auto-generated 2–3 letters, uppercase)
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PED"
                  className="w-full h-11 px-3 border border-gray-200 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                <span className="text-[10px] text-gray-400 block mt-1">
                  Must be unique. Collisions are blocked with HTTP 409.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAddModal({ open: false, type: 'segment' })}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Edit {editingItem.type}</h2>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full h-11 px-3 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Code *</label>
                <input
                  type="text"
                  required
                  value={editingItem.code}
                  onChange={(e) => setEditingItem({ ...editingItem, code: e.target.value.toUpperCase() })}
                  className="w-full h-11 px-3 border border-gray-200 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
