'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  X, Settings2, Plus, ExternalLink, Box, Tag, Layers, CheckCircle2, 
  AlertCircle, ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, Loader2 
} from 'lucide-react';
import { formatLbh } from '@/lib/products/measures';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any | null;
  onOpenWorkspace: (productId: string, entityType: 'master-products' | 'variants', initialStep?: string) => void;
  onOpenNewVariant: (masterProduct: any) => void;
}

export default function ProductDetailModal({
  isOpen,
  onClose,
  product,
  onOpenWorkspace,
  onOpenNewVariant,
}: ProductDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'gallery' | 'specs' | 'dimensions' | 'variants' | 'setup'>('overview');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [fullProduct, setFullProduct] = useState<any>(product);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!product) return;
    setFullProduct(product);
    setSelectedImageIndex(0);

    // If specifications not yet loaded (two-tier projection), fetch on demand
    if (!product.specifications || product.specifications.length === 0) {
      setLoadingDetails(true);
      fetch(`/api/products/master-products/${product.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.product) {
            setFullProduct(data.product);
          }
        })
        .catch((err) => console.error('Failed to load full product specs:', err))
        .finally(() => setLoadingDetails(false));
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const currentProd = fullProduct || product;
  const variants = currentProd.variants || [];
  const rawImages: any[] = Array.isArray(currentProd.images) && currentProd.images.length > 0 
    ? currentProd.images 
    : (currentProd.thumbnail ? [{ slot: 'Primary', url: currentProd.thumbnail, name: currentProd.name }] : []);
  
  const currentImage = rawImages[selectedImageIndex] || rawImages[0];

  // Extract swatches from attributes (Powder Coating, Fabrics, Leatherette)
  const swatchAttributes = (currentProd.specifications || []).filter((sp: any) => 
    sp.values && Array.isArray(sp.values) && sp.values.some((v: any) => v.swatchUrl)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-gray-200 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4 bg-gray-50/70">
          <div className="flex items-start gap-4 min-w-0">
            {currentProd.thumbnail ? (
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-gray-200 shadow-xs bg-white shrink-0">
                <Image
                  src={currentProd.thumbnail}
                  alt={currentProd.name}
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 font-black text-sm flex items-center justify-center shrink-0 border border-orange-200">
                {currentProd.code ? currentProd.code.slice(-3) : 'DF'}
              </div>
            )}

            <div className="min-w-0">
              <div className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                {currentProd.categoryName} · {currentProd.subCategoryName}
              </div>
              <h2 className="text-xl font-black text-[#1A1A1A] tracking-tight truncate">
                {currentProd.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs font-bold text-gray-800 bg-gray-200/80 px-2 py-0.5 rounded-md">
                  {currentProd.code}
                </span>
                <span className="text-sm font-extrabold text-green-700">
                  ₹{Number(currentProd.baseSellingRate).toLocaleString('en-IN')}
                </span>
                {rawImages.length > 1 && (
                  <span className="text-[11px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ImageIcon size={12} />
                    <span>{rawImages.length} photos</span>
                  </span>
                )}
                {loadingDetails && (
                  <span className="text-[11px] font-medium text-orange-600 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Loading specs...</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenWorkspace(currentProd.id, 'master-products')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Settings2 size={15} />
              <span>Configure</span>
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Fact Strip */}
        <div className="px-5 py-3 border-b border-gray-100 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase block">Delivery Mode</span>
            <span className="font-bold text-gray-800">{currentProd.defaultDeliveryMode}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Variants</span>
            <span className="font-bold text-gray-800">{variants.length} SKU{variants.length === 1 ? '' : 's'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase block">Volume (CBM)</span>
            <span className="font-mono font-bold text-gray-800">{currentProd.cbm ? `${currentProd.cbm} m³` : '–'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase block">Lead Time</span>
            <span className="font-bold text-gray-800">{currentProd.leadTimeDays ? `${currentProd.leadTimeDays} days` : '–'}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 py-2.5 bg-gray-50/80 border-b border-gray-100 flex gap-2 shrink-0 overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview & Media' },
            { key: 'gallery', label: `Photo Gallery (${rawImages.length})` },
            { key: 'specs', label: 'Technical Specifications' },
            { key: 'dimensions', label: 'Dimensions & CBM' },
            { key: 'variants', label: `Variants (${variants.length})` },
            { key: 'setup', label: 'Manufacturing Setup' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.key ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* TAB 1: OVERVIEW & MEDIA */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Left Column: Interactive Image Box */}
              <div className="flex flex-col gap-3">
                <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-gray-50 border border-gray-200 group">
                  {currentImage?.url ? (
                    <Image
                      src={currentImage.url}
                      alt={currentProd.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 450px"
                      className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No Photo Available
                    </div>
                  )}

                  {rawImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : rawImages.length - 1))}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 shadow-md text-gray-700 hover:bg-white cursor-pointer transition-all"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => setSelectedImageIndex((prev) => (prev < rawImages.length - 1 ? prev + 1 : 0))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 shadow-md text-gray-700 hover:bg-white cursor-pointer transition-all"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}

                  <div className="absolute bottom-2.5 right-2.5 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                    {selectedImageIndex + 1} / {rawImages.length || 1}
                  </div>
                </div>

                {/* Filmstrip Bar */}
                {rawImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {rawImages.map((img: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer bg-white ${
                          selectedImageIndex === idx ? 'border-orange-600 ring-2 ring-orange-200' : 'border-gray-200 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <Image
                          src={img.url}
                          alt={`Angle ${idx + 1}`}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Key Details & Swatches */}
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col gap-2.5">
                  <span className="font-extrabold uppercase text-[10px] text-gray-400 tracking-wider">Commercial & Production</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-gray-500">Creation Mode:</span> <span className="font-bold text-gray-800 ml-1">{currentProd.defaultCreationMode}</span></div>
                    <div><span className="text-gray-500">Unit:</span> <span className="font-bold text-gray-800 ml-1">{currentProd.unitOfMeasurement}</span></div>
                    <div><span className="text-gray-500">Target Margin:</span> <span className="font-bold text-gray-800 ml-1">{currentProd.grossMarginTargetPct}%</span></div>
                    <div><span className="text-gray-500">MOQ:</span> <span className="font-bold text-gray-800 ml-1">{currentProd.moq} unit(s)</span></div>
                  </div>
                </div>

                {/* Swatches if available */}
                {swatchAttributes.map((attr: any, idx: number) => (
                  <div key={idx} className="p-4 border border-gray-200 rounded-2xl bg-white flex flex-col gap-2">
                    <span className="font-bold text-gray-800 text-xs">{attr.key}</span>
                    <div className="flex flex-wrap gap-2">
                      {(attr.values || []).map((val: any, vIdx: number) => (
                        <div key={vIdx} className="flex items-center gap-1.5 p-1 px-2 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                          {val.swatchUrl && (
                            <div className="relative w-4 h-4 rounded-full overflow-hidden border border-gray-300 shrink-0">
                              <Image
                                src={val.swatchUrl}
                                alt={val.name}
                                fill
                                sizes="16px"
                                className="object-cover"
                              />
                            </div>
                          )}
                          <span className="text-[11px] font-medium text-gray-700">{val.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <span className="font-bold text-gray-700 block mb-2">Assigned Production Departments</span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentProd.departments?.map((dept: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg font-bold text-xs">
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FULL PHOTO GALLERY */}
          {activeTab === 'gallery' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {rawImages.map((img: any, idx: number) => (
                  <div key={idx} className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-gray-50 border border-gray-200 p-2">
                    <Image
                      src={img.url}
                      alt={img.name || `Photo ${idx + 1}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 300px"
                      className="object-contain p-2"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={img.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-white text-gray-900 rounded-lg font-bold text-xs flex items-center gap-1 shadow-md hover:bg-gray-100"
                      >
                        <ExternalLink size={13} />
                        <span>View High-Res</span>
                      </a>
                    </div>
                    <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      {img.slot || `Angle ${idx + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TECHNICAL SPECIFICATIONS */}
          {activeTab === 'specs' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(currentProd.specifications || []).length === 0 ? (
                <div className="col-span-full p-8 text-center text-gray-400">
                  {loadingDetails ? 'Loading specifications...' : 'No additional specifications registered.'}
                </div>
              ) : (
                (currentProd.specifications || []).map((sp: any, idx: number) => (
                  <div key={idx} className="p-3 border border-gray-100 rounded-xl bg-gray-50/50 flex flex-col justify-between text-xs">
                    <span className="font-bold text-gray-900">{sp.key}</span>
                    <span className="text-gray-600 mt-1">{sp.value || 'Configured in BOM / Production order'}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: DIMENSIONS & CBM */}
          {activeTab === 'dimensions' && (
            <div className="flex flex-col gap-4 text-xs">
              <div className="p-4 border border-gray-200 rounded-2xl bg-gray-50/50">
                <span className="font-bold text-gray-900 block mb-1">Naked Dimensions (L B H)</span>
                <span className="text-base font-mono font-bold text-gray-800 block">
                  {formatLbh(currentProd.nakedDimensions)}
                </span>
                {currentProd.nakedDimensionsInches && (
                  <span className="text-xs font-mono text-gray-500 mt-1 block">
                    Inches: {currentProd.nakedDimensionsInches.l}″ × {currentProd.nakedDimensionsInches.w}″ × {currentProd.nakedDimensionsInches.h}″
                  </span>
                )}
              </div>

              <div className="p-4 border border-gray-200 rounded-2xl bg-gray-50/50">
                <span className="font-bold text-gray-900 block mb-1">Packed Box Dimensions (L B H)</span>
                <span className="text-base font-mono font-bold text-gray-800 block">
                  {formatLbh(currentProd.boxDimensions)}
                </span>
                <span className="text-xs font-mono text-orange-700 mt-1 block font-bold">
                  Shipping Volume: {currentProd.cbm || 0} m³ CBM
                </span>
              </div>
            </div>
          )}

          {/* TAB 5: VARIANTS */}
          {activeTab === 'variants' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Commercial Variants</span>
                <button
                  onClick={() => onOpenNewVariant(currentProd)}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add Variant</span>
                </button>
              </div>

              <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 text-xs">
                {variants.map((v: any) => (
                  <div key={v.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                    <div>
                      <span className="font-bold text-gray-900 block">{v.name}</span>
                      <span className="font-mono text-gray-500 text-[11px]">{v.code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-green-700">
                        ₹{Number(v.baseSellingRate).toLocaleString('en-IN')}
                      </span>
                      <button
                        onClick={() => onOpenWorkspace(v.id, 'variants')}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold text-[11px] cursor-pointer"
                      >
                        Configure
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: MANUFACTURING SETUP */}
          {activeTab === 'setup' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 border border-gray-200 rounded-2xl bg-gray-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-gray-900 block mb-1">Process Routing</span>
                  <span className="text-gray-500 text-[11px]">Department sequencing chart</span>
                </div>
                <div className="mt-4">
                  <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-md font-bold text-xs inline-block">
                    {currentProd.processStatus}
                  </span>
                </div>
              </div>

              <div className="p-4 border border-gray-200 rounded-2xl bg-gray-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-gray-900 block mb-1">Bill of Materials (BOM)</span>
                  <span className="text-gray-500 text-[11px]">Raw materials & parts</span>
                </div>
                <div className="mt-4">
                  <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-md font-bold text-xs inline-block">
                    {currentProd.bomStatus}
                  </span>
                </div>
              </div>

              <div className="p-4 border border-gray-200 rounded-2xl bg-gray-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-gray-900 block mb-1">Packing List</span>
                  <span className="text-gray-500 text-[11px]">Carton dimensions & weights</span>
                </div>
                <div className="mt-4">
                  <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-md font-bold text-xs inline-block">
                    {currentProd.packingStatus}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
