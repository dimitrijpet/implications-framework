// packages/web-app/src/components/StateRegistry/StateRegistryPanel.jsx (FIX)

import { useState } from 'react';

export default function StateRegistryPanel({ stateRegistry, theme, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  if (!stateRegistry) {
    return (
      <div 
        className="rounded-xl p-6 border-2 border-dashed"
        style={{ 
          background: theme.colors.background.secondary,
          borderColor: theme.colors.border // FIXED: was border.default
        }}
      >
        <p className="text-center" style={{ color: theme.colors.text.secondary }}>
          No state registry available
        </p>
      </div>
    );
  }
  
  const mappings = stateRegistry.mappings || [];
  
  // Filter mappings by search term
  const filteredMappings = mappings.filter(({ shortName, fullClassName }) => 
    shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fullClassName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div 
      className="rounded-xl p-6"
      style={{ 
        background: theme.colors.background.secondary,
        border: `1px solid ${theme.colors.border}` // FIXED: added border
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
            🗺️ State Registry
          </h2>
          <span 
            className="px-3 py-1 rounded-full text-sm font-medium"
            style={{ 
              background: theme.colors.background.tertiary,
              color: theme.colors.text.secondary 
            }}
          >
            {mappings.length} mappings
          </span>
        </div>
        
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ 
            background: theme.colors.background.tertiary,
            color: theme.colors.text.primary 
          }}
        >
          {expanded ? '▼ Collapse' : '▶ Expand'}
        </button>
      </div>
      
      {/* Strategy Info */}
      <div 
        className="mb-4 p-3 rounded-lg"
        style={{ background: theme.colors.background.tertiary }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
            Strategy:
          </span>
          <span 
            className="px-2 py-1 rounded text-xs font-bold uppercase"
            style={{ 
              background: theme.colors.accents.blue, // FIXED: was accent.primary
              color: '#fff' 
            }}
          >
            {stateRegistry.strategy}
          </span>
          
          {stateRegistry.config?.pattern && (
            <>
              <span className="text-sm mx-2" style={{ color: theme.colors.text.secondary }}>
                •
              </span>
              <span className="text-sm font-mono" style={{ color: theme.colors.text.secondary }}>
                Pattern: {stateRegistry.config.pattern}
              </span>
            </>
          )}
        </div>
      </div>
      
      {expanded && (
        <>
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search mappings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border"
              style={{ 
                background: theme.colors.background.tertiary,
                borderColor: theme.colors.border, // FIXED: was border.default
                color: theme.colors.text.primary 
              }}
            />
          </div>
          
          {/* Mappings List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredMappings.length === 0 ? (
              <div className="text-center py-8" style={{ color: theme.colors.text.secondary }}>
                {searchTerm ? 'No mappings found' : 'No mappings available'}
              </div>
            ) : (
              filteredMappings.map(({ shortName, fullClassName }, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg hover:brightness-95 transition-all"
                  style={{ background: theme.colors.background.tertiary }}
                >
                  {/* Short Name */}
                  <div className="flex-1">
                    <code 
                      className="font-mono text-sm font-bold"
                      style={{ color: theme.colors.accents.blue }} // FIXED: was accent.primary
                    >
                      "{shortName}"
                    </code>
                  </div>
                  
                  {/* Arrow */}
                  <div style={{ color: theme.colors.text.secondary }}>
                    →
                  </div>
                  
                  {/* Full Class Name */}
                  <div className="flex-[2]">
                    <code 
                      className="font-mono text-sm"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {fullClassName}
                    </code>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Footer Stats */}
          <div 
            className="mt-4 pt-4 border-t flex items-center justify-between text-sm"
            style={{ 
              borderColor: theme.colors.border, // FIXED: was border.default
              color: theme.colors.text.secondary 
            }}
          >
            <span>
              Showing {filteredMappings.length} of {mappings.length} mappings
            </span>
            
            {stateRegistry.config?.caseSensitive !== undefined && (
              <span>
                Case {stateRegistry.config.caseSensitive ? 'Sensitive' : 'Insensitive'}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}