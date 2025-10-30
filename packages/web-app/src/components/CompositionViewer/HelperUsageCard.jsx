// packages/web-app/src/components/CompositionViewer/HelperUsageCard.jsx

/**
 * HelperUsageCard
 * 
 * Displays ImplicationHelper.mergeWithBase() usage statistics:
 * - Total count
 * - Breakdown by platform
 * - Breakdown by individual screens
 */
export default function HelperUsageCard({ usage, theme }) {
  const { totalMerges, byPlatform, byScreen } = usage;

  // Filter out screens with 0 merges
  const activeScreens = Object.entries(byScreen).filter(([_, count]) => count > 0);

  return (
    <div 
      className="rounded-lg border p-4"
      style={{ 
        borderColor: theme?.colors?.accents?.green || '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)'
      }}
    >
      {/* Header */}
      <div className="flex items-center mb-3">
        <span className="text-2xl mr-2">🛠️</span>
        <div>
          <div 
            className="font-semibold text-lg"
            style={{ color: theme?.colors?.accents?.green || '#10b981' }}
          >
            Helper Usage Summary
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            ImplicationHelper.mergeWithBase() calls
          </div>
        </div>
      </div>

      {/* Total Merges */}
      <div className="mb-3 pb-3 border-b border-gray-700">
        <div className="text-xs text-gray-400 mb-1">Total mergeWithBase Calls</div>
        <div className="text-3xl font-bold text-white">{totalMerges}</div>
      </div>

      {/* Platform Breakdown */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-2">By Platform</div>
        <div className="space-y-2">
          {Object.entries(byPlatform).map(([platform, count]) => {
            const percentage = totalMerges > 0 ? (count / totalMerges * 100).toFixed(0) : 0;
            
            return (
              <div key={platform}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300 font-medium">{platform}</span>
                  <span className="text-sm text-gray-400">{count} screens</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: theme?.colors?.accents?.green || '#10b981'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Screen Breakdown (Collapsible) */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none">
          View breakdown by screen ({activeScreens.length} screens)
        </summary>
        <div className="mt-2 space-y-1 pl-3 max-h-48 overflow-y-auto">
          {activeScreens.map(([screenKey, count]) => (
            <div 
              key={screenKey}
              className="flex items-center justify-between text-xs py-1"
            >
              <span className="text-gray-300 font-mono">{screenKey}</span>
              <span 
                className="px-2 py-0.5 rounded font-medium"
                style={{ 
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: theme?.colors?.accents?.green || '#10b981'
                }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}