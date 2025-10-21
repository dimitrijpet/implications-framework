import { useEffect } from 'react';
import { useState } from 'react';
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
            
            {/* ✅ DYNAMIC Metadata Grid */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.blue }}>
                📋 Metadata
              </h3>
              
              <DynamicMetadataGrid 
                metadata={state.meta} 
                theme={theme}
                platformStyle={platformStyle}
              />
            </div>
            
            {/* Files */}
            {state.files && (
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
            )}
            
            {/* Transitions */}
            {state.transitions && (
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
            )}
            
            {/* UI Coverage */}
            {state.uiCoverage && state.uiCoverage.total > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.accents.pink }}>
                  🖥️ UI Coverage ({state.uiCoverage.total} screens)
                </h3>
                
                <UICoverageSection 
                  platforms={state.uiCoverage.platforms}
                  theme={theme}
                />
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ✅ NEW: Dynamic Metadata Grid
// ============================================

function DynamicMetadataGrid({ metadata, theme, platformStyle }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <div className="glass p-4 rounded-lg text-center" style={{ color: theme.colors.text.tertiary }}>
        No metadata available
      </div>
    );
  }
  
  // ✅ Group fields by category for better organization
  const fieldGroups = categorizeFields(metadata);
  
  return (
    <div className="space-y-6">
      {Object.entries(fieldGroups).map(([category, fields]) => (
        <div key={category}>
          <h4 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: theme.colors.text.tertiary }}>
            {category}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(([key, value]) => (
              <DynamicMetadataField 
                key={key}
                fieldName={key}
                value={value}
                theme={theme}
                platformStyle={platformStyle}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// ✅ Categorize fields for better organization
// ============================================

function categorizeFields(metadata) {
  const groups = {
    'Core': [],
    'Buttons': [],
    'Platform': [],
    'Setup': [],
    'Other': []
  };
  
  // Known field categories
  const coreFields = ['status', 'triggerAction', 'statusCode', 'statusNumber'];
  const buttonFields = ['triggerButton', 'afterButton', 'previousButton'];
  const platformFields = ['platform', 'platforms', 'notificationKey'];
  const setupFields = ['setup', 'allSetups', 'actionName', 'requires', 'requiredFields'];
  
  Object.entries(metadata).forEach(([key, value]) => {
    // ✅ CHANGED: Don't skip null/undefined - we want to show them as warnings!
    // Only skip these system fields
    if (key === 'uiCoverage') return;
    
    // Skip empty arrays and empty objects (but NOT null/undefined)
    if (Array.isArray(value) && value.length === 0) return;
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) return;
    
    // Categorize
    if (coreFields.includes(key)) {
      groups['Core'].push([key, value]);
    } else if (buttonFields.includes(key)) {
      groups['Buttons'].push([key, value]);
    } else if (platformFields.includes(key)) {
      groups['Platform'].push([key, value]);
    } else if (setupFields.includes(key)) {
      groups['Setup'].push([key, value]);
    } else {
      groups['Other'].push([key, value]);
    }
  });
  
  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) delete groups[key];
  });
  
  return groups;
}

// ============================================
// ✅ Dynamic Field Renderer
// ============================================

function DynamicMetadataField({ fieldName, value, theme, platformStyle }) {
  // Format field name for display
  const displayName = fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
  
  // Render based on value type
  const renderedValue = renderValue(value, fieldName, theme, platformStyle);
  
  return (
    <div className="glass p-4 rounded-lg">
      <div className="text-sm mb-1" style={{ color: theme.colors.text.tertiary }}>
        {displayName}
      </div>
      <div className="font-semibold" style={{ color: theme.colors.text.primary }}>
        {renderedValue}
      </div>
    </div>
  );
}

// ============================================
// ✅ Smart Value Renderer
// ============================================

