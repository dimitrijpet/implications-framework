import React from 'react';

/**
 * SourceAttributionBadge
 * 
 * Shows where an element comes from with color coding:
 * - Purple: Base class (alwaysVisible, sometimesVisible)
 * - Green: Child override
 * - Blue: Behavior composition
 */
export default function SourceAttributionBadge({ source, theme }) {
  if (!source) return null;
  
  // Determine color based on category
  const getColor = () => {
    if (source.category === 'base') {
      return theme.colors.accents.purple;
    } else if (source.category === 'child') {
      return theme.colors.accents.green;
    } else if (source.category === 'behavior') {
      return theme.colors.accents.blue;
    }
    return theme.colors.text.tertiary;
  };
  
  // Get label text
  const getLabel = () => {
    if (source.category === 'base') {
      return `${source.source}`;
    } else if (source.category === 'child') {
      return 'Override';
    } else if (source.category === 'behavior') {
      return source.source;
    }
    return 'Unknown';
  };
  
  // Get icon
  const getIcon = () => {
    if (source.category === 'base') return '🟣';
    if (source.category === 'child') return '🟢';
    if (source.category === 'behavior') return '🔵';
    return '⚪';
  };
  
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: `${getColor()}20`,
        color: getColor(),
        border: `1px solid ${getColor()}40`
      }}
      title={`Source: ${source.source} | Type: ${source.type}`}
    >
      <span>{getIcon()}</span>
      <span>{getLabel()}</span>
    </span>
  );
}