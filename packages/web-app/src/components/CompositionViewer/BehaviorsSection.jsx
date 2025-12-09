// packages/web-app/src/components/CompositionViewer/BehaviorsSection.jsx

/**
 * BehaviorsSection
 * 
 * Displays composed behaviors (e.g., NotificationsImplications):
 * - Behavior class names
 * - Composition method (spread operator)
 * - Platforms and screens affected
 */
export default function BehaviorsSection({ behaviors, theme }) {
  return (
    <div 
      className="rounded-lg border p-4"
      style={{ 
        borderColor: theme?.colors?.accents?.blue || '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)'
      }}
    >
      {/* Header */}
      <div className="flex items-center mb-3">
        <span className="text-2xl mr-2">🔗</span>
        <div>
          <div 
            className="font-semibold text-lg"
            style={{ color: theme?.colors?.accents?.blue || '#3b82f6' }}
          >
            Composes Behaviors
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Reuses functionality from other implications
          </div>
        </div>
      </div>

      {/* Behaviors List */}
      <div className="space-y-3">
        {behaviors.map((behavior, index) => (
          <div 
            key={index}
            className="rounded border border-gray-700 bg-gray-800/50 p-3"
          >
            {/* Behavior Name */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-mono text-sm text-white mb-1">
                  {behavior.className}
                </div>
                <div className="text-xs text-gray-400">
                  {behavior.relativePath}
                </div>
              </div>
              <div 
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ 
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  color: theme?.colors?.accents?.blue || '#3b82f6'
                }}
              >
                {behavior.compositionMethod}
              </div>
            </div>

            {/* Platforms */}
            <div className="mb-2">
              <div className="text-xs text-gray-400 mb-1">Platforms</div>
              <div className="flex gap-1 flex-wrap">
                {behavior.platforms.map((platform, i) => (
                  <span 
                    key={i}
                    className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            {/* Screens */}
            <div>
              <div className="text-xs text-gray-400 mb-1">Screens Affected</div>
              <div className="flex gap-1 flex-wrap">
                {behavior.screensAffected.map((screen, i) => (
                  <span 
                    key={i}
                    className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 font-mono"
                  >
                    {screen}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}