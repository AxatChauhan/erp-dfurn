'use client';

import React, { useState, useMemo } from 'react';
import { Search, Plus, X, ChevronDown, ChevronRight, Layers, FolderTree } from 'lucide-react';
import { HierarchyTreeNode } from './HierarchyTreeNode';
import { HierarchyInspector, SelectedNodeInfo } from './HierarchyInspector';
import { HierarchyInfoPopover } from './HierarchyInfoPopover';

export interface SubCategoryData {
  id: string;
  name: string;
  code: string;
  categoryId: string;
  _count?: { masterProducts: number };
  masterProducts?: Array<{
    id: string;
    name: string;
    code: string;
    baseSellingRate: number;
    thumbnail: string | null;
    _count?: { variants: number };
  }>;
}

export interface CategoryData {
  id: string;
  name: string;
  code: string | null;
  segmentId: string | null;
  subCategories: SubCategoryData[];
  _count?: { subCategories: number; masterProducts: number };
}

export interface SegmentData {
  id: string;
  name: string;
  code: string;
  categories: CategoryData[];
  _count?: { categories: number };
}

interface HierarchyTreeExplorerProps {
  segments: SegmentData[];
  selectedNode: { type: 'segment' | 'category' | 'subcategory'; id: string } | null;
  onSelectNode: (type: 'segment' | 'category' | 'subcategory', id: string) => void;
  onOpenAddModal: (type: 'segment' | 'category' | 'subcategory', parentId?: string, parentName?: string) => void;
  onUpdateNode: (type: 'segment' | 'category' | 'subcategory', id: string, name: string, code?: string) => Promise<void>;
  onDeleteNode: (type: 'segment' | 'category' | 'subcategory', id: string, name: string) => Promise<void>;
}

