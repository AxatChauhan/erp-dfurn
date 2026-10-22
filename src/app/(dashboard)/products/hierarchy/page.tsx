'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight,
  Plus,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  FolderTree,
  Columns,
  RefreshCw,
} from 'lucide-react';
import {
  HierarchyTreeExplorer,
  SegmentData,
} from './components/HierarchyTreeExplorer';
import { HierarchyColumnBrowser } from './components/HierarchyColumnBrowser';
import { HierarchyAddInlineModal } from './components/HierarchyAddInlineModal';
import { HierarchyInfoPopover } from './components/HierarchyInfoPopover';

export default function ProductHierarchyPage() {
  const [segments, setSegments] = useState<SegmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // View Mode: 'tree' (default 2-pane explorer) vs 'columns' (3-column browser)
  const [viewMode, setViewMode] = useState<'tree' | 'columns'>('tree');

  // Active selection for Tree Explorer & Inspector
  const [selectedNode, setSelectedNode] = useState<{
    type: 'segment' | 'category' | 'subcategory';
    id: string;
  } | null>(null);

  // Selection states for 3-Column Browser
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Add Modal State
  const [addModal, setAddModal] = useState<{
    open: boolean;
    type: 'segment' | 'category' | 'subcategory';
    parentId?: string;
    parentName?: string;
  }>({ open: false, type: 'segment' });

  // Column View Edit Modal State
  const [editingItem, setEditingItem] = useState<{
    type: 'segment' | 'category' | 'subcategory';
    id: string;
    name: string;
    code: string;
  } | null>(null);
  const [editFormName, setEditFormName] = useState('');
  const [editFormCode, setEditFormCode] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Mutation Overlay Loader State (Rule 8: Mutations block screen with overlay loader)
  const [mutationLoading, setMutationLoading] = useState<{
    active: boolean;
    message: string;
  }>({ active: false, message: '' });

  const fetchHierarchy = useCallback(async (preserveSelection = true) => {
    try {
      setLoading(true);
      const res = await fetch('/api/products/hierarchy');
      const data = await res.json();
      if (data.ok) {
        setSegments(data.segments);

        // Auto-select first item if no active selection
        if (data.segments.length > 0) {
          if (!preserveSelection || !selectedNode) {
            setSelectedNode({ type: 'segment', id: data.segments[0].id });
            setSelectedSegmentId(data.segments[0].id);
            if (data.segments[0].categories.length > 0) {
              setSelectedCategoryId(data.segments[0].categories[0].id);
            }
          }
        }
      } else {
        setError(data.error || 'Failed to load product hierarchy');
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading hierarchy');
    } finally {
      setLoading(false);
    }
  }, [selectedNode]);

  useEffect(() => {
    fetchHierarchy(false);
  }, []);

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Node Selection Handler
  const handleSelectNode = (type: 'segment' | 'category' | 'subcategory', id: string) => {
    setSelectedNode({ type, id });
    if (type === 'segment') {
      setSelectedSegmentId(id);
      const seg = segments.find((s) => s.id === id);
      if (seg && seg.categories.length > 0) {
        setSelectedCategoryId(seg.categories[0].id);
      } else {
        setSelectedCategoryId(null);
      }
    } else if (type === 'category') {
      setSelectedCategoryId(id);
      for (const seg of segments) {
        if (seg.categories.some((c) => c.id === id)) {
          setSelectedSegmentId(seg.id);
          break;
        }
      }
    }
  };

  // Open Add Modal
  const handleOpenAddModal = (
    type: 'segment' | 'category' | 'subcategory',
    parentId?: string,
    parentName?: string
  ) => {
    setAddModal({
      open: true,
      type,
      parentId,
      parentName,
    });
  };

  // Node Update Handler (Inspector and Modal)
  const handleUpdateNode = async (
    type: 'segment' | 'category' | 'subcategory',
    id: string,
    name: string,
    code?: string
  ) => {
    try {
      setMutationLoading({ active: true, message: `Updating ${type}...` });
      setError(null);

      const res = await fetch(`/api/products/hierarchy/${type}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to update node');
        return;
      }

      showToast(`Successfully updated ${type}`);
      await fetchHierarchy(true);
      setEditingItem(null);
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setMutationLoading({ active: false, message: '' });
    }
  };

  // Node Delete Handler with Cascade Blocker Evaluation
  const handleDeleteNode = async (
    type: 'segment' | 'category' | 'subcategory',
    id: string,
    name: string
  ) => {
    if (!confirm(`Are you sure you want to delete ${type} "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setMutationLoading({ active: true, message: `Deleting ${type}...` });
      setError(null);

      const res = await fetch(`/api/products/hierarchy/${type}/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to delete node');
        return;
      }

      showToast(`Deleted ${type} "${name}" successfully`);
      setSelectedNode(null);
      await fetchHierarchy(false);
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setMutationLoading({ active: false, message: '' });
    }
  };

  return (
    <div className="p-6 max-w-[1720px] mx-auto min-h-screen bg-[#F4F1EC]/30 flex flex-col gap-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Products</span>
            <ChevronRight size={12} className="text-gray-300" />
            <span className="text-[#FF7700]">Product Hierarchy</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Product Hierarchy
            </h1>
            <HierarchyInfoPopover />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            3-tier master taxonomy (Segment · Category · Sub-Category) with company-wide code collision guards.
          </p>
        </div>

        {/* Header Right Actions: View Toggle + New Segment CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {/* View Mode Pill Toggle (Selected state is strictly Black #000000) */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'tree'
                  ? 'bg-[#000000] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <FolderTree size={14} />
              <span>Tree View</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('columns')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'columns'
                  ? 'bg-[#000000] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Columns size={14} />
              <span>Columns View</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchHierarchy(true)}
            title="Refresh Hierarchy"
            aria-label="Refresh Hierarchy"
            className="p-2.5 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Primary Action: New Segment (D'furn Orange #FF7700) */}
          <button
            type="button"
            onClick={() => handleOpenAddModal('segment')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF7700] hover:bg-[#e06900] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>New Segment</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 p-1 rounded-md transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {successToast && (
        <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-xs text-green-800 animate-in fade-in duration-150">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {/* Main Workspace */}
      {loading && segments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 flex flex-col items-center justify-center min-h-[460px]">
          <Loader2 size={32} className="animate-spin text-[#FF7700] mb-3" />
          <span className="text-xs font-bold text-gray-500">Loading Product Hierarchy...</span>
        </div>
      ) : viewMode === 'tree' ? (
        <HierarchyTreeExplorer
          segments={segments}
          selectedNode={selectedNode}
          onSelectNode={handleSelectNode}
          onOpenAddModal={handleOpenAddModal}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
        />
      ) : (
        <HierarchyColumnBrowser
          segments={segments}
          selectedSegmentId={selectedSegmentId}
          selectedCategoryId={selectedCategoryId}
          onSelectSegment={(id) => {
            setSelectedSegmentId(id);
            const seg = segments.find((s) => s.id === id);
            if (seg && seg.categories.length > 0) {
              setSelectedCategoryId(seg.categories[0].id);
            } else {
              setSelectedCategoryId(null);
            }
          }}
          onSelectCategory={(id) => setSelectedCategoryId(id)}
          onOpenAddModal={handleOpenAddModal}
          onEditItem={(type, id, name, code) => {
            setEditingItem({ type, id, name, code });
            setEditFormName(name);
            setEditFormCode(code);
          }}
          onDeleteItem={handleDeleteNode}
        />
      )}

      {/* Add Inline Modal */}
      <HierarchyAddInlineModal
        open={addModal.open}
        type={addModal.type}
        parentId={addModal.parentId}
        parentName={addModal.parentName}
        onClose={() => setAddModal({ open: false, type: 'segment' })}
        onSuccess={async () => {
          showToast(`Successfully created ${addModal.type}`);
          await fetchHierarchy(true);
        }}
      />

      {/* Column View Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                Edit {editingItem.type}
              </h2>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editFormName.trim()) return;
                setIsUpdating(true);
                await handleUpdateNode(
                  editingItem.type,
                  editingItem.id,
                  editFormName.trim(),
                  editFormCode.trim() ? editFormCode.trim().toUpperCase() : undefined
                );
                setIsUpdating(false);
              }}
              className="mt-4 flex flex-col gap-4"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFormName}
                  onChange={(e) => setEditFormName(e.target.value)}
                  className="w-full h-11 px-3 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#FF7700] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  required
                  value={editFormCode}
                  onChange={(e) => setEditFormCode(e.target.value.toUpperCase())}
                  className="w-full h-11 px-3 border border-gray-200 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-[#FF7700] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  disabled={isUpdating}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#000000] hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isUpdating && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mutation Overlay Loader (Rule 8: Mutations block screen with overlay loader) */}
      {mutationLoading.active && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-2xl border border-gray-200 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-100">
            <Loader2 size={20} className="animate-spin text-[#FF7700]" />
            <span className="text-xs font-bold text-gray-900">
              {mutationLoading.message || 'Saving changes...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
