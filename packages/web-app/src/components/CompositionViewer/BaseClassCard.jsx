// packages/web-app/src/components/CompositionViewer/BaseClassCard.jsx

/**
 * BaseClassCard
 * 
 * Displays base class extension information:
 * - Class name and import path
 * - Screens that use mergeWithBase
 * - Platform breakdown
 */
export default function BaseClassCard({ baseClass, theme }) {
  const { className, relativePath, screensUsed, totalMerges, platformBreakdown } = baseClass;

  return (
    <div 
      className="rounded-lg border p-4"
      style={{ 
        borderColor: theme?.colors?.accents?.purple || '#9333ea',
        backgroundColor: 'rgba(147, 51, 234, 0.1)'
      }}
    >
      {/* Header */}
      <div className="flex items-center mb-3">
        <span className="text-2xl mr-2">📦</span>
        <div>
          <div 
            className="font-semibold text-lg"
            style={{ color: theme?.colors?.accents?.purple || '#9333ea' }}
          >
            Extends Base Class
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Inherits common screen configurations
          </div>
        </div>
      </div>

      {/* Base Class Info */}
      <div className="mb-3 pb-3 border-b border-gray-700">
        <div className="font-mono text-sm text-white mb-1">
          {className}
        </div>
        <div className="text-xs text-gray-400">
          {relativePath}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-gray-400 mb-1">Total Merges</div>
          <div className="text-xl font-semibold text-white">{totalMerges}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Screens Used</div>
          <div className="text-xl font-semibold text-white">{screensUsed.length}</div>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-2">Platform Breakdown</div>
        <div className="flex gap-2">
          {Object.entries(platformBreakdown).map(([platform, count]) => (
            <div 
              key={platform}
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ 
                backgroundColor: 'rgba(147, 51, 234, 0.2)',
                color: theme?.colors?.accents?.purple || '#9333ea'
              }}
            >
              {platform}: {count}
            </div>
          ))}
        </div>
      </div>

      {/* Screens List (Collapsible) */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none">
          View all {screensUsed.length} screens
        </summary>
        <div className="mt-2 space-y-1 pl-3">
          {screensUsed.map((screen, index) => (
            <div 
              key={index}
              className="text-xs text-gray-300 font-mono"
            >
              • {screen}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}