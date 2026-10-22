'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FolderTree,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Package,
  Layers,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import Image from 'next/image';

export interface SelectedNodeInfo {
  type: 'segment' | 'category' | 'subcategory';
  id: string;
  name: string;
  code: string | null;
  segmentId?: string | null;
  segmentName?: string;
  categoryId?: string | null;
  categoryName?: string;
  // Child / Downstream references
  categoriesCount?: number;
  subCategoriesCount?: number;
  masterProductsCount?: number;
  categoriesList?: Array<{ id: string; name: string; code: string | null; subCount: number }>;
  subCategoriesList?: Array<{ id: string; name: string; code: string; productCount: number }>;
  masterProductsList?: Array<{
    id: string;
    name: string;
    code: string;
    baseSellingRate: number;
    thumbnail: string | null;
    variantsCount: number;
  }>;
}

interface HierarchyInspectorProps {
  selectedNode: SelectedNodeInfo | null;
  onNavigateToNode: (type: 'segment' | 'category' | 'subcategory', id: string) => void;
  onOpenAddModal: (type: 'segment' | 'category' | 'subcategory', parentId?: string, parentName?: string) => void;
  onUpdateNode: (type: 'segment' | 'category' | 'subcategory', id: string, name: string, code?: string) => Promise<void>;
  onDeleteNode: (type: 'segment' | 'category' | 'subcategory', id: string, name: string) => Promise<void>;
}

