// packages/web-app/src/components/TagsPanel/TagsPanel.jsx
// Minimal tags panel - filtering and grouping controls
// Place this ABOVE the graph section in Visualizer.jsx

import { useState, useEffect } from 'react';

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', 
  '#ec4899', '#06b6d4', '#ef4444', '#84cc16',
];

const GROUP_STYLES = [
  { id: 'none', label: 'None', icon: '○' },
  { id: 'solid', label: 'Solid', icon: '▣' },
  { id: 'dashed', label: 'Dashed', icon: '▢' },
  { id: 'filled', label: 'Filled', icon: '■' },
];

export default function TagsPanel({
  discoveredTags,
  tagConfig,
  onTagConfigChange,
  activeFilters,
  onFilterChange,
  theme,
  collapsed = false,
  onToggleCollapse,
}) {
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    if (discoveredTags) {
      const initial = {};
      Object.keys(discoveredTags).forEach(cat => initial[cat] = true);
      setExpandedCategories(initial);
    }
  }, [discoveredTags]);

  const getTagValueConfig = (category, value) => {
    const key = `${category}:${value}`;
    if (tagConfig[key]) return tagConfig[key];
    
    // Default config - NO grouping, just assign a color
    const allValues = Object.values(discoveredTags || {}).flat();
    const index = allValues.indexOf(value);
    
    return {
      color: DEFAULT_COLORS[Math.abs(index) % DEFAULT_COLORS.length],
      style: 'none',  // DEFAULT IS NONE - no group box
    };
  };

  const updateTagValueConfig = (category, value, updates) => {
    const key = `${category}:${value}`;
    const current = getTagValueConfig(category, value);
    onTagConfigChange({ ...tagConfig, [key]: { ...current, ...updates } });
  };

  const toggleFilter = (category, value) => {
    const key = `${category}:${value}`;
    const newFilters = { ...activeFilters };
    if (newFilters[key]) delete newFilters[key];
    else newFilters[key] = true;
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => onFilterChange({});

  const cycleStyle = (category, value) => {
    const config = getTagValueConfig(category, value);
    const currentIndex = GROUP_STYLES.findIndex(s => s.id === config.style);
    const nextIndex = (currentIndex + 1) % GROUP_STYLES.length;
    updateTagValueConfig(category, value, { style: GROUP_STYLES[nextIndex].id });
  };

  const hasActiveFilters = Object.keys(activeFilters || {}).length > 0;
  const hasAnyTags = discoveredTags && Object.keys(discoveredTags).length > 0;
  const activeGroupCount = Object.values(tagConfig || {}).filter(c => c?.style && c.style !== 'none').length;

  if (!hasAnyTags) return null;

  return (
    <div 
      className="rounded-xl mb-4 overflow-hidden"
      style={{ 
        background: theme.colors.background.secondary,
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ 
          background: theme.colors.background.tertiary,
          borderBottom: collapsed ? 'none' : `1px solid ${theme.colors.border}`
        }}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🏷️</span>
          <span className="font-bold" style={{ color: theme.colors.text.primary }}>
            Tags & Groups
          </span>
          {activeGroupCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: theme.colors.accents.purple, color: 'white' }}>
              {activeGroupCount} groups
            </span>
          )}
          {hasActiveFilters && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: theme.colors.accents.blue, color: 'white' }}>
              {Object.keys(activeFilters).length} filtered
            </span>
          )}
        </div>
        <span style={{ color: theme.colors.text.tertiary, fontSize: '12px' }}>
          {collapsed ? '▼ Show' : '▲ Hide'}
        </span>
      </div>

      {!collapsed && (
        <div className="p-4">
          {/* Actions row */}
          <div className="flex items-center gap-3 mb-4">
            {hasActiveFilters && (
              <button
                onClick={(e) => { e.stopPropagation(); clearAllFilters(); }}
                className="px-3 py-1.5 rounded text-sm font-medium"
                style={{
                  background: `${theme.colors.accents.red}20`,
                  color: theme.colors.accents.red,
                  border: `1px solid ${theme.colors.accents.red}40`
                }}
              >
                ✕ Clear All Filters
              </button>
            )}
            <div className="flex-1" />
            <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
              Click ○ to cycle group style: ○ None → ▣ Solid → ▢ Dashed → ■ Filled
            </span>
          </div>

          {/* Tags - horizontal layout */}
          <div className="flex flex-wrap gap-6">
            {Object.entries(discoveredTags).map(([category, values]) => (
              <div key={category} className="min-w-[200px]">
                {/* Category header */}
                <div 
                  className="flex items-center gap-2 mb-2 cursor-pointer"
                  onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                >
                  <span style={{ color: theme.colors.text.tertiary, fontSize: '10px' }}>
                    {expandedCategories[category] ? '▼' : '▶'}
                  </span>
                  <span className="font-semibold text-sm capitalize" style={{ color: theme.colors.text.primary }}>
                    {category}
                  </span>
                  <span 
                    className="text-xs px-1.5 rounded"
                    style={{ background: theme.colors.background.tertiary, color: theme.colors.text.tertiary }}
                  >
                    {values.length}
                  </span>
                </div>

                {/* Tag values */}
                {expandedCategories[category] && (
                  <div className="space-y-1 ml-4">
                    {values.map((value) => {
                      const config = getTagValueConfig(category, value);
                      const filterKey = `${category}:${value}`;
                      const isFiltered = activeFilters?.[filterKey];
                      const styleInfo = GROUP_STYLES.find(s => s.id === config.style) || GROUP_STYLES[0];

                      return (
                        <div 
                          key={value}
                          className="flex items-center gap-2 py-1 px-2 rounded"
                          style={{ 
                            background: isFiltered ? `${config.color}15` : 'transparent',
                            border: `1px solid ${isFiltered ? config.color : 'transparent'}`
                          }}
                        >
                          {/* Color picker */}
                          <input
                            type="color"
                            value={config.color}
                            onChange={(e) => updateTagValueConfig(category, value, { color: e.target.value })}
                            className="w-5 h-5 rounded cursor-pointer border-0"
                            style={{ padding: 0 }}
                            title="Change group color"
                          />
                          
                          {/* Tag name */}
                          <span 
                            className="flex-1 text-sm truncate" 
                            style={{ color: theme.colors.text.primary }}
                            title={value}
                          >
                            {value}
                          </span>
                          
                          {/* Group style button */}
                          <button
                            onClick={() => cycleStyle(category, value)}
                            className="w-6 h-6 rounded flex items-center justify-center text-sm"
                            style={{ 
                              color: config.style !== 'none' ? config.color : theme.colors.text.tertiary,
                              background: config.style !== 'none' ? `${config.color}20` : 'transparent',
                              border: `1px solid ${config.style !== 'none' ? config.color : 'transparent'}`
                            }}
                            title={`Group: ${styleInfo.label}. Click to cycle.`}
                          >
                            {styleInfo.icon}
                          </button>
                          
                          {/* Filter button */}
                          <button
                            onClick={() => toggleFilter(category, value)}
                            className="w-6 h-6 rounded flex items-center justify-center"
                            style={{ 
                              color: isFiltered ? config.color : theme.colors.text.tertiary,
                              background: isFiltered ? `${config.color}20` : 'transparent'
                            }}
                            title={isFiltered ? 'Remove filter' : 'Filter to show only this tag'}
                          >
                            {isFiltered ? '🔍' : '◯'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Help */}
          <details className="mt-4 pt-3 border-t text-xs" style={{ borderColor: theme.colors.border, color: theme.colors.text.tertiary }}>
            <summary className="cursor-pointer">💡 How to add tags to your implications</summary>
            <pre className="mt-2 p-3 rounded overflow-x-auto" style={{ background: theme.colors.background.tertiary }}>
{`// In your implication's xstateConfig.meta:
static xstateConfig = {
  meta: {
    status: "pending",
    tags: {
      screen: "BookingScreen",
      flow: "booking-review",
      group: "manager-actions"
    }
  }
};`}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

// Hook for persisting tag config
export function useTagConfig(projectPath) {
  const storageKey = `tagConfig:${projectPath || 'default'}`;
  
  const [tagConfig, setTagConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [activeFilters, setActiveFilters] = useState({});

  useEffect(() => {
    if (projectPath) {
      localStorage.setItem(storageKey, JSON.stringify(tagConfig));
    }
  }, [tagConfig, storageKey, projectPath]);

  return { tagConfig, setTagConfig, activeFilters, setActiveFilters };
}