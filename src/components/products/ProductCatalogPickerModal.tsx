'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Plus, Minus, Check, Package, Loader2, Sparkles, Layers, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Module-level in-memory cache for instant 0ms modal opening
let cachedMasterProducts: any[] | null = null;
let inFlightProductsPromise: Promise<any[]> | null = null;

export interface SelectedProductItem {
  refType: 'MasterProduct' | 'Variant';
  refId: string;
  name: string;
  code: string;
  unit: string;
  baseSellingRate: number;
  unitPrice: number;
  quantity: number;
  total: number;
  thumbnail: string | null;
  nakedDimensions: { l: number; w: number; h: number } | null;
  expectedDimensions: string;
  materialPreference?: string;
  clientComment?: string;
  customizations?: any;
}

interface ProductCatalogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (item: SelectedProductItem) => void;
  title?: string;
  subtitle?: string;
  actionButtonText?: string;
  initialCategoryId?: string;
}

export default function ProductCatalogPickerModal({
  isOpen,
  onClose,
  onSelectProduct,
  title = 'Select from Master Product Catalog',
  subtitle = 'Choose standard factory products with pre-filled dimensions and rates.',
  actionButtonText = 'Add to Scope',
  initialCategoryId,
}: ProductCatalogPickerModalProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [products, setProducts] = useState<any[]>(cachedMasterProducts || []);
  const [loading, setLoading] = useState<boolean>(!cachedMasterProducts);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategoryId || 'ALL');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Currently inspected/staged product in the bottom configuration bar
  const [stagedProduct, setStagedProduct] = useState<any | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [dimL, setDimL] = useState<number>(0);
  const [dimB, setDimB] = useState<number>(0);
  const [dimH, setDimH] = useState<number>(0);
  const [unitRate, setUnitRate] = useState<number>(0);
  const [materialNote, setMaterialNote] = useState<string>('');
  const [clientComment, setClientComment] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async (isRetry = false) => {
    if (cachedMasterProducts && cachedMasterProducts.length > 0 && !isRetry) {
      setProducts(cachedMasterProducts);
      setLoading(false);
      setLoadError(null);
      setTimeout(() => searchInputRef.current?.focus(), 80);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      if (!inFlightProductsPromise || isRetry) {
        inFlightProductsPromise = fetch('/api/products/master-products', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
          .then(async (res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: Failed to load product catalogue`);
            }
            const data = await res.json();
            if (data.ok && Array.isArray(data.products)) {
              cachedMasterProducts = data.products;
              return data.products;
            }
            throw new Error(data.error || 'Failed to parse products list');
          })
          .finally(() => {
            inFlightProductsPromise = null;
          });
      }

      const prods = await inFlightProductsPromise;
      setProducts(prods);
      setLoadError(null);
    } catch (err: any) {
      console.warn('Could not load products catalogue:', err);
      setLoadError(err?.message || 'Could not load products catalogue. Please check connection and try again.');
    } finally {
      setLoading(false);
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, []);

  // Load products when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen, fetchProducts]);

  // Extract unique categories for filter pills
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.categoryId && p.categoryName) {
        map.set(p.categoryId, p.categoryName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'ALL' ||
        p.categoryId === selectedCategory ||
        p.categoryName?.toLowerCase() === selectedCategory.toLowerCase();

      if (!matchCat) return false;
      if (!q) return true;

      const code = (p.code || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const cat = (p.categoryName || '').toLowerCase();
      const sub = (p.subCategoryName || '').toLowerCase();

      return code.includes(q) || name.includes(q) || cat.includes(q) || sub.includes(q);
    });
  }, [products, search, selectedCategory]);

  // When a product card is clicked, stage it in the configuration bar
  const handlePickCard = (p: any) => {
    setStagedProduct(p);
    setQty(1);
    const l = Number(p.nakedDimensions?.l) || 0;
    const b = Number(p.nakedDimensions?.w) || 0; // Stored DB key 'w' is Breadth (B)
    const h = Number(p.nakedDimensions?.h) || 0;
    setDimL(l);
    setDimB(b);
    setDimH(h);
    setUnitRate(Number(p.baseSellingRate) || 0);
    setMaterialNote('');
    setClientComment('');
  };

  // Confirm adding the staged product
  const handleConfirmAdd = () => {
    if (!stagedProduct) return;

    const formattedDim =
      dimL > 0 || dimB > 0 || dimH > 0
        ? `L ${dimL} × B ${dimB} × H ${dimH} mm`
        : stagedProduct.nakedDimensions
        ? `L ${stagedProduct.nakedDimensions.l || 0} × B ${stagedProduct.nakedDimensions.w || 0} × H ${stagedProduct.nakedDimensions.h || 0} mm`
        : '';

    const safeQty = Math.max(1, qty);
    const safeRate = Math.max(0, unitRate);
    const safeTotal = safeQty * safeRate;

    const item: SelectedProductItem = {
      refType: 'MasterProduct',
      refId: stagedProduct.id,
      name: stagedProduct.name,
      code: stagedProduct.code,
      unit: stagedProduct.unitOfMeasurement || 'Nos',
      baseSellingRate: Number(stagedProduct.baseSellingRate) || 0,
      unitPrice: safeRate,
      quantity: safeQty,
      total: safeTotal,
      thumbnail: stagedProduct.thumbnail || null,
      nakedDimensions: { l: dimL, w: dimB, h: dimH },
      expectedDimensions: formattedDim,
      materialPreference: materialNote.trim() || undefined,
      clientComment: clientComment.trim() || undefined,
      ...(stagedProduct.leadTimeDays ? { leadTimeDays: stagedProduct.leadTimeDays } : {}),
      ...(stagedProduct.defaultDeliveryMode ? { defaultDeliveryMode: stagedProduct.defaultDeliveryMode } : {}),
    } as any;

    onSelectProduct(item);
    toast.success(`Added ${stagedProduct.name} (Qty: ${safeQty})`);

    // Reset staged item so user can continue picking or close
    setStagedProduct(null);
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="wizard-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        padding: '16px',
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="qd-dlg wide"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 1040,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: 14,
          boxShadow: '0 20px 48px rgba(0,0,0,0.22)',
          border: '1px solid #E5DFD3',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px 16px 24px',
            borderBottom: '1px solid #ECE7DC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FBF9F5',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: '#1A1A1A',
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h3>
            <p
              style={{
                margin: '3px 0 0 0',
                fontSize: 13,
                color: '#8B8778',
              }}
            >
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#F4F1EA',
              border: 'none',
              borderRadius: 8,
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#5A554A',
            }}
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Toolbar: Search + Category Pills */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid #ECE7DC',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Search Bar */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 14,
                top: 13,
                color: '#A39B8B',
              }}
            />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search product by name, SKU code or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: 42,
                paddingLeft: 40,
                paddingRight: 14,
                fontSize: 14,
                borderRadius: 8,
                border: '1px solid #D8D2C5',
                background: '#FAF8F4',
                color: '#1A1A1A',
                outline: 'none',
              }}
            />
          </div>

          {/* Category Filter Pills (Active state is BLACK #000000) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 2,
              scrollbarWidth: 'none',
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                background: selectedCategory === 'ALL' ? '#000000' : '#F4F1EA',
                color: selectedCategory === 'ALL' ? '#FFFFFF' : '#5A554A',
              }}
            >
              All Categories ({products.length})
            </button>
            {categories.map((c) => {
              const count = products.filter((p) => p.categoryId === c.id).length;
              const isActive = selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    background: isActive ? '#000000' : '#F4F1EA',
                    color: isActive ? '#FFFFFF' : '#5A554A',
                  }}
                >
                  {c.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            background: '#F8F6F0',
          }}
        >
          {loadError && !loading ? (
            <div
              style={{
                padding: '60px 20px',
                textAlign: 'center',
                color: '#8B8778',
              }}
            >
              <Package size={36} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>Could not load product catalogue</p>
              <p style={{ fontSize: 12.5, color: '#A39B8B', maxWidth: 440, margin: '6px auto 16px auto' }}>
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => fetchProducts(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#000000',
                  color: '#FFFFFF',
                  padding: '9px 20px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} /> Retry Loading Catalogue
              </button>
            </div>
          ) : loading ? (
            <div
              style={{
                padding: '60px 0',
                textAlign: 'center',
                color: '#8B8778',
              }}
            >
              <Loader2 className="animate-spin inline mr-2" size={24} />
              <p style={{ marginTop: 8, fontSize: 14 }}>Loading master catalog items...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div
              style={{
                padding: '60px 0',
                textAlign: 'center',
                color: '#8B8778',
              }}
            >
              <Package size={36} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>No matching products found</p>
              <p style={{ fontSize: 12.5, color: '#A39B8B' }}>
                Try adjusting your search terms or select another category.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: 14,
              }}
            >
              {filteredProducts.map((p) => {
                const isSelected = stagedProduct?.id === p.id;
                const thumb = p.thumbnail;
                const l = p.nakedDimensions?.l;
                const b = p.nakedDimensions?.w; // B in UI
                const h = p.nakedDimensions?.h;
                const dimStr = l || b || h ? `L ${l || '–'} × B ${b || '–'} × H ${h || '–'} mm` : null;

                return (
                  <div
                    key={p.id}
                    onClick={() => handlePickCard(p)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#FFFFFF',
                      borderRadius: 10,
                      border: isSelected ? '2px solid #000000' : '1px solid #E5DFD3',
                      boxShadow: isSelected
                        ? '0 6px 18px rgba(0,0,0,0.12)'
                        : '0 2px 6px rgba(0,0,0,0.03)',
                      padding: 12,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {/* Product Thumbnail */}
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={p.name}
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 8,
                            objectFit: 'cover',
                            background: '#F4F1EA',
                            border: '1px solid #ECE7DC',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 8,
                            background: '#F4F1EA',
                            border: '1px solid #ECE7DC',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: '#A39B8B',
                          }}
                        >
                          <Package size={26} />
                        </div>
                      )}

                      {/* Product Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#1A1A1A',
                            lineHeight: 1.25,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 500,
                            color: '#8B8778',
                            marginTop: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span>{p.code}</span>
                          <span>·</span>
                          <span style={{ color: '#5A554A', fontWeight: 600 }}>
                            {p.categoryName || 'Standard'}
                          </span>
                        </div>

                        {dimStr && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#5A554A',
                              background: '#FAF8F4',
                              border: '1px solid #EFEAE0',
                              borderRadius: 4,
                              padding: '2px 6px',
                              marginTop: 4,
                              display: 'inline-block',
                              fontFamily: 'monospace',
                            }}
                          >
                            {dimStr}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer: Price & Mode Tag */}
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: '1px solid #F4F1EA',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
                        ₹{Number(p.baseSellingRate || 0).toLocaleString('en-IN')}
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#8B8778', marginLeft: 3 }}>
                          / {p.unitOfMeasurement || 'Nos'}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: isSelected ? '#000000' : '#F4F1EA',
                          color: isSelected ? '#FFFFFF' : '#5A554A',
                        }}
                      >
                        {isSelected ? 'Configuring' : 'Select'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Configuration Bar (Zero Empty Form Anxiety: Pre-filled standard specs) */}
        {stagedProduct && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '2px solid #E5DFD3',
              background: '#FFFFFF',
              boxShadow: '0 -6px 20px rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {stagedProduct.thumbnail ? (
                  <img
                    src={stagedProduct.thumbnail}
                    alt=""
                    style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      background: '#F4F1EA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Package size={20} color="#8B8778" />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                    {stagedProduct.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#8B8778' }}>
                    Standard Rate: ₹{Number(stagedProduct.baseSellingRate || 0).toLocaleString('en-IN')} · UOM: {stagedProduct.unitOfMeasurement || 'Nos'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A' }}>
                Item Total: ₹{(qty * unitRate).toLocaleString('en-IN')}
              </div>
            </div>

            {/* Steppers & Dimensions row: Responsive stack on mobile, horizontal row on desktop */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
              {/* Stepper + Dimensions container */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
                {/* Quantity Stepper (Chunky 44px buttons for field users) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>
                    Quantity
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', height: 42, background: '#F4F1EA', borderRadius: 8, padding: 3 }}>
                    <button
                      type="button"
                      onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        border: 'none',
                        background: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      }}
                    >
                      <Minus size={15} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{
                        width: 44,
                        textAlign: 'center',
                        border: 'none',
                        background: 'transparent',
                        fontWeight: 700,
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setQty((prev) => prev + 1)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        border: 'none',
                        background: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      }}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Dimension L */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>
                    L (mm)
                  </label>
                  <input
                    type="number"
                    value={dimL || ''}
                    onChange={(e) => setDimL(parseInt(e.target.value, 10) || 0)}
                    placeholder="L mm"
                    style={{
                      height: 42,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid #D8D2C5',
                      fontSize: 13,
                      background: '#FAF8F4',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                </div>

                {/* Dimension B (Breadth) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>
                    B (mm)
                  </label>
                  <input
                    type="number"
                    value={dimB || ''}
                    onChange={(e) => setDimB(parseInt(e.target.value, 10) || 0)}
                    placeholder="B mm"
                    style={{
                      height: 42,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid #D8D2C5',
                      fontSize: 13,
                      background: '#FAF8F4',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                </div>

                {/* Dimension H (Height) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>
                    H (mm)
                  </label>
                  <input
                    type="number"
                    value={dimH || ''}
                    onChange={(e) => setDimH(parseInt(e.target.value, 10) || 0)}
                    placeholder="H mm"
                    style={{
                      height: 42,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid #D8D2C5',
                      fontSize: 13,
                      background: '#FAF8F4',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                </div>
              </div>

              {/* Primary Action Button (Orange CTA) */}
              <div className="w-full md:w-auto" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="hidden md:block" style={{ fontSize: 11, color: 'transparent' }}>Action</label>
                <button
                  type="button"
                  onClick={handleConfirmAdd}
                  className="w-full md:w-auto"
                  style={{
                    height: 42,
                    padding: '0 24px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#FF7700',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(255, 119, 0, 0.35)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={16} />
                  {actionButtonText}
                </button>
              </div>
            </div>

            {/* Optional Finish & Notes row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input
                type="text"
                placeholder="Finish / Material note (e.g. Merino 10041 Bavarian Beech, Matte Black)"
                value={materialNote}
                onChange={(e) => setMaterialNote(e.target.value)}
                style={{
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: '1px solid #E5DFD3',
                  fontSize: 12.5,
                  background: '#FFFFFF',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Client specific note (e.g. Under-desk wire tray required)"
                value={clientComment}
                onChange={(e) => setClientComment(e.target.value)}
                style={{
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: '1px solid #E5DFD3',
                  fontSize: 12.5,
                  background: '#FFFFFF',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #ECE7DC',
            background: '#FBF9F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 12.5, color: '#8B8778' }}>
            Showing {filteredProducts.length} of {products.length} products
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: '1px solid #D8D2C5',
              background: '#FFFFFF',
              color: '#1A1A1A',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
