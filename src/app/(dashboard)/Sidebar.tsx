'use client';

import { 
  LayoutDashboard, 
  TrendingUp, 
  ClipboardList, 
  Layers, 
  Package, 
  Shield, 
  ChevronDown, 
  ChevronRight, 
  Briefcase,
  Smartphone,
  QrCode,
  ExternalLink,
  X
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Clear optimistic active state whenever the route change commits
  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const activePath = pendingPath || pathname;
  const isSalesActive = activePath.includes('enquiries') || activePath.includes('quotations') || activePath.includes('clients');
  const isHrmActive = activePath.includes('/hrm');
  const isProductsActive = activePath.includes('/products');

  // Accordion state: keep active section open by default
  const [openSection, setOpenSection] = useState<'sales' | 'hrm' | 'products' | null>(() => {
    if (pathname.includes('/hrm')) return 'hrm';
    if (pathname.includes('/products')) return 'products';
    return 'sales';
  });

  // Sync accordion with active page route
  useEffect(() => {
    if (activePath.includes('/hrm')) {
      setOpenSection('hrm');
    } else if (activePath.includes('/products')) {
      setOpenSection('products');
    } else if (activePath.includes('enquiries') || activePath.includes('quotations') || activePath.includes('clients')) {
      setOpenSection('sales');
    }
  }, [activePath]);

  const handleNavClick = (href: string) => {
    setPendingPath(href);
    if (href.includes('/hrm')) setOpenSection('hrm');
    else if (href.includes('/products')) setOpenSection('products');
    else if (href.includes('enquiries') || href.includes('quotations') || href.includes('clients')) setOpenSection('sales');
  };

  return (
    /* Permanent 72px layout anchor prevents main dashboard content from reflowing/shifting */
    <div className="w-[72px] h-full flex-shrink-0 relative z-30">
      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`${
          isHovered ? 'w-[260px] shadow-2xl' : 'w-[72px] shadow-xs'
        } bg-white border-r border-gray-200 flex flex-col h-full absolute top-0 left-0 bottom-0 z-30 transition-[width,box-shadow] duration-200 ease-in-out select-none overflow-hidden`}
      >
        {/* 1. BRANDING (40x40 monogram at x=16px; perfectly aligned in both states) */}
        <div className="h-16 border-b border-gray-100 flex items-center px-4 overflow-hidden shrink-0">
          <div className="w-10 h-10 bg-orange-500 text-white font-black text-sm rounded-xl flex items-center justify-center shadow-xs shrink-0">
            DF
          </div>
          {isHovered && (
            <div className="flex flex-col items-start pl-3 whitespace-nowrap overflow-hidden">
              <span className="font-extrabold text-gray-900 text-base leading-tight tracking-tight">d&apos;furn</span>
              <span className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase">ERP SYSTEM</span>
            </div>
          )}
        </div>

        {/* 2. COMPANY INFO (Only visible when expanded) */}
        {isHovered && (
          <div className="px-5 py-2.5 border-b border-gray-100 bg-slate-50/60 shrink-0 whitespace-nowrap overflow-hidden">
            <div className="text-xs font-bold text-gray-800 truncate">DFurn Modular Systems</div>
            <div className="text-[10px] text-gray-400 mt-0.5 font-mono">GSTIN: 24AADCD4139R1ZB</div>
          </div>
        )}

        {/* 3. NAVIGATION ITEMS */}
        <nav className="flex-1 py-3 flex flex-col gap-1 overflow-y-auto select-none">
          
          {/* Dashboard */}
          <Link 
            href="/dashboard" 
            prefetch={true}
            title="Dashboard"
            onMouseEnter={() => router.prefetch('/dashboard')}
            onClick={() => handleNavClick('/dashboard')}
            className={`w-full flex items-center px-4 py-1.5 transition-colors group cursor-pointer ${
              activePath === '/dashboard' ? 'text-orange-600' : 'text-gray-700'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              activePath === '/dashboard' 
                ? 'bg-orange-500 text-white shadow-xs' 
                : 'text-gray-500 group-hover:bg-gray-100 group-hover:text-gray-900'
            }`}>
              <LayoutDashboard size={20} />
            </div>
            {isHovered && (
              <span className="font-semibold text-sm whitespace-nowrap pl-3 text-gray-800 group-hover:text-gray-900 truncate">
                Dashboard
              </span>
            )}
          </Link>

          {/* SALES SECTION */}
          <div>
            <button 
              type="button"
              onClick={() => setOpenSection(openSection === 'sales' ? null : 'sales')}
              title="Sales"
              className={`w-full flex items-center px-4 py-1.5 transition-colors group cursor-pointer ${
                isSalesActive ? 'text-orange-600' : 'text-gray-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                isSalesActive 
                  ? 'bg-orange-500 text-white shadow-xs' 
                  : 'text-gray-500 group-hover:bg-gray-100 group-hover:text-gray-900'
              }`}>
                <TrendingUp size={20} />
              </div>
              {isHovered && (
                <div className="flex items-center justify-between flex-1 min-w-0 pl-3 pr-1">
                  <span className="font-bold text-xs uppercase tracking-wider text-orange-600 truncate">
                    SALES
                  </span>
                  {openSection === 'sales' ? (
                    <ChevronDown size={14} className="text-orange-500 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  )}
                </div>
              )}
            </button>
            
            {isHovered && openSection === 'sales' && (
              <div className="flex flex-col mt-0.5 mb-1.5 pl-[64px] pr-3 gap-0.5 whitespace-nowrap">
                <Link 
                  href="/enquiries" 
                  prefetch={true}
                  onMouseEnter={() => router.prefetch('/enquiries')}
                  onClick={() => handleNavClick('/enquiries')}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors border-l-2 ${
                    activePath.includes('enquiries') 
                      ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold' 
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Enquiries
                </Link>
                <Link 
                  href="/quotations" 
                  prefetch={true}
                  onMouseEnter={() => router.prefetch('/quotations')}
                  onClick={() => handleNavClick('/quotations')}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors border-l-2 ${
                    activePath.includes('quotations') 
                      ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold' 
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Quotations
                </Link>
                <Link 
                  href="/clients" 
                  prefetch={true}
                  onMouseEnter={() => router.prefetch('/clients')}
                  onClick={() => handleNavClick('/clients')}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors border-l-2 ${
                    activePath.includes('clients') 
                      ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold' 
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Clients
                </Link>
              </div>
            )}
          </div>

          {/* HRM SECTION */}
          {(userRole === 'SUPER_ADMIN' || userRole === 'MANAGER') && (
            <div>
              <button 
                type="button"
                onClick={() => setOpenSection(openSection === 'hrm' ? null : 'hrm')}
                title="HRM & Factory"
                className={`w-full flex items-center px-4 py-1.5 transition-colors group cursor-pointer ${
                  isHrmActive ? 'text-indigo-700' : 'text-gray-700'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isHrmActive 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-gray-500 group-hover:bg-gray-100 group-hover:text-gray-900'
                }`}>
                  <Briefcase size={20} />
                </div>
                {isHovered && (
                  <div className="flex items-center justify-between flex-1 min-w-0 pl-3 pr-1">
                    <span className="font-bold text-xs uppercase tracking-wider text-indigo-700 truncate">
                      HRM & FACTORY
                    </span>
                    {openSection === 'hrm' ? (
                      <ChevronDown size={14} className="text-indigo-600 shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-400 shrink-0" />
                    )}
                  </div>
                )}
              </button>
              
              {isHovered && openSection === 'hrm' && (
                <div className="flex flex-col mt-0.5 mb-1.5 pl-[64px] pr-3 gap-0.5 whitespace-nowrap">
                  <Link 
                    href="/hrm/employees" 
                    prefetch={true}
                    onMouseEnter={() => router.prefetch('/hrm/employees')}
                    onClick={() => handleNavClick('/hrm/employees')}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors border-l-2 ${
                      activePath.includes('/hrm/employees') 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold' 
                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    Employees
                  </Link>
                  <Link 
                    href="/hrm/attendance" 
                    prefetch={true}
                    onMouseEnter={() => router.prefetch('/hrm/attendance')}
                    onClick={() => handleNavClick('/hrm/attendance')}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors border-l-2 ${
                      activePath === '/hrm/attendance'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold' 
                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    Daily Attendance
                  </Link>
                  <Link 
                    href="/hrm/attendance-register" 
                    prefetch={true}
                    onMouseEnter={() => router.prefetch('/hrm/attendance-register')}
                    onClick={() => handleNavClick('/hrm/attendance-register')}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors border-l-2 ${
                      activePath.includes('/hrm/attendance-register') 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold' 
                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    Mustard Roll Register
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ORDERS */}
          <div 
            title="Orders"
            className="w-full flex items-center px-4 py-1.5 text-gray-400 cursor-default group"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-gray-400 group-hover:bg-gray-50">
              <ClipboardList size={20} />
            </div>
            {isHovered && (
              <div className="flex items-center justify-between flex-1 min-w-0 pl-3 pr-1">
                <span className="font-bold text-xs uppercase tracking-wider text-gray-400 truncate">ORDERS</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Soon</span>
              </div>
            )}
          </div>

          {/* PRODUCTS SECTION */}
          <div>
            <button 
              type="button"
              onClick={() => setOpenSection(openSection === 'products' ? null : 'products')}
              title="Products & Engineering"
              className={`w-full flex items-center px-4 py-1.5 transition-colors group cursor-pointer ${
                isProductsActive ? 'text-orange-600' : 'text-gray-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                isProductsActive 
                  ? 'bg-orange-500 text-white shadow-xs' 
                  : 'text-gray-500 group-hover:bg-gray-100 group-hover:text-gray-900'
              }`}>
                <Layers size={20} />
              </div>
              {isHovered && (
                <div className="flex items-center justify-between flex-1 min-w-0 pl-3 pr-1">
                  <span className="font-bold text-xs uppercase tracking-wider text-orange-600 truncate">
                    PRODUCTS
                  </span>
                  {openSection === 'products' ? (
                    <ChevronDown size={14} className="text-orange-500 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  )}
                </div>
              )}
            </button>
            
            {isHovered && openSection === 'products' && (
              <div className="flex flex-col mt-0.5 mb-1.5 pl-[64px] pr-3 gap-0.5 whitespace-nowrap">
                <Link 
                  href="/products" 
                  prefetch={true}
                  onMouseEnter={() => router.prefetch('/products')}
                  onClick={() => handleNavClick('/products')}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors border-l-2 ${
                    activePath === '/products' 
                      ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold' 
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Catalogue
                </Link>
                <Link 
                  href="/products/hierarchy" 
                  prefetch={true}
                  onMouseEnter={() => router.prefetch('/products/hierarchy')}
                  onClick={() => handleNavClick('/products/hierarchy')}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors border-l-2 ${
                    activePath.includes('/products/hierarchy') 
                      ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold' 
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Hierarchy
                </Link>
              </div>
            )}
          </div>

          {/* MATERIALS */}
          <div 
            title="Material Management"
            className="w-full flex items-center px-4 py-1.5 text-gray-400 cursor-default group"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-gray-400 group-hover:bg-gray-50">
              <Package size={20} />
            </div>
            {isHovered && (
              <div className="flex items-center justify-between flex-1 min-w-0 pl-3 pr-1">
                <span className="font-bold text-xs uppercase tracking-wider text-gray-400 truncate">MATERIALS</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Soon</span>
              </div>
            )}
          </div>

          {/* ADMIN */}
          {userRole === 'SUPER_ADMIN' && (
            <Link 
              href="/users" 
              prefetch={true}
              onMouseEnter={() => router.prefetch('/users')}
              onClick={() => handleNavClick('/users')}
              title="Admin"
              className={`w-full flex items-center px-4 py-1.5 transition-colors group cursor-pointer ${
                activePath.includes('/users') ? 'text-orange-600' : 'text-gray-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                activePath.includes('/users') 
                  ? 'bg-orange-500 text-white shadow-xs' 
                  : 'text-gray-500 group-hover:bg-gray-100 group-hover:text-gray-900'
              }`}>
                <Shield size={20} />
              </div>
              {isHovered && (
                <div className="flex items-center justify-between flex-1 min-w-0 pl-3 pr-1">
                  <span className="font-bold text-xs uppercase tracking-wider truncate">ADMIN</span>
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                </div>
              )}
            </Link>
          )}
        </nav>

        {/* 4. MOBILE APP LAUNCHER */}
        <div className="p-3 border-t border-gray-100 shrink-0">
          {isHovered ? (
            <div className="bg-[#FAF9F5] border border-gray-200/80 rounded-xl p-2.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Smartphone size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-gray-900 leading-tight truncate">
                    Mobile App
                  </div>
                  <div className="text-[10px] text-gray-500 leading-tight truncate">
                    Companion on the go
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Scan QR code with your phone"
                >
                  <QrCode size={12} className="text-orange-500" />
                  <span>Scan QR</span>
                </button>
                <Link
                  href="/app/enquiries"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-semibold bg-black hover:bg-gray-800 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Open Mobile App in new tab"
                >
                  <span>Open</span>
                  <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                title="D'furn Mobile App (Scan QR)" aria-label="D'furn Mobile App (/app/enquiries)" data-href="/app/enquiries"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-orange-50 hover:text-orange-600 transition-colors cursor-pointer"
              >
                <Smartphone size={20} />
              </button>
            </div>
          )}
        </div>

        {/* QR Code Modal (Rendered via Portal) */}
        {mounted && showQrModal && createPortal(
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
            onClick={() => setShowQrModal(false)}
          >
            <div 
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 text-center relative animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>

              <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Smartphone className="w-6 h-6 text-orange-500" />
              </div>

              <h3 className="text-base font-bold text-gray-900 mb-1">
                Open D'furn on Mobile
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Scan this QR code with your smartphone camera to access Enquiries and Quotations on the go.
              </p>

              <div className="bg-[#FAF9F5] p-4 rounded-xl border border-gray-200 inline-block mb-4 shadow-inner">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https%3A%2F%2Foptimistic-carson-one.vercel.app%2Fapp%2Fenquiries"
                  alt="QR Code to open D'furn Mobile App"
                  width={180}
                  height={180}
                  className="w-[180px] h-[180px] mx-auto rounded"
                />
              </div>

              <div className="text-[11px] text-gray-500 mb-4 bg-gray-50 py-1.5 px-2 rounded font-mono truncate">
                https://optimistic-carson-one.vercel.app/app/enquiries
              </div>

              <div className="flex gap-2">
                <Link
                  href="/app/enquiries"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 text-xs font-semibold bg-black hover:bg-gray-800 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open in Tab</span>
                  <ExternalLink size={13} />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </aside>
    </div>
  );
}
