'use client';

import React from 'react';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { SegmentData } from './HierarchyTreeExplorer';

interface HierarchyColumnBrowserProps {
  segments: SegmentData[];
  selectedSegmentId: string | null;
  selectedCategoryId: string | null;
  onSelectSegment: (id: string) => void;
  onSelectCategory: (id: string) => void;
  onOpenAddModal: (type: 'segment' | 'category' | 'subcategory', parentId?: string, parentName?: string) => void;
  onEditItem: (type: 'segment' | 'category' | 'subcategory', id: string, name: string, code: string) => void;
  onDeleteItem: (type: 'segment' | 'category' | 'subcategory', id: string, name: string) => void;
}

export function HierarchyColumnBrowser({
  segments,
  selectedSegmentId,
  selectedCategoryId,
  onSelectSegment,
  onSelectCategory,
  onOpenAddModal,
  onEditItem,
  onDeleteItem,
}: HierarchyColumnBrowserProps) {
  const activeSegment = segments.find((s) => s.id === selectedSegmentId);
  const activeCategories = activeSegment ? activeSegment.categories : [];
  const activeCategory = activeCategories.find((c) => c.id === selectedCategoryId);
  const activeSubCategories = activeCategory ? activeCategory.subCategories : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {/* Column 1: Segments */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col overflow-hidden min-h-[440px]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">
              1. Segments
            </span>
            <span className="text-[11px] text-gray-400 mt-0.5 block">{segments.length} total</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenAddModal('segment')}
            className="inline-flex items-center gap-1 px-3 py-1 bg-[#FF7700] hover:bg-[#e06900] text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        </div>

        <div className="p-2 flex flex-col gap-1 overflow-y-auto max-h-[640px] flex-1">
          {segments.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">No segments yet.</div>
          ) : (
            segments.map((seg) => {
              const isSelected = seg.id === selectedSegmentId;
              const canDelete = seg.categories.length === 0;

              return (
                <div
                  key={seg.id}
                  onClick={() => onSelectSegment(seg.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all select-none ${
                    isSelected
                      ? 'bg-[#000000] border-[#000000] text-white shadow-xs'
                      : 'bg-white border-gray-100 text-gray-800 hover:bg-[#F4F1EC] hover:border-gray-200'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs truncate leading-snug">{seg.name}</div>
                    <div
                      className={`text-[10px] font-mono mt-0.5 ${
                        isSelected ? 'text-gray-300' : 'text-gray-400'
                      }`}
                    >
                      {seg.code} · {seg.categories.length} categories
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditItem('segment', seg.id, seg.name, seg.code);
                      }}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isSelected
                          ? 'text-white/80 hover:text-white hover:bg-white/20'
                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canDelete) onDeleteItem('segment', seg.id, seg.name);
                      }}
                      title={canDelete ? 'Delete' : `Cannot delete: ${seg.categories.length} categories reference this`}
                      className={`p-1.5 rounded-lg transition-colors ${
                        !canDelete
                          ? 'opacity-25 cursor-not-allowed text-gray-400'
                          : isSelected
                          ? 'text-red-300 hover:bg-red-950/60 cursor-pointer'
                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                      }`}
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

      {/* Column 2: Categories */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col overflow-hidden min-h-[440px]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">
              2. Categories
            </span>
            <span className="text-[11px] text-gray-400 mt-0.5 block">
              {activeSegment ? `Under ${activeSegment.name}` : 'Select a segment first'}
            </span>
          </div>
          <button
            type="button"
            disabled={!selectedSegmentId}
            onClick={() => onOpenAddModal('category', activeSegment?.id, activeSegment?.name)}
            className="inline-flex items-center gap-1 px-3 py-1 bg-[#FF7700] hover:bg-[#e06900] text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        </div>

        <div className="p-2 flex flex-col gap-1 overflow-y-auto max-h-[640px] flex-1">
          {!selectedSegmentId ? (
            <div className="p-8 text-center text-xs text-gray-400">Select a segment to view categories.</div>
          ) : activeCategories.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">No categories in this segment.</div>
          ) : (
            activeCategories.map((cat) => {
              const isSelected = cat.id === selectedCategoryId;
              const canDelete = cat.subCategories.length === 0 && (cat._count?.masterProducts || 0) === 0;

              return (
                <div
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all select-none ${
                    isSelected
                      ? 'bg-[#000000] border-[#000000] text-white shadow-xs'
                      : 'bg-white border-gray-100 text-gray-800 hover:bg-[#F4F1EC] hover:border-gray-200'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs truncate leading-snug">{cat.name}</div>
                    <div
                      className={`text-[10px] font-mono mt-0.5 ${
                        isSelected ? 'text-gray-300' : 'text-gray-400'
                      }`}
                    >
                      {cat.code} · {cat.subCategories.length} sub-categories
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditItem('category', cat.id, cat.name, cat.code || '');
                      }}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isSelected
                          ? 'text-white/80 hover:text-white hover:bg-white/20'
                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canDelete) onDeleteItem('category', cat.id, cat.name);
                      }}
                      title={canDelete ? 'Delete' : 'Cannot delete: sub-categories still reference this'}
                      className={`p-1.5 rounded-lg transition-colors ${
                        !canDelete
                          ? 'opacity-25 cursor-not-allowed text-gray-400'
                          : isSelected
                          ? 'text-red-300 hover:bg-red-950/60 cursor-pointer'
                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                      }`}
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

      {/* Column 3: Sub-Categories */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col overflow-hidden min-h-[440px]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">
              3. Sub-Categories
            </span>
            <span className="text-[11px] text-gray-400 mt-0.5 block">
              {activeCategory ? `Under ${activeCategory.name}` : 'Select a category first'}
            </span>
          </div>
          <button
            type="button"
            disabled={!selectedCategoryId}
            onClick={() => onOpenAddModal('subcategory', activeCategory?.id, activeCategory?.name)}
            className="inline-flex items-center gap-1 px-3 py-1 bg-[#FF7700] hover:bg-[#e06900] text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        </div>

        <div className="p-2 flex flex-col gap-1 overflow-y-auto max-h-[640px] flex-1">
          {!selectedCategoryId ? (
            <div className="p-8 text-center text-xs text-gray-400">Select a category to view sub-categories.</div>
          ) : activeSubCategories.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">No sub-categories in this category.</div>
          ) : (
            activeSubCategories.map((sub) => {
              const prodCount = sub._count?.masterProducts || 0;
              const canDelete = prodCount === 0;

              return (
                <div
                  key={sub.id}
                  className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-[#F4F1EC] flex items-center justify-between transition-all select-none bg-white"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs text-gray-900 truncate leading-snug">{sub.name}</div>
                    <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                      {sub.code} · {prodCount} master products
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditItem('subcategory', sub.id, sub.name, sub.code)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={() => {
                        if (canDelete) onDeleteItem('subcategory', sub.id, sub.name);
                      }}
                      title={canDelete ? 'Delete' : `Cannot delete: ${prodCount} products still reference this`}
                      className={`p-1.5 rounded-lg transition-colors ${
                        !canDelete
                          ? 'opacity-25 cursor-not-allowed text-gray-400'
                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                      }`}
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
    </div>
  );
}
