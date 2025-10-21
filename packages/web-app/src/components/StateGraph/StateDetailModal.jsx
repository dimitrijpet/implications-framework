import { useEffect } from 'react';
import { getStatusIcon, getStatusColor, getPlatformStyle, defaultTheme } from '../../config/visualizerTheme';

export default function StateDetailModal({ state, onClose, theme = defaultTheme }) {
  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);
  
  if (!state) return null;
  
  const statusColor = getStatusColor(state.name, theme);
  const statusIcon = getStatusIcon(state.name, theme);
  const platformStyle = getPlatformStyle(state.meta.platform, theme);
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-50 overflow-y-auto backdrop-blur-sm detail-panel-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="min-h-screen px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div 
            className="glass rounded-2xl p-8 border"
            style={{ 
              borderColor: theme.colors.border,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)'
            }}
          >
            
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="text-6xl">{statusIcon}</div>
                <div>
                  <h2 className="text-4xl font-bold text-white mb-2">{state.displayName}</h2>
                  <span 
                    className={`status-badge status-${state.name} text-base`}
                    style={{ 
                      background: `${statusColor}20`,
                      color: statusColor
                    }}
                  >
                    {state.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="text-red-400 hover:text-red-300 text-3xl font-bold px-4 py-2 rounded-lg hover:bg-red-900/20 transition"
              >
                ✕
              </button>
            </div>
            
            {/* Metadata Grid */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.blue }}>
                📋 Metadata
              </h3>
              

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  
  <MetadataField 
    label="Status" 
    value={state.meta.status || 'N/A'} 
    theme={theme}
  />
  
  <MetadataField 
    label="Trigger Action" 
    value={state.meta.triggerAction || 'N/A'} 
    theme={theme}
  />
  
  <MetadataField 
    label="Trigger Button" 
    value={state.meta.triggerButton || 'N/A'}
    mono
    color={theme.colors.accents.blue}
    theme={theme}
  />
  
  <MetadataField 
    label="After Button" 
    value={state.meta.afterButton || 'null'}
    mono
    theme={theme}
  />
  
  <MetadataField 
    label="Previous Button" 
    value={state.meta.previousButton || 'null'}
    mono
    theme={theme}
  />
  
  <MetadataField 
    label="Platform" 
    value={
      state.meta.platform && state.meta.platform !== 'unknown' ? (
        <span>
          {platformStyle.icon} {state.meta.platform}
        </span>
      ) : (
        'N/A'
      )
    }
    color={state.meta.platform !== 'unknown' ? platformStyle.color : theme.colors.text.tertiary}
    theme={theme}
  />
  
  <MetadataField 
    label="Notification Key" 
    value={state.meta.notificationKey || 'N/A'}
    mono
    theme={theme}
  />
  
  <MetadataField 
    label="Status Code" 
    value={state.meta.statusCode || 'N/A'}
    mono
    theme={theme}
  />
  
  <MetadataField 
    label="Status Number" 
    value={state.meta.statusNumber || 'N/A'}
    mono
    theme={theme}
  />
  
  {state.meta.actionName && (
    <MetadataField 
      label="Action Name" 
      value={state.meta.actionName}
      mono
      theme={theme}
    />
  )}
  
