import React from 'react';

export default function MobileAppRootLoading() {
  return (
    <div className="space-y-3 p-2 animate-pulse">
      <div className="h-10 bg-gray-200/80 rounded-xl" />
      <div className="flex gap-2 overflow-x-hidden pt-1">
        <div className="h-7 w-16 bg-gray-200/80 rounded-full" />
        <div className="h-7 w-20 bg-gray-200/80 rounded-full" />
        <div className="h-7 w-20 bg-gray-200/80 rounded-full" />
      </div>
      <div className="space-y-3 pt-3">
        <div className="h-28 bg-white rounded-2xl border border-gray-200 shadow-2xs" />
        <div className="h-28 bg-white rounded-2xl border border-gray-200 shadow-2xs" />
        <div className="h-28 bg-white rounded-2xl border border-gray-200 shadow-2xs" />
      </div>
    </div>
  );
}