function renderValue(value, fieldName, theme, platformStyle) {
  // Handle null/undefined - RED warning
  if (value === null || value === undefined) {
    return (
      <span 
        className="px-2 py-1 rounded text-sm font-semibold"
        style={{ 
          background: `${theme.colors.accents.red}20`,
          color: theme.colors.accents.red
        }}
      >
        ⚠️ Not Set
      </span>
    );
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span 
          className="px-2 py-1 rounded text-sm"
          style={{ 
            background: `${theme.colors.accents.red}15`,
            color: theme.colors.accents.red
          }}
        >
          Empty Array
        </span>
      );
    }
    
    // Special case: requiredFields
    if (fieldName === 'requiredFields') {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((field, i) => (
            <span 
              key={i}
              className="px-2 py-1 rounded text-xs font-mono"
              style={{ 
                background: `${theme.colors.accents.purple}40`,
                color: theme.colors.accents.purple
              }}
            >
              {field}
            </span>
          ))}
        </div>
      );
    }
    
    // Default array rendering - show as badges
    return (
      <div className="flex flex-wrap gap-2">
        {value.map((item, i) => (
          <span 
            key={i}
            className="px-2 py-1 rounded text-xs font-mono"
            style={{ 
              background: `${theme.colors.background.tertiary}`,
              color: theme.colors.text.primary
            }}
          >
            {typeof item === 'object' ? JSON.stringify(item) : String(item)}
          </span>
        ))}
      </div>
    );
  }
  
  // Handle objects - IMPROVED
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return (
        <span 
          className="px-2 py-1 rounded text-sm"
          style={{ 
            background: `${theme.colors.accents.red}15`,
            color: theme.colors.accents.red
          }}
        >
          Empty Object
        </span>
      );
    }
    
    return (
      <div 
        className="text-xs space-y-1 mt-1 p-3 rounded font-mono"
        style={{ 
          background: theme.colors.background.tertiary,
          maxHeight: '200px',
          overflowY: 'auto'
        }}
      >
        {entries.map(([k, v], i) => (
          <div key={i} className="flex gap-2">
            <span 
              className="font-semibold"
              style={{ color: theme.colors.accents.blue }}
            >
              {k}:
            </span>
            <span style={{ color: theme.colors.text.primary }}>
              {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  
  // Handle empty strings
  if (value === '') {
    return (
      <span 
        className="px-2 py-1 rounded text-sm"
        style={{ 
          background: `${theme.colors.accents.red}15`,
          color: theme.colors.accents.red
        }}
      >
        Empty String
      </span>
    );
  }
  
  // Special rendering for specific fields
  if (fieldName === 'platform' && platformStyle) {
    return (
      <span style={{ color: platformStyle.color }}>
        {platformStyle.icon} {value}
      </span>
    );
  }
  
  // Special styling for button fields
  if (fieldName.toLowerCase().includes('button')) {
    return (
      <span 
        className="font-mono px-2 py-1 rounded"
        style={{ 
          background: `${theme.colors.accents.blue}20`,
          color: theme.colors.accents.blue
        }}
      >
        {value}
      </span>
    );
  }
  
  // Default: convert to string
  return String(value);
}

// ============================================
// Helper Components (unchanged)
// ============================================

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
  const [isExpanded, setIsExpanded] = useState(true);  // ✅ Collapsible state
  const platformStyle = getPlatformStyle(platformName, theme);
  
  return (
    <div className="glass-light rounded-lg border" style={{ borderColor: theme.colors.border }}>
      
      {/* ✅ Clickable Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{platformStyle.icon}</span>
          <span className="font-bold text-xl">{platformStyle.name}</span>
          <span className="text-sm" style={{ color: theme.colors.text.tertiary }}>
            ({data.count} screen{data.count !== 1 ? 's' : ''})
          </span>
        </div>
        
        {/* ✅ Expand/Collapse Icon */}
        <span 
          className="text-2xl transition-transform"
          style={{ 
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            color: theme.colors.text.tertiary
          }}
        >
          ▼
        </span>
      </div>
      
      {/* ✅ Collapsible Content */}
      {isExpanded && (
        <div className="p-4 pt-0 space-y-3">
          {data.screens.map((screen, idx) => (
            <ScreenCard 
              key={idx}
              screen={screen}
              theme={theme}
            />
          ))}
        </div>
      )}
      
    </div>
  );
}

function ScreenCard({ screen, theme }) {
  const visibleElements = [...(screen.visible || []), ...(screen.checks?.visible || [])];
  const hiddenElements = [...(screen.hidden || []), ...(screen.checks?.hidden || [])];
  const textChecks = screen.checks?.text || {};
  
  return (
    <div className="glass-light p-4 rounded-lg border" style={{ borderColor: theme.colors.border }}>
      
      {/* Screen Name */}
      <div className="font-semibold text-lg mb-1" style={{ color: theme.colors.accents.blue }}>
        {screen.name}
      </div>
      
      {/* Description */}
      {screen.description && (
        <div className="text-sm mb-3 italic" style={{ color: theme.colors.text.secondary }}>
          {screen.description}
        </div>
      )}
      
      {/* Validation Details */}
      <div className="space-y-2 text-sm">
        
        {/* Visible Elements */}
        {visibleElements.length > 0 && (
          <div className="p-2 rounded" style={{ background: `${theme.colors.accents.green}10` }}>
            <span className="font-semibold" style={{ color: theme.colors.accents.green }}>
              ✅ Visible ({visibleElements.length}):
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {visibleElements.slice(0, 10).map((e, i) => (
                <span 
                  key={i}
                  className="font-mono px-2 py-0.5 rounded text-xs"
                  style={{ 
                    background: theme.colors.background.tertiary,
                    color: theme.colors.text.primary
                  }}
                >
                  {e}
                </span>
              ))}
              {visibleElements.length > 10 && (
                <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                  +{visibleElements.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Hidden Elements */}
        {hiddenElements.length > 0 && (
          <div className="p-2 rounded" style={{ background: `${theme.colors.accents.red}10` }}>
            <span className="font-semibold" style={{ color: theme.colors.accents.red }}>
              ❌ Hidden ({hiddenElements.length}):
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {hiddenElements.slice(0, 10).map((e, i) => (
                <span 
                  key={i}
                  className="font-mono px-2 py-0.5 rounded text-xs"
                  style={{ 
                    background: theme.colors.background.tertiary,
                    color: theme.colors.text.primary
                  }}
                >
                  {e}
                </span>
              ))}
              {hiddenElements.length > 10 && (
                <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                  +{hiddenElements.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Text Checks */}
        {Object.keys(textChecks).length > 0 && (
          <div className="p-2 rounded" style={{ background: `${theme.colors.accents.yellow}10` }}>
            <span className="font-semibold" style={{ color: theme.colors.accents.yellow }}>
              📝 Text Checks ({Object.keys(textChecks).length}):
            </span>
            <div className="mt-1 space-y-1 ml-2">
              {Object.entries(textChecks).slice(0, 5).map(([el, val], i) => (
                <div key={i} className="text-xs flex items-center gap-2">
                  <span 
                    className="font-mono px-2 py-0.5 rounded"
                    style={{ background: theme.colors.background.tertiary }}
                  >
                    {el}
                  </span>
                  <span style={{ color: theme.colors.text.tertiary }}>→</span>
                  <span style={{ color: theme.colors.accents.yellow }}>"{val}"</span>
                </div>
              ))}
              {Object.keys(textChecks).length > 5 && (
                <div className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                  +{Object.keys(textChecks).length - 5} more
                </div>
              )}
            </div>
          </div>
        )}
        
      </div>
      
    </div>
  );
}