</div>
              
              {/* Required Fields */}
              {state.meta.requiredFields && state.meta.requiredFields.length > 0 && (
                <div className="mt-4 glass p-4 rounded-lg">
                  <div className="text-sm mb-2" style={{ color: theme.colors.text.tertiary }}>
                    Required Fields ({state.meta.requiredFields.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {state.meta.requiredFields.map((field, i) => (
                      <span 
                        key={i}
                        className="px-3 py-1 rounded font-mono text-sm"
                        style={{ 
                          background: `${theme.colors.accents.purple}60`,
                          color: theme.colors.text.primary
                        }}
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Files */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.green }}>
                📂 Files
              </h3>
              
              <div className="space-y-3">
                <FileCard 
                  label="Implication File" 
                  path={state.files.implication}
                  theme={theme}
                />
                {state.files.test && (
                  <FileCard 
                    label="Test File" 
                    path={state.files.test}
                    theme={theme}
                  />
                )}
              </div>
            </div>
            
            {/* Transitions */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.yellow }}>
                🔄 Transitions ({state.transitions.length})
              </h3>
              
              <div className="space-y-3">
                {state.transitions.length > 0 ? (
                  state.transitions.map((t, i) => (
                    <TransitionCard 
                      key={i}
                      transition={t}
                      theme={theme}
                    />
                  ))
                ) : (
                  <div className="glass p-4 rounded-lg text-center" style={{ color: theme.colors.text.tertiary }}>
                    No transitions
                  </div>
                )}
              </div>
            </div>
            
            {/* UI Coverage */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.pink }}>
                🖥️ UI Coverage ({state.uiCoverage.total} screens)
              </h3>
              
              {state.uiCoverage.total > 0 ? (
                <UICoverageSection 
                  platforms={state.uiCoverage.platforms}
                  theme={theme}
                />
              ) : (
                <div className="glass p-4 rounded-lg text-center" style={{ color: theme.colors.text.tertiary }}>
                  No UI coverage defined
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function MetadataField({ label, value, mono, color, theme }) {
  return (
    <div className="glass p-4 rounded-lg">
      <div className="text-sm mb-1" style={{ color: theme.colors.text.tertiary }}>
        {label}
      </div>
      <div 
        className={`font-semibold ${mono ? 'font-mono' : ''}`}
        style={{ color: color || theme.colors.text.primary }}
      >
        {value}
      </div>
    </div>
  );
}

function FileCard({ label, path, theme }) {
  return (
    <div className="glass p-4 rounded-lg">
      <div className="text-sm mb-1" style={{ color: theme.colors.text.tertiary }}>
        {label}
      </div>
      <div className="font-mono text-sm break-all" style={{ color: theme.colors.text.secondary }}>
        {path}
      </div>
    </div>
  );
}

function TransitionCard({ transition, theme }) {
  return (
    <div className="glass p-4 rounded-lg flex items-center gap-4">
      <span 
        className="font-mono font-bold px-4 py-2 rounded-lg"
        style={{ background: theme.colors.accents.blue }}
      >
        {transition.event}
      </span>
      <span className="text-2xl" style={{ color: theme.colors.text.tertiary }}>→</span>
      <span 
        className="font-bold text-lg cursor-pointer hover:underline"
        style={{ color: theme.colors.accents.blue }}
      >
        {getStatusIcon(transition.target)} {transition.target}
      </span>
    </div>
  );
}

function UICoverageSection({ platforms, theme }) {
  return (
    <div className="space-y-4">
      {Object.entries(platforms).map(([platformName, data]) => (
        <PlatformCard 
          key={platformName}
          platformName={platformName}
          data={data}
          theme={theme}
        />
      ))}
    </div>
  );
}

function PlatformCard({ platformName, data, theme }) {
  const platformStyle = getPlatformStyle(platformName, theme);
  
  return (
    <div className="glass-light rounded-lg border" style={{ borderColor: theme.colors.border }}>
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{platformStyle.icon}</span>
          <span className="font-bold text-xl">{platformStyle.name}</span>
          <span className="text-sm" style={{ color: theme.colors.text.tertiary }}>
            ({data.count} screens)
          </span>
        </div>
      </div>
      
      <div className="p-4 pt-0 space-y-3">
        {data.screens.map((screen, idx) => (
          <ScreenCard 
            key={idx}
            screen={screen}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}

function ScreenCard({ screen, theme }) {
  const visibleElements = [...(screen.visible || []), ...(screen.checks?.visible || [])];
  const hiddenElements = [...(screen.hidden || []), ...(screen.checks?.hidden || [])];
  const textChecks = screen.checks?.text || {};
  
  return (
    <div className="glass-light p-4 rounded-lg border" style={{ borderColor: theme.colors.border }}>
      <div className="font-semibold mb-1" style={{ color: theme.colors.accents.blue }}>
        {screen.name}
      </div>
      <div className="text-sm mb-2" style={{ color: theme.colors.text.tertiary }}>
        {screen.description}
      </div>
      
      <div className="space-y-2 text-xs">
        {visibleElements.length > 0 && (
          <div>
            <span className="font-semibold" style={{ color: theme.colors.accents.green }}>
              ✅ Visible ({visibleElements.length}):
            </span>{' '}
            {visibleElements.slice(0, 5).map((e, i) => (
              <span 
                key={i}
                className="font-mono px-1 rounded ml-1"
                style={{ background: theme.colors.background.tertiary }}
              >
                {e}
              </span>
            ))}
            {visibleElements.length > 5 && (
              <span className="ml-1" style={{ color: theme.colors.text.tertiary }}>
                +{visibleElements.length - 5} more
              </span>
            )}
          </div>
        )}
        
        {hiddenElements.length > 0 && (
          <div>
            <span className="font-semibold" style={{ color: theme.colors.accents.red }}>
              ❌ Hidden ({hiddenElements.length}):
            </span>{' '}
            {hiddenElements.slice(0, 5).map((e, i) => (
              <span 
                key={i}
                className="font-mono px-1 rounded ml-1"
                style={{ background: theme.colors.background.tertiary }}
              >
                {e}
              </span>
            ))}
            {hiddenElements.length > 5 && (
              <span className="ml-1" style={{ color: theme.colors.text.tertiary }}>
                +{hiddenElements.length - 5} more
              </span>
            )}
          </div>
        )}
        
        {Object.keys(textChecks).length > 0 && (
          <div>
            <span className="font-semibold" style={{ color: theme.colors.accents.yellow }}>
              📝 Text Checks ({Object.keys(textChecks).length}):
            </span>
            <div className="mt-1 space-y-1 ml-4">
              {Object.entries(textChecks).slice(0, 3).map(([el, val], i) => (
                <div key={i} className="text-xs">
                  <span 
                    className="font-mono px-1 rounded"
                    style={{ background: theme.colors.background.tertiary }}
                  >
                    {el}
                  </span>
                  {' → '}
                  <span style={{ color: theme.colors.accents.yellow }}>"{val}"</span>
                </div>
              ))}
              {Object.keys(textChecks).length > 3 && (
                <div style={{ color: theme.colors.text.tertiary }}>
                  +{Object.keys(textChecks).length - 3} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}