export function HierarchyInspector({
  selectedNode,
  onNavigateToNode,
  onOpenAddModal,
  onUpdateNode,
  onDeleteNode,
}: HierarchyInspectorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedNode) {
      setEditName(selectedNode.name);
      setEditCode(selectedNode.code || '');
      setIsEditing(false);
      setError(null);
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-10 flex flex-col items-center justify-center text-center h-full min-h-[460px]">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#FF7700] flex items-center justify-center mb-4">
          <FolderTree size={28} />
        </div>
        <h3 className="text-base font-bold text-gray-900">Select a Hierarchy Node</h3>
        <p className="text-xs text-gray-500 max-w-sm mt-1 leading-relaxed">
          Click any Segment, Category, or Sub-Category in the taxonomy tree to inspect its configuration, child lines, and downstream products.
        </p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onUpdateNode(
        selectedNode.type,
        selectedNode.id,
        editName.trim(),
        editCode.trim() ? editCode.trim().toUpperCase() : undefined
      );
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  // Blocker calculations for delete guard
  const canDelete =
    selectedNode.type === 'segment'
      ? (selectedNode.categoriesCount || 0) === 0
      : selectedNode.type === 'category'
      ? (selectedNode.subCategoriesCount || 0) === 0 && (selectedNode.masterProductsCount || 0) === 0
      : (selectedNode.masterProductsCount || 0) === 0;

  let blockerMessage = '';
  if (!canDelete) {
    if (selectedNode.type === 'segment') {
      blockerMessage = `Cannot delete: ${selectedNode.categoriesCount} categories still reference this segment. Reassign or delete them first.`;
    } else if (selectedNode.type === 'category') {
      const parts = [];
      if ((selectedNode.subCategoriesCount || 0) > 0) parts.push(`${selectedNode.subCategoriesCount} sub-categories`);
      if ((selectedNode.masterProductsCount || 0) > 0) parts.push(`${selectedNode.masterProductsCount} master products`);
      blockerMessage = `Cannot delete: ${parts.join(' and ')} still reference this category. Reassign or delete them first.`;
    } else {
      blockerMessage = `Cannot delete: ${selectedNode.masterProductsCount} master products still reference this sub-category. Delete or reassign them first.`;
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col overflow-hidden h-full">
      {/* Top Breadcrumb Trail */}
      <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center gap-1.5 text-xs text-gray-500 overflow-x-auto">
        <span className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Taxonomy</span>
        <ChevronRight size={12} className="text-gray-300 shrink-0" />

        {selectedNode.type === 'segment' && (
          <span className="font-bold text-gray-900 truncate">{selectedNode.name}</span>
        )}

        {selectedNode.type === 'category' && (
          <>
            {selectedNode.segmentId && (
              <button
                type="button"
                onClick={() => onNavigateToNode('segment', selectedNode.segmentId!)}
                className="hover:text-[#FF7700] hover:underline font-medium truncate cursor-pointer"
              >
                {selectedNode.segmentName || 'Segment'}
              </button>
            )}
            <ChevronRight size={12} className="text-gray-300 shrink-0" />
            <span className="font-bold text-gray-900 truncate">{selectedNode.name}</span>
          </>
        )}

        {selectedNode.type === 'subcategory' && (
          <>
            {selectedNode.segmentId && (
              <button
                type="button"
                onClick={() => onNavigateToNode('segment', selectedNode.segmentId!)}
                className="hover:text-[#FF7700] hover:underline font-medium truncate cursor-pointer"
              >
                {selectedNode.segmentName || 'Segment'}
              </button>
            )}
            <ChevronRight size={12} className="text-gray-300 shrink-0" />
            {selectedNode.categoryId && (
              <button
                type="button"
                onClick={() => onNavigateToNode('category', selectedNode.categoryId!)}
                className="hover:text-[#FF7700] hover:underline font-medium truncate cursor-pointer"
              >
                {selectedNode.categoryName || 'Category'}
              </button>
            )}
            <ChevronRight size={12} className="text-gray-300 shrink-0" />
            <span className="font-bold text-gray-900 truncate">{selectedNode.name}</span>
          </>
        )}
      </div>

      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {/* Error Notification */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
            <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Node Header & Code Bar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  selectedNode.type === 'segment'
                    ? 'bg-orange-100 text-[#FF7700]'
                    : selectedNode.type === 'category'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                Level: {selectedNode.type === 'subcategory' ? 'Sub-Category' : selectedNode.type}
              </span>

              {selectedNode.code && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-mono text-xs font-bold border border-gray-200">
                  {selectedNode.code}
                </span>
              )}
            </div>

            {!isEditing ? (
              <h2 className="text-xl font-black text-gray-900 tracking-tight leading-snug">
                {selectedNode.name}
              </h2>
            ) : (
              <form onSubmit={handleSave} className="mt-2 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Name"
                    className="h-9 px-3 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-2 focus:ring-[#FF7700] focus:outline-none"
                  />
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    placeholder="Code"
                    maxLength={8}
                    className="h-9 w-24 px-3 border border-gray-300 rounded-lg text-xs font-mono uppercase font-bold text-gray-900 focus:ring-2 focus:ring-[#FF7700] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 h-9 px-3 bg-[#000000] text-white rounded-lg text-xs font-bold hover:bg-gray-800 cursor-pointer disabled:opacity-50"
                  >
                    <Check size={13} />
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(selectedNode.name);
                      setEditCode(selectedNode.code || '');
                    }}
                    className="h-9 px-3 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer shrink-0"
            >
              <Pencil size={13} />
              <span>Edit Details</span>
            </button>
          )}
        </div>

        {/* Quick Facts Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50/70 rounded-xl border border-gray-100">
          {selectedNode.type === 'segment' && (
            <>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Categories
                </span>
                <span className="text-lg font-black text-gray-900">
                  {selectedNode.categoriesCount ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Sub-Categories
                </span>
                <span className="text-lg font-black text-gray-900">
                  {selectedNode.subCategoriesCount ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Master Products
                </span>
                <span className="text-lg font-black text-gray-900">
                  {selectedNode.masterProductsCount ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Taxonomy Code
                </span>
                <span className="text-sm font-mono font-bold text-[#FF7700] mt-1 block">
                  {selectedNode.code || 'None'}
                </span>
              </div>
            </>
          )}

          {selectedNode.type === 'category' && (
            <>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Sub-Categories
                </span>
                <span className="text-lg font-black text-gray-900">
                  {selectedNode.subCategoriesCount ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Master Products
                </span>
                <span className="text-lg font-black text-gray-900">
                  {selectedNode.masterProductsCount ?? 0}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Parent Segment
                </span>
                <span className="text-xs font-bold text-gray-800 truncate block mt-0.5">
                  {selectedNode.segmentName || 'Unassigned'}
                </span>
              </div>
            </>
          )}

          {selectedNode.type === 'subcategory' && (
            <>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Master Products
                </span>
                <span className="text-lg font-black text-gray-900">
                  {selectedNode.masterProductsCount ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Sub-Category Code
                </span>
                <span className="text-sm font-mono font-bold text-[#FF7700] mt-1 block">
                  {selectedNode.code || 'None'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Parent Category
                </span>
                <span className="text-xs font-bold text-gray-800 truncate block mt-0.5">
                  {selectedNode.categoryName || 'Unassigned'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Downstream Child Sections */}
        {selectedNode.type === 'segment' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Categories in this Segment ({selectedNode.categoriesList?.length || 0})
              </h4>
              <button
                type="button"
                onClick={() => onOpenAddModal('category', selectedNode.id, selectedNode.name)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FF7700] hover:bg-[#e06900] text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>Add Category</span>
              </button>
            </div>

            {selectedNode.categoriesList && selectedNode.categoriesList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedNode.categoriesList.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => onNavigateToNode('category', cat.id)}
                    className="p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-xs text-gray-900 truncate">{cat.name}</div>
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {cat.code} · {cat.subCount} sub-categories
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-gray-200 rounded-xl">
                <Layers size={22} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-500 font-medium">No categories added yet to this segment.</p>
                <button
                  type="button"
                  onClick={() => onOpenAddModal('category', selectedNode.id, selectedNode.name)}
                  className="mt-2 text-xs font-bold text-[#FF7700] hover:underline cursor-pointer"
                >
                  + Add first category
                </button>
              </div>
            )}
          </div>
        )}

        {selectedNode.type === 'category' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Sub-Categories in this Category ({selectedNode.subCategoriesList?.length || 0})
              </h4>
              <button
                type="button"
                onClick={() => onOpenAddModal('subcategory', selectedNode.id, selectedNode.name)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FF7700] hover:bg-[#e06900] text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>Add Sub-Category</span>
              </button>
            </div>

            {selectedNode.subCategoriesList && selectedNode.subCategoriesList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedNode.subCategoriesList.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => onNavigateToNode('subcategory', sub.id)}
                    className="p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-xs text-gray-900 truncate">{sub.name}</div>
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {sub.code} · {sub.productCount} master products
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-gray-200 rounded-xl">
                <Layers size={22} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-500 font-medium">No sub-categories added yet to this category.</p>
                <button
                  type="button"
                  onClick={() => onOpenAddModal('subcategory', selectedNode.id, selectedNode.name)}
                  className="mt-2 text-xs font-bold text-[#FF7700] hover:underline cursor-pointer"
                >
                  + Add first sub-category
                </button>
              </div>
            )}
          </div>
        )}

        {selectedNode.type === 'subcategory' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Master Products in this Sub-Category ({selectedNode.masterProductsCount || 0})
              </h4>
              <Link
                href={`/products?subCategoryId=${selectedNode.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>View in Catalog</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {selectedNode.masterProductsList && selectedNode.masterProductsList.length > 0 ? (
              <div className="space-y-2">
                {selectedNode.masterProductsList.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {prod.thumbnail ? (
                        <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden relative shrink-0 bg-white">
                          <Image src={prod.thumbnail} alt={prod.name} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-200/80 flex items-center justify-center shrink-0 text-gray-400">
                          <Package size={18} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-gray-900 truncate">{prod.name}</div>
                        <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                          {prod.code} · {prod.variantsCount} variants
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-gray-900">
                        ₹{prod.baseSellingRate.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-gray-400 block">Base Rate</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-gray-200 rounded-xl">
                <Package size={22} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-500 font-medium">No master products created under this sub-category.</p>
                <Link
                  href="/products"
                  className="mt-2 inline-block text-xs font-bold text-[#FF7700] hover:underline cursor-pointer"
                >
                  Go to Products Catalog to create one
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Delete Guard Card */}
        <div className="pt-6 border-t border-gray-100">
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              canDelete
                ? 'bg-red-50/40 border-red-200/60'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert size={15} className={canDelete ? 'text-red-600' : 'text-gray-400'} />
                <span className="text-xs font-bold text-gray-900">Delete Protection</span>
              </div>
              <p className="text-xs mt-1 text-gray-600">
                {canDelete
                  ? `This ${selectedNode.type} has no child records and can be safely deleted.`
                  : blockerMessage}
              </p>
            </div>

            <button
              type="button"
              disabled={!canDelete}
              onClick={() => onDeleteNode(selectedNode.type, selectedNode.id, selectedNode.name)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                canDelete
                  ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-xs'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
              }`}
            >
              <Trash2 size={13} />
              <span>Delete {selectedNode.type}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
