import './clients.css';

export default function ClientsLoading() {
  return (
    <div className="clt-container animate-fade-in">
      {/* 1. TOP KPI INSIGHTS STRIP SKELETON */}
      <div className="insights-strip">
        {[
          'Total Clients',
          'Business Clients',
          'Individual Clients',
          'GSTIN on File',
          'Top Source',
        ].map((title, i) => (
          <div key={i} className="insight-card">
            <div className="insight-label">{title}</div>
            <div className="h-7 w-20 bg-stone-200/80 rounded-md animate-pulse my-1" />
            <div className="h-3 w-16 bg-stone-100 rounded-sm animate-pulse mt-1" />
          </div>
        ))}
      </div>

      {/* 2. FILTER & ACTION TOOLBAR SKELETON */}
      <div className="clt-filterbar">
        <div className="clt-filters">
          <div className="clt-search-wrapper">
            <div className="w-[260px] h-[36px] bg-white border border-[#DCD5C4] rounded-full animate-pulse" />
          </div>
          <div className="h-8 w-24 bg-white border border-[#DCD5C4] rounded-full animate-pulse" />
          <div className="h-8 w-24 bg-white border border-[#DCD5C4] rounded-full animate-pulse" />
          <div className="h-8 w-24 bg-white border border-[#DCD5C4] rounded-full animate-pulse" />
          <div className="h-8 w-32 bg-white border border-[#DCD5C4] rounded-full animate-pulse" />
        </div>
        <div className="clt-actions">
          <div className="h-[38px] w-20 bg-stone-100 rounded-lg animate-pulse" />
          <div className="h-[38px] w-28 bg-orange-200/60 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* 3. FIXED LAYOUT DATA TABLE SKELETON */}
      <div className="clt-table-wrap">
        <table className="clt-table">
          <colgroup>
            <col className="w-no" />
            <col className="w-name" />
            <col className="w-type" />
            <col className="w-phone" />
            <col className="w-city" />
            <col className="w-country" />
            <col className="w-email" />
            <col className="w-chev" />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Type</th>
              <th>Phone</th>
              <th>City</th>
              <th>Country</th>
              <th>Email</th>
              <th aria-label="Expand" />
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7].map((row) => (
              <tr key={row} className="clt-row">
                <td className="clt-no text-stone-300">
                  <div className="h-4 w-4 bg-stone-200/70 rounded-sm animate-pulse mx-auto" />
                </td>
                <td className="clt-name">
                  <div className="h-4.5 w-3/4 bg-stone-200/80 rounded-sm animate-pulse" />
                </td>
                <td>
                  <div className="h-4 w-16 bg-stone-100 rounded-md animate-pulse" />
                </td>
                <td className="clt-phone">
                  <div className="h-4 w-28 bg-stone-200/70 rounded-sm animate-pulse" />
                </td>
                <td>
                  <div className="h-4 w-20 bg-stone-100 rounded-sm animate-pulse" />
                </td>
                <td>
                  <div className="h-4 w-16 bg-stone-100 rounded-sm animate-pulse" />
                </td>
                <td className="clt-email">
                  <div className="h-4 w-36 bg-stone-100 rounded-sm animate-pulse" />
                </td>
                <td className="clt-chev">
                  <div className="h-4 w-4 bg-stone-200/50 rounded-sm animate-pulse mx-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
