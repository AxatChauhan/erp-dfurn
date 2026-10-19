'use client';

import React, { useState, Fragment, useRef } from 'react';
import Image from 'next/image';
import { 
  Plus, Search, ChevronDown, ChevronRight, Settings2, Trash2, 
  Layers, Package, TrendingUp, AlertCircle, RefreshCw, LayoutGrid, Table as TableIcon,
  ChevronLeft, Image as ImageIcon
} from 'lucide-react';
import dynamic from 'next/dynamic';

const MasterProductWizardModal = dynamic(() => import('./components/MasterProductWizardModal'), { ssr: false });
const ProductDetailModal = dynamic(() => import('./components/ProductDetailModal'), { ssr: false });
const VariantWizardModal = dynamic(() => import('./components/VariantWizardModal'), { ssr: false });
const ProductConfigWorkspace = dynamic(() => import('./components/ProductConfigWorkspace'), { ssr: false });

interface ProductsClientProps {
  initialProducts: any[];
  segments: any[];
  departments: any[];
  catalogues: any[];
}

const ITEMS_PER_PAGE = 24;

export default function ProductsClient({
  initialProducts,
  segments,
  departments,
  catalogues,
}: ProductsClientProps) {
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedMasterIds, setExpandedMasterIds] = useState<Set<string>>(new Set());

  // Card photo indices
  const [cardPhotoIndices, setCardPhotoIndices] = useState<Record<string, number>>({});


  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any | null>(null);
  const [newVariantMaster, setNewVariantMaster] = useState<any | null>(null);

  // Configuration Workspace State
  const [workspaceState, setWorkspaceState] = useState<{
    open: boolean;
    entityId: string;
    entityType: 'master-products' | 'variants';
    initialStep?: string;
  }>({ open: false, entityId: '', entityType: 'master-products' });

  const refreshProducts = async () => {
    try {
      const res = await fetch('/api/products/master-products');
      const data = await res.json();
      if (data.ok) setProducts(data.products);
    } catch (err) {
      console.error('Failed to refresh products:', err);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedMasterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNextPhoto = (e: React.MouseEvent, productId: string, totalPhotos: number) => {
    e.stopPropagation();
    setCardPhotoIndices((prev) => ({
      ...prev,
      [productId]: ((prev[productId] || 0) + 1) % totalPhotos,
    }));
  };

  const handlePrevPhoto = (e: React.MouseEvent, productId: string, totalPhotos: number) => {
    e.stopPropagation();
    setCardPhotoIndices((prev) => ({
      ...prev,
      [productId]: ((prev[productId] || 0) - 1 + totalPhotos) % totalPhotos,
    }));
  };

  // Prefetch cache for instant 0ms modal open
  const detailCache = useRef<Map<string, any>>(new Map());
  const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hover prefetching with 150ms debounce (eliminates network flooding during scroll)
  const handlePrefetch = (productId: string) => {
    if (detailCache.current.has(productId)) return;
    fetch(`/api/products/master-products/${productId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.product) {
          detailCache.current.set(productId, data.product);
        }
      })
      .catch(() => {});
  };

  const handleCardMouseEnter = (productId: string) => {
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = setTimeout(() => {
      handlePrefetch(productId);
    }, 150);
  };

  const handleCardMouseLeave = () => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  };

  const handleOpenDetail = (p: any) => {
    const cached = detailCache.current.get(p.id);
    setDetailProduct(cached || p);
  };

  // Filtered products
  const filteredProducts = products.filter((p) => {
    if (selectedSegmentId && p.segmentId && p.segmentId !== selectedSegmentId) {
      const seg = segments.find((s) => s.id === selectedSegmentId);
      const catIds = (seg?.categories || []).map((c: any) => c.id);
      if (!catIds.includes(p.categoryId)) return false;
    }
    if (selectedCategoryId && p.categoryId !== selectedCategoryId) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCode = p.code.toLowerCase().includes(q);
      const matchSub = (p.subCategoryName || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchSub) return false;
    }
    return true;
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // KPI Rollups
  const totalProducts = products.length;
  const totalVariants = products.reduce((sum, p) => sum + (p.totalVariants || 0), 0);
  const avgBaseRate = totalProducts > 0
    ? Math.round(products.reduce((sum, p) => sum + p.baseSellingRate, 0) / totalProducts)
    : 0;
  const configuredBomCount = products.filter((p) => p.bomStatus === 'Configured').length;

  const handleDeleteMaster = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/products/master-products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error);
        return;
      }
      refreshProducts();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  return (
    <div className="p-6 max-w-[1720px] mx-auto min-h-screen bg-[#F4F3ED]/40 flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            <span>Products</span>
            <ChevronRight size={12} />
            <span className="text-orange-600">Catalogue</span>
          </div>
          <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight">Product Catalogue</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Engineering masters, commercial SKUs, and shop-floor manufacturing configurations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsWizardOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>New Master Product</span>
          </button>
        </div>
      </div>

      {/* 1. Insights Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Master Products</span>
          <div className="text-2xl font-black text-[#1A1A1A] mt-1">{totalProducts}</div>
          <span className="text-[11px] text-gray-500 mt-0.5">Across 47 sub-categories</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Variants</span>
          <div className="text-2xl font-black text-[#1A1A1A] mt-1">{totalVariants}</div>
          <span className="text-[11px] text-gray-500 mt-0.5">Commercial catalog SKUs</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg Base Selling Rate</span>
          <div className="text-2xl font-black text-[#1A1A1A] mt-1">₹{avgBaseRate.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-gray-500 mt-0.5">Factory standard pricing</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Configured BOMs</span>
          <div className="text-2xl font-black text-green-700 mt-1">{configuredBomCount}</div>
          <span className="text-[11px] text-gray-500 mt-0.5">Ready for production routing</span>
        </div>
      </div>

      {/* 2. Segment Chips Row (Owner Rule: Active is solid Black) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => { setSelectedSegmentId(null); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            selectedSegmentId === null
              ? 'bg-[#1A1A1A] text-white shadow-xs'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          All Segments ({totalProducts})
        </button>
        {segments.map((seg) => {
          const isSelected = selectedSegmentId === seg.id;
          const catIds = (seg.categories || []).map((c: any) => c.id);
          const count = products.filter((p) => catIds.includes(p.categoryId)).length;
          return (
            <button
              key={seg.id}
              onClick={() => { setSelectedSegmentId(seg.id); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-[#1A1A1A] text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {seg.name} ({count})
            </button>
          );
        })}
      </div>

      {/* 3. Search, Filter & View Switcher Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, code, or sub-category..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full h-10 pl-9 pr-3 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategoryId}
            onChange={(e) => { setSelectedCategoryId(e.target.value); setCurrentPage(1); }}
            className="h-10 px-3 border border-gray-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Categories</option>
            {segments
              .flatMap((s) => s.categories || [])
              .map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>

          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Showroom</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={refreshProducts}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 cursor-pointer"
            title="Refresh Table"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* 4. SHOWROOM GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {paginatedProducts.length === 0 ? (
              <div className="col-span-full p-16 text-center text-gray-400 bg-white rounded-3xl border border-gray-200">
                No products found matching your search.
              </div>
            ) : (
              paginatedProducts.map((p, idx) => {
                const images: any[] = Array.isArray(p.images) && p.images.length > 0 
                  ? p.images 
                  : (p.thumbnail ? [{ url: p.thumbnail }] : []);
                const photoIdx = cardPhotoIndices[p.id] || 0;
                const activeImg = images[photoIdx] || images[0];

                return (
                  <div
                    key={p.id}
                    onClick={() => handleOpenDetail(p)}
                    onMouseEnter={() => handleCardMouseEnter(p.id)}
                    onMouseLeave={handleCardMouseLeave}
                    className="group bg-white rounded-3xl border border-gray-200 shadow-xs hover:shadow-lg hover:border-orange-200 transition-shadow duration-150 ease-out transform-gpu cursor-pointer overflow-hidden flex flex-col justify-between"
                  >
                    {/* Photo Frame */}
                    <div className="relative aspect-4/3 bg-gray-50 border-b border-gray-100 overflow-hidden transform-gpu">
                      {activeImg?.url ? (
                        <Image
                          src={activeImg.url}
                          alt={p.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
                          priority={idx < 4}
                          loading={idx < 4 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="object-contain p-3 transition-transform duration-200 ease-out group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                          {p.code ? p.code.slice(-3) : 'DF'}
                        </div>
                      )}

                      {/* Photo Carousel Controls */}
                      {images.length > 1 && (
                        <>
                          <button
                            onClick={(e) => handlePrevPhoto(e, p.id, images.length)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/90 shadow text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            onClick={(e) => handleNextPhoto(e, p.id, images.length)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/90 shadow text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs z-10">
                            {photoIdx + 1} / {images.length}
                          </span>
                        </>
                      )}

                      {/* Sub-Category Pill */}
                      <span className="absolute top-2.5 left-2.5 bg-white/95 border border-gray-200 text-gray-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs z-10">
                        {p.subCategoryName || p.categoryName}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 flex flex-col gap-2.5 flex-1 justify-between">
                      <div>
                        <div className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-wider">
                          {p.code}
                        </div>
                        <h3 className="font-extrabold text-sm text-[#1A1A1A] line-clamp-1 mt-0.5 group-hover:text-orange-600 transition-colors">
                          {p.name}
                        </h3>
                        <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                          {p.categoryName}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-gray-400 block font-semibold uppercase">Base Price</span>
                          <span className="font-black text-sm text-green-700">
                            ₹{Number(p.baseSellingRate).toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Setup Indicators */}
                        <div className="flex items-center gap-1.5" title={`Process: ${p.processStatus} | BOM: ${p.bomStatus} | Packing: ${p.packingStatus}`}>
                          <div className={`w-2.5 h-2.5 rounded-full ${p.processStatus === 'Configured' ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <div className={`w-2.5 h-2.5 rounded-full ${p.bomStatus === 'Configured' ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <div className={`w-2.5 h-2.5 rounded-full ${p.packingStatus === 'Configured' ? 'bg-green-500' : 'bg-gray-300'}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">
                Showing <span className="font-bold text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                <span className="font-bold text-gray-900">
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}
                </span>{' '}
                of <span className="font-bold text-gray-900">{filteredProducts.length}</span> products
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="px-3 py-1.5 border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((pageNum, idx, arr) => {
                      const showEllipsis = idx > 0 && pageNum - arr[idx - 1] > 1;
                      return (
                        <Fragment key={pageNum}>
                          {showEllipsis && <span className="px-1 text-gray-400">...</span>}
                          <button
                            onClick={() => handlePageChange(pageNum)}
                            className={`w-8 h-8 rounded-xl font-bold transition-all cursor-pointer ${
                              currentPage === pageNum
                                ? 'bg-[#1A1A1A] text-white shadow-xs'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        </Fragment>
                      );
                    })}
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="px-3 py-1.5 border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. DENSE TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5 pl-4 w-10"></th>
                    <th className="p-3.5 w-14">Thumb</th>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5">Sub-Category</th>
                    <th className="p-3.5">Departments</th>
                    <th className="p-3.5">Base Rate</th>
                    <th className="p-3.5">Variants</th>
                    <th className="p-3.5">Setup Status</th>
                    <th className="p-3.5 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-gray-400">
                        No products found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((p) => {
                      const isExpanded = expandedMasterIds.has(p.id);
                      const variants = p.variants || [];

                      return (
                        <Fragment key={p.id}>
                          {/* Master Row */}
                          <tr 
                            className="hover:bg-gray-50/70 transition-colors group cursor-pointer" 
                            onClick={() => handleOpenDetail(p)}
                            onMouseEnter={() => handlePrefetch(p.id)}
                          >
                            <td className="p-3.5 pl-4" onClick={(e) => { e.stopPropagation(); toggleExpand(p.id); }}>
                              {variants.length > 0 && (
                                <button className="p-1 rounded hover:bg-gray-200 text-gray-500 cursor-pointer">
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              )}
                            </td>

                            <td className="p-3.5">
                              {p.thumbnail ? (
                                <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-gray-200 bg-white">
                                  <Image
                                    src={p.thumbnail}
                                    alt={p.name}
                                    fill
                                    sizes="44px"
                                    className="object-contain p-1"
                                  />
                                </div>
                              ) : (
                                <div className="w-11 h-11 rounded-lg bg-orange-100 text-orange-600 font-black text-xs flex items-center justify-center border border-orange-200">
                                  {p.code ? p.code.slice(-3) : 'DF'}
                                </div>
                              )}
                            </td>

                            <td className="p-3.5">
                              <div className="font-extrabold text-gray-900 text-xs">{p.name}</div>
                              <div className="text-[11px] font-mono text-gray-400 mt-0.5">{p.code}</div>
                            </td>

                            <td className="p-3.5">
                              <span className="font-medium text-gray-700">{p.subCategoryName || '–'}</span>
                            </td>

                            <td className="p-3.5">
                              <div className="flex flex-wrap gap-1">
                                {(p.departments || []).map((d: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-semibold">
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="p-3.5 font-bold text-gray-900">
                              ₹{Number(p.baseSellingRate).toLocaleString('en-IN')}
                            </td>

                            <td className="p-3.5 font-semibold text-gray-600">
                              {p.totalVariants} SKU{p.totalVariants === 1 ? '' : 's'}
                            </td>

                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5" title={`Process: ${p.processStatus} | BOM: ${p.bomStatus} | Packing: ${p.packingStatus}`}>
                                <span className={`w-2.5 h-2.5 rounded-full ${p.processStatus === 'Configured' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className={`w-2.5 h-2.5 rounded-full ${p.bomStatus === 'Configured' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className={`w-2.5 h-2.5 rounded-full ${p.packingStatus === 'Configured' ? 'bg-green-500' : 'bg-gray-300'}`} />
                              </div>
                            </td>

                            <td className="p-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setWorkspaceState({ open: true, entityId: p.id, entityType: 'master-products' })}
                                  className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-500 hover:text-orange-600 cursor-pointer"
                                  title="Configure Workspace"
                                >
                                  <Settings2 size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteMaster(p.id, p.name)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 cursor-pointer"
                                  title="Delete Master"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Variant Expansion Rows */}
                          {isExpanded && variants.map((v: any) => (
                            <tr key={v.id} className="bg-gray-50/50 hover:bg-gray-100/60 transition-colors">
                              <td></td>
                              <td className="p-2.5 pl-6">
                                {v.thumbnail ? (
                                  <div className="relative w-8 h-8 rounded-md overflow-hidden border border-gray-200 bg-white">
                                    <Image
                                      src={v.thumbnail}
                                      alt={v.name}
                                      fill
                                      sizes="32px"
                                      className="object-contain p-0.5"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-md bg-gray-200 text-gray-500 font-bold text-[10px] flex items-center justify-center">
                                    SKU
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 font-bold text-gray-800">{v.name}</td>
                              <td className="p-2.5 font-mono text-[11px] text-gray-500">{v.code}</td>
                              <td></td>
                              <td className="p-2.5 font-bold text-green-700">₹{Number(v.baseSellingRate).toLocaleString('en-IN')}</td>
                              <td className="p-2.5 text-gray-400 font-mono text-[10px]">Variant</td>
                              <td className="p-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${v.processStatus === 'Configured' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                  <span className={`w-2 h-2 rounded-full ${v.bomStatus === 'Configured' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                  <span className={`w-2 h-2 rounded-full ${v.packingStatus === 'Configured' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                </div>
                              </td>
                              <td className="p-2.5 pr-4 text-right">
                                <button
                                  onClick={() => setWorkspaceState({ open: true, entityId: v.id, entityType: 'variants' })}
                                  className="px-2 py-1 bg-white border border-gray-200 rounded-md text-[10px] font-bold text-gray-700 hover:bg-gray-50 cursor-pointer shadow-2xs"
                                >
                                  Edit Variant
                                </button>
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls for Table View */}
          {totalPages > 1 && (
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">
                Showing <span className="font-bold text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                <span className="font-bold text-gray-900">
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}
                </span>{' '}
                of <span className="font-bold text-gray-900">{filteredProducts.length}</span> products
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="px-3 py-1.5 border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <span className="font-bold text-gray-800">Page {currentPage} of {totalPages}</span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="px-3 py-1.5 border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lazy-Loaded Modals */}
      {isWizardOpen && (
        <MasterProductWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          departments={departments}
          catalogues={catalogues}
          onSuccess={() => refreshProducts()}
        />
      )}

      {Boolean(detailProduct) && (
        <ProductDetailModal
          isOpen={Boolean(detailProduct)}
          onClose={() => setDetailProduct(null)}
          product={detailProduct}
          onOpenWorkspace={(id, type, step) => {
            setDetailProduct(null);
            setWorkspaceState({ open: true, entityId: id, entityType: type, initialStep: step });
          }}
          onOpenNewVariant={(master) => {
            setDetailProduct(null);
            setNewVariantMaster(master);
          }}
        />
      )}

      {Boolean(newVariantMaster) && (
        <VariantWizardModal
          isOpen={Boolean(newVariantMaster)}
          onClose={() => setNewVariantMaster(null)}
          masterProduct={newVariantMaster}
          onSuccess={() => refreshProducts()}
        />
      )}

      {workspaceState.open && (
        <ProductConfigWorkspace
          isOpen={workspaceState.open}
          onClose={() => {
            setWorkspaceState({ open: false, entityId: '', entityType: 'master-products' });
            refreshProducts();
          }}
          entityId={workspaceState.entityId}
          entityType={workspaceState.entityType}
          initialStep={workspaceState.initialStep}
        />
      )}
    </div>
  );
}
