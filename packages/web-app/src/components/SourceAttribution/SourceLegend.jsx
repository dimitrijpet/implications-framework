import React from 'react';

/**
 * SourceLegend
 * 
 * Displays a legend explaining the source attribution colors
 */
export default function SourceLegend({ theme }) {
  const legendItems = [
    {
      icon: '🟣',
      label: 'Base Class',
      description: 'Inherited from base (alwaysVisible, sometimesVisible)',
      color: theme.colors.accents.purple
    },
    {
      icon: '🟢',
      label: 'Override',
      description: 'Defined in this implication (child override)',
      color: theme.colors.accents.green
    },
    {
      icon: '🔵',
      label: 'Behavior',
      description: 'Composed from another implication',
      color: theme.colors.accents.blue
    }
  ];
  
  return (
    <div 
      className="p-4 rounded-lg"
      style={{
        background: `${theme.colors.background.tertiary}20`,
        border: `1px solid ${theme.colors.border}`
      }}
    >
      <h4 
        className="text-sm font-semibold mb-3"
        style={{ color: theme.colors.text.secondary }}
      >
        📖 Element Source Legend
      </h4>
      
      <div className="space-y-2">
        {legendItems.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-lg">{item.icon}</span>
            <div className="flex-1">
              <div 
                className="font-medium text-sm"
                style={{ color: item.color }}
              >
                {item.label}
              </div>
              <div 
                className="text-xs"
                style={{ color: theme.colors.text.tertiary }}
              >
                {item.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}