import React from 'react';
import SourceAttributionBadge from './SourceAttributionBadge';

/**
 * ElementList
 * 
 * Displays a list of UI elements with source attribution badges
 * 
 * Props:
 * - elements: Array of element names (e.g., ['btn1', 'btn2'])
 * - sourceInfo: Object mapping element names to source data
 * - title: Section title (e.g., "Visible Elements")
 * - icon: Emoji icon for the section
 * - color: Theme color for the section
 * - theme: Theme object
 * - emptyMessage: Message to show when no elements
 */
export default function ElementList({ 
  elements = [], 
  sourceInfo = {},
  title,
  icon = '📋',
  color,
  theme,
  emptyMessage = 'No elements'
}) {
  if (!elements || elements.length === 0) {
    return (
      <div className="p-4 rounded-lg" style={{ 
        background: `${theme.colors.background.tertiary}40`,
        border: `1px solid ${theme.colors.border}`
      }}>
        <h4 className="font-bold mb-2" style={{ color }}>
          {icon} {title} (0)
        </h4>
        <div className="text-sm" style={{ color: theme.colors.text.tertiary }}>
          {emptyMessage}
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 rounded-lg" style={{ 
      background: `${theme.colors.background.tertiary}40`,
      border: `1px solid ${theme.colors.border}`
    }}>
      <h4 className="font-bold mb-3" style={{ color }}>
        {icon} {title} ({elements.length})
      </h4>
      
      <div className="space-y-2">
        {elements.map((element, index) => {
          const source = sourceInfo[element];
          
          return (
            <div 
              key={index}
              className="flex items-center justify-between p-2 rounded"
              style={{
                background: theme.colors.background.secondary,
                border: `1px solid ${theme.colors.border}`
              }}
            >
              <span 
                className="font-mono text-sm"
                style={{ color: theme.colors.text.primary }}
              >
                {element}
              </span>
              
              <SourceAttributionBadge source={source} theme={theme} />
            </div>
          );
        })}
      </div>
    </div>
  );
}