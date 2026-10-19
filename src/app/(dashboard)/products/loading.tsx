export default function ProductsLoading() {
  return (
    <div className="p-6 max-w-[1720px] mx-auto min-h-screen bg-[#F4F3ED]/40 flex flex-col gap-6 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="h-3 w-32 bg-gray-200 rounded mb-2" />
          <div className="h-7 w-56 bg-gray-300 rounded mb-1" />
          <div className="h-3.5 w-80 bg-gray-200 rounded" />
        </div>
        <div className="h-10 w-40 bg-orange-200 rounded-xl" />
      </div>

      {/* KPI Insights Strip Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-2">
            <div className="h-3 w-28 bg-gray-200 rounded" />
            <div className="h-8 w-20 bg-gray-300 rounded" />
            <div className="h-3 w-36 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Segment Chips Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 w-32 bg-white border border-gray-200 rounded-xl" />
        ))}
      </div>

      {/* Search & Toolbar Skeleton */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex justify-between items-center">
        <div className="h-10 w-72 bg-gray-100 rounded-xl" />
        <div className="flex items-center gap-2">
          <div className="h-10 w-40 bg-gray-100 rounded-xl" />
          <div className="h-10 w-28 bg-gray-100 rounded-xl" />
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-3xl border border-gray-200 p-3 flex flex-col gap-3">
            <div className="aspect-4/3 bg-gray-100 rounded-2xl" />
            <div className="h-3.5 w-24 bg-gray-200 rounded" />
            <div className="h-5 w-48 bg-gray-300 rounded" />
            <div className="h-3 w-32 bg-gray-100 rounded" />
            <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-3 w-12 bg-gray-200 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
