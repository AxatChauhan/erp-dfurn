import React from 'react';

export default function EnquiriesLoading() {
  return (
    <div className="w-full space-y-4 animate-fade-in p-4">
      {/* KPI Insight Strip Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-6 w-28 bg-gray-200/80 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Filterbar Skeleton */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-3 shadow-2xs flex items-center justify-between gap-3">
        <div className="h-9 w-64 bg-gray-100 rounded-lg animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-orange-100/60 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse border border-gray-100 flex items-center px-4 justify-between">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-4 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
