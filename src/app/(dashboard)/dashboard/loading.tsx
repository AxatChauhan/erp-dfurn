export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-pulse">
      {/* Skeleton Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="w-32 h-5 bg-orange-100/60 rounded-full" />
          <div className="w-64 h-8 bg-gray-200 rounded-lg" />
          <div className="w-96 h-4 bg-gray-100 rounded" />
        </div>
        <div className="w-24 h-7 bg-emerald-50 rounded-lg border border-emerald-100" />
      </div>

      {/* Skeleton KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-gray-100" />
              <div className="w-12 h-3.5 bg-gray-100 rounded" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="w-16 h-7 bg-gray-200 rounded" />
              <div className="w-28 h-3.5 bg-gray-100 rounded" />
              <div className="w-32 h-3 bg-gray-100 rounded mt-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Skeleton Workspaces */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200/80 shadow-xs">
        <div className="w-36 h-5 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-gray-100 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="w-32 h-4 bg-gray-200 rounded" />
                <div className="w-full h-3 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
