'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Smartphone, QrCode, X, ExternalLink } from 'lucide-react';

export default function DesktopAppPromoBanner() {
  // Always visible on page mount / reload (no persistent suppression)
  const [visible, setVisible] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);

  if (!visible) return null;

  return (
    <>
      <aside 
        aria-label="Mobile App Promotion"
        className="w-full bg-[#1E1E1E] text-white px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-sm z-30 transition-all border-b border-orange-500/30"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#FF7700] text-black flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="text-xs font-semibold tracking-wide text-white">
              D'furn Mobile App Available
            </span>
            <span className="hidden sm:inline text-xs text-[#A8A49A]">·</span>
            <span className="text-xs text-[#C5C2B8]">
              Manage Enquiries & Quotations on your smartphone on the go
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#2C2C2C] hover:bg-[#383838] text-gray-200 rounded-md border border-gray-700/60 transition-colors cursor-pointer"
            title="Scan QR code with your phone"
          >
            <QrCode className="w-3.5 h-3.5 text-[#FF7700]" />
            <span className="hidden md:inline">Scan QR</span>
          </button>

          <Link
            href="/app/enquiries"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-[#FF7700] hover:bg-[#E06900] text-white rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <span>Open Mobile App</span>
            <ExternalLink className="w-3 h-3" />
          </Link>

          <button
            type="button"
            onClick={() => setVisible(false)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#2C2C2C] transition-colors ml-1 cursor-pointer"
            aria-label="Dismiss banner"
            title="Dismiss for now"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* QR Code Modal */}
      {showQrModal && (
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
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-orange-50 text-[#FF7700] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-gray-900 mb-1">
              Open D'furn on Mobile
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Scan this QR code with your smartphone camera to access Enquiries and Quotations on the go.
            </p>

            <div className="bg-[#FAF9F5] p-4 rounded-xl border border-gray-200 inline-block mb-4 shadow-inner">
              {/* Fallback to online QR generator with standard clean URL */}
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
                className="flex-1 py-2 text-xs font-semibold bg-black hover:bg-gray-800 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Open in Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