export function HierarchyTreeExplorer({
  segments,
  selectedNode,
  onSelectNode,
  onOpenAddModal,
  onUpdateNode,
  onDeleteNode,
}: HierarchyTreeExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Default: expand all segments on initial load
    return new Set(segments.map((s) => s.id));
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    const all = new Set<string>();
    segments.forEach((s) => {
      all.add(s.id);
      s.categories.forEach((c) => all.add(c.id));
    });
    setExpandedIds(all);
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // Filter tree based on search query
  const filteredSegments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return segments;

    return segments
      .map((seg) => {
        const segMatch = seg.name.toLowerCase().includes(q) || seg.code.toLowerCase().includes(q);

        const matchingCats = seg.categories
          .map((cat) => {
            const catMatch =
              cat.name.toLowerCase().includes(q) || (cat.code && cat.code.toLowerCase().includes(q));

            const matchingSubs = cat.subCategories.filter(
              (sub) => sub.name.toLowerCase().includes(q) || sub.code.toLowerCase().includes(q)
            );

            if (catMatch || matchingSubs.length > 0) {
              return {
                ...cat,
                subCategories: catMatch ? cat.subCategories : matchingSubs,
              };
            }
            return null;
          })
          .filter(Boolean) as CategoryData[];

        if (segMatch || matchingCats.length > 0) {
          return {
            ...seg,
            categories: segMatch ? seg.categories : matchingCats,
          };
        }
        return null;
      })
      .filter(Boolean) as SegmentData[];
  }, [segments, searchQuery]);

  // Resolve inspector payload for the selected node
  const selectedNodeInfo = useMemo<SelectedNodeInfo | null>(() => {
    if (!selectedNode) return null;

    if (selectedNode.type === 'segment') {
      const seg = segments.find((s) => s.id === selectedNode.id);
      if (!seg) return null;

      const totalSub = seg.categories.reduce((acc, c) => acc + (c.subCategories?.length || 0), 0);
      const totalPrd = seg.categories.reduce(
        (acc, c) =>
          acc +
          c.subCategories.reduce((subAcc, sc) => subAcc + (sc._count?.masterProducts || 0), 0),
        0
      );

      return {
        type: 'segment',
        id: seg.id,
        name: seg.name,
        code: seg.code,
        categoriesCount: seg.categories.length,
        subCategoriesCount: totalSub,
        masterProductsCount: totalPrd,
        categoriesList: seg.categories.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          subCount: c.subCategories.length,
        })),
      };
    }

    if (selectedNode.type === 'category') {
      for (const seg of segments) {
        const cat = seg.categories.find((c) => c.id === selectedNode.id);
        if (cat) {
          const totalPrd = cat.subCategories.reduce(
            (acc, sc) => acc + (sc._count?.masterProducts || 0),
            0
          );
          return {
            type: 'category',
            id: cat.id,
            name: cat.name,
            code: cat.code,
            segmentId: seg.id,
            segmentName: seg.name,
            subCategoriesCount: cat.subCategories.length,
            masterProductsCount: totalPrd,
            subCategoriesList: cat.subCategories.map((sc) => ({
              id: sc.id,
              name: sc.name,
              code: sc.code,
              productCount: sc._count?.masterProducts || 0,
            })),
          };
        }
      }
    }

    if (selectedNode.type === 'subcategory') {
      for (const seg of segments) {
        for (const cat of seg.categories) {
          const sc = cat.subCategories.find((s) => s.id === selectedNode.id);
          if (sc) {
            return {
              type: 'subcategory',
              id: sc.id,
              name: sc.name,
              code: sc.code,
              segmentId: seg.id,
              segmentName: seg.name,
              categoryId: cat.id,
              categoryName: cat.name,
              masterProductsCount: sc._count?.masterProducts || sc.masterProducts?.length || 0,
              masterProductsList: sc.masterProducts?.map((p) => ({
                id: p.id,
                name: p.name,
                code: p.code,
                baseSellingRate: p.baseSellingRate,
                thumbnail: p.thumbnail,
                variantsCount: p._count?.variants || 0,
              })),
            };
          }
        }
      }
    }

    return null;
  }, [segments, selectedNode]);

  // Aggregate footer totals
  const totalCategories = useMemo(
    () => segments.reduce((acc, s) => acc + s.categories.length, 0),
    [segments]
  );
  const totalSubCategories = useMemo(
    () =>
      segments.reduce(
        (acc, s) => acc + s.categories.reduce((cAcc, c) => cAcc + c.subCategories.length, 0),
        0
      ),
    [segments]
  );
  const totalProducts = useMemo(
    () =>
      segments.reduce(
        (acc, s) =>
          acc +
          s.categories.reduce(
            (cAcc, c) =>
              cAcc +
              c.subCategories.reduce(
                (scAcc, sc) => scAcc + (sc._count?.masterProducts || 0),
                0
              ),
            0
          ),
        0
      ),
    [segments]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
      {/* LEFT PANE: Interactive Tree Explorer */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col overflow-hidden max-h-[82vh]">
        {/* Tree Head */}
        <div className="p-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
          <div className="relative flex-1 flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-[#FF7700] focus-within:border-[#FF7700] transition-all">
            <Search size={14} className="text-gray-400 shrink-0 mr-1.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search taxonomy..."
              className="w-full text-xs text-gray-900 placeholder:text-gray-400 bg-transparent outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenAddModal('segment')}
            title="Add Top-Level Segment"
            aria-label="Add Top-Level Segment"
            className="w-8 h-8 rounded-xl bg-[#FF7700] hover:bg-[#e06900] text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus size={15} />
          </button>

          <HierarchyInfoPopover />
        </div>

        {/* Tree Sub-head Controls */}
        <div className="px-3 py-2 bg-gray-50/40 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-gray-400">
            Structure (3 Tiers)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAll}
              className="hover:text-gray-900 font-semibold cursor-pointer"
            >
              Expand all
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="hover:text-gray-900 font-semibold cursor-pointer"
            >
              Collapse all
            </button>
          </div>
        </div>

        {/* Tree Body */}
        <div className="p-2 overflow-y-auto flex-1 space-y-0.5 min-h-[380px]">
          {filteredSegments.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              {searchQuery ? `No records match "${searchQuery}"` : 'No segments found.'}
            </div>
          ) : (
            filteredSegments.map((seg) => {
              const isSegExpanded = expandedIds.has(seg.id) || !!searchQuery;
              const isSegSelected = selectedNode?.type === 'segment' && selectedNode?.id === seg.id;
              const segChildCount = `${seg.categories.length} cat`;
              const canDeleteSeg = seg.categories.length === 0;

              return (
                <div key={seg.id} className="space-y-0.5">
                  {/* Segment Node */}
                  <HierarchyTreeNode
                    id={seg.id}
                    name={seg.name}
                    code={seg.code}
                    level="segment"
                    depth={0}
                    childCountText={segChildCount}
                    isExpanded={isSegExpanded}
                    hasChildren={seg.categories.length > 0}
                    isSelected={isSegSelected}
                    onToggle={() => toggleExpand(seg.id)}
                    onSelect={() => onSelectNode('segment', seg.id)}
                    onAddChild={() => onOpenAddModal('category', seg.id, seg.name)}
                    onDelete={() => onDeleteNode('segment', seg.id, seg.name)}
                    canDelete={canDeleteSeg}
                    deleteBlockerReason={`Cannot delete: ${seg.categories.length} categories still reference this segment.`}
                    addChildLabel="Add Category to this Segment"
                  />

                  {/* Categories Branches */}
                  {isSegExpanded &&
                    seg.categories.map((cat) => {
                      const isCatExpanded = expandedIds.has(cat.id) || !!searchQuery;
                      const isCatSelected =
                        selectedNode?.type === 'category' && selectedNode?.id === cat.id;
                      const catChildCount = `${cat.subCategories.length} sub`;
                      const canDeleteCat =
                        cat.subCategories.length === 0 && (cat._count?.masterProducts || 0) === 0;

                      return (
                        <div key={cat.id} className="space-y-0.5">
                          {/* Category Node */}
                          <HierarchyTreeNode
                            id={cat.id}
                            name={cat.name}
                            code={cat.code}
                            level="category"
                            depth={1}
                            childCountText={catChildCount}
                            isExpanded={isCatExpanded}
                            hasChildren={cat.subCategories.length > 0}
                            isSelected={isCatSelected}
                            onToggle={() => toggleExpand(cat.id)}
                            onSelect={() => onSelectNode('category', cat.id)}
                            onAddChild={() => onOpenAddModal('subcategory', cat.id, cat.name)}
                            onDelete={() => onDeleteNode('category', cat.id, cat.name)}
                            canDelete={canDeleteCat}
                            deleteBlockerReason={`Cannot delete: ${cat.subCategories.length} sub-categories reference this category.`}
                            addChildLabel="Add Sub-Category to this Category"
                          />

                          {/* Sub-Categories Leaves */}
                          {isCatExpanded &&
                            cat.subCategories.map((sub) => {
                              const isSubSelected =
                                selectedNode?.type === 'subcategory' && selectedNode?.id === sub.id;
                              const prodCount = sub._count?.masterProducts || 0;
                              const subChildCount = prodCount > 0 ? `${prodCount} prd` : 'empty';
                              const canDeleteSub = prodCount === 0;

                              return (
                                <HierarchyTreeNode
                                  key={sub.id}
                                  id={sub.id}
                                  name={sub.name}
                                  code={sub.code}
                                  level="subcategory"
                                  depth={2}
                                  childCountText={subChildCount}
                                  isExpanded={false}
                                  hasChildren={false}
                                  isSelected={isSubSelected}
                                  onToggle={() => {}}
                                  onSelect={() => onSelectNode('subcategory', sub.id)}
                                  onDelete={() => onDeleteNode('subcategory', sub.id, sub.name)}
                                  canDelete={canDeleteSub}
                                  deleteBlockerReason={`Cannot delete: ${prodCount} master products reference this sub-category.`}
                                />
                              );
                            })}
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
        </div>

        {/* Tree Footer Summary */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <span className="font-medium">
            {segments.length} Segments · {totalCategories} Cat · {totalSubCategories} Sub · {totalProducts} Products
          </span>
        </div>
      </div>

      {/* RIGHT PANE: Node Inspector */}
      <div className="flex-1 min-w-0">
        <HierarchyInspector
          selectedNode={selectedNodeInfo}
          onNavigateToNode={onSelectNode}
          onOpenAddModal={onOpenAddModal}
          onUpdateNode={onUpdateNode}
          onDeleteNode={onDeleteNode}
        />
      </div>
    </div>
  );
}
