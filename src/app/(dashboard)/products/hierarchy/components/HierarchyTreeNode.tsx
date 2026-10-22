'use client';

import React from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';

export interface HierarchyTreeNodeProps {
  id: string;
  name: string;
  code: string | null;
  level: 'segment' | 'category' | 'subcategory';
  depth: number;
  childCountText?: string | null;
  isExpanded: boolean;
  hasChildren: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onAddChild?: () => void;
  onDelete: () => void;
  canDelete: boolean;
  deleteBlockerReason?: string | null;
  addChildLabel?: string;
}

export function HierarchyTreeNode({
  name,
  code,
  level,
  depth,
  childCountText,
  isExpanded,
  hasChildren,
  isSelected,
  onToggle,
  onSelect,
  onAddChild,
  onDelete,
  canDelete,
  deleteBlockerReason,
  addChildLabel = 'Add child',
}: HierarchyTreeNodeProps) {
  // Padding indent per depth level
  const indentClass =
    depth === 0
      ? 'pl-2'
      : depth === 1
      ? 'pl-6'
      : 'pl-10';

  return (
    <div
      className={`group relative flex items-center justify-between py-1.5 pr-2 rounded-xl text-xs transition-all cursor-pointer select-none border ${indentClass} ${
        isSelected
          ? 'bg-[#000000] border-[#000000] text-white shadow-xs font-semibold'
          : 'bg-white border-transparent text-gray-800 hover:bg-[#F4F1EC] hover:border-gray-200'
      }`}
      onClick={onSelect}
    >
      {/* Left: Chevron + Node Name + Faint Code Tag */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`p-1 rounded-md transition-transform cursor-pointer shrink-0 ${
              isSelected
                ? 'text-white hover:bg-white/20'
                : 'text-gray-400 hover:text-gray-800 hover:bg-gray-200/60'
            }`}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight
              size={13}
              className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="w-5 shrink-0 inline-block" />
        )}

        {/* Level indicator dot */}
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            level === 'segment'
              ? 'bg-[#FF7700]'
              : level === 'category'
              ? isSelected
                ? 'bg-amber-300'
                : 'bg-amber-500'
              : isSelected
              ? 'bg-blue-300'
              : 'bg-blue-500'
          }`}
        />

        {/* Name */}
        <span className="truncate font-medium">{name}</span>

        {/* Faint Monospace Code Tag */}
        {code && (
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold shrink-0 tracking-wide ${
              isSelected
                ? 'bg-white/20 text-white'
                : 'bg-orange-50 text-[#FF7700] border border-orange-200/60'
            }`}
          >
            {code}
          </span>
        )}
      </div>

      {/* Right Slot: Count Badge at Rest, Action Buttons on Hover */}
      <div className="flex items-center justify-end shrink-0 min-w-[70px]">
        {/* At Rest: Clean Count Badge */}
        {childCountText && (
          <span
            className={`text-[10px] font-medium transition-opacity group-hover:hidden group-focus-within:hidden ${
              isSelected ? 'text-gray-300' : 'text-gray-400'
            }`}
          >
            {childCountText}
          </span>
        )}

        {/* On Hover / Focus: Action Buttons */}
        <div className="hidden group-hover:flex group-focus-within:flex items-center gap-1">
          {onAddChild && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild();
              }}
              title={addChildLabel}
              aria-label={addChildLabel}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                isSelected
                  ? 'text-white hover:bg-white/20'
                  : 'text-gray-500 hover:text-[#FF7700] hover:bg-orange-50'
              }`}
            >
              <Plus size={13} />
            </button>
          )}

          <button
            type="button"
            disabled={!canDelete}
            onClick={(e) => {
              e.stopPropagation();
              if (canDelete) onDelete();
            }}
            title={canDelete ? 'Delete' : deleteBlockerReason || 'Cannot delete'}
            aria-label="Delete"
            className={`p-1 rounded-md transition-colors ${
              !canDelete
                ? 'opacity-30 cursor-not-allowed text-gray-400'
                : isSelected
                ? 'text-red-300 hover:bg-red-950/60 cursor-pointer'
                : 'text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
            }`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
