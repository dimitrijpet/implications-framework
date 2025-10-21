import { useState } from 'react';

export default function IssueCard({ issue, theme, onClick }) {
  const [expanded, setExpanded] = useState(false);
  
  const severityConfig = {
    error: {
      icon: '❌',
      color: theme.colors.accents.red,
      bgColor: `${theme.colors.accents.red}10`,
      borderColor: theme.colors.accents.red
    },
    warning: {
      icon: '⚠️',
      color: theme.colors.accents.orange,
      bgColor: `${theme.colors.accents.orange}10`,
      borderColor: theme.colors.accents.orange
    },
    info: {
      icon: 'ℹ️',
      color: theme.colors.accents.blue,
      bgColor: `${theme.colors.accents.blue}10`,
      borderColor: theme.colors.accents.blue
    }
  };
  
  const config = severityConfig[issue.severity] || severityConfig.info;
  
  return (
    <div
      className="rounded-lg p-4 transition cursor-pointer"
      style={{
        background: config.bgColor,
        border: `2px solid ${config.borderColor}`,
        borderLeft: `6px solid ${config.borderColor}`
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Severity Badge & Title */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <div className="font-bold text-lg" style={{ color: theme.colors.text.primary }}>
                {issue.title}
              </div>
              <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                in <span className="font-mono font-semibold">{issue.stateName}</span>
              </div>
            </div>
          </div>
          
          {/* Message */}
          <p className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
            {issue.message}
          </p>
          
          {/* Affected Fields */}
          {issue.affectedFields && issue.affectedFields.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {issue.affectedFields.map((field, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 rounded text-xs font-mono"
                  style={{
                    background: theme.colors.background.tertiary,
                    color: theme.colors.text.secondary,
                    border: `1px solid ${theme.colors.border}`
                  }}
                >
                  {field}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* Expand Button */}
        <button
          className="ml-4 px-3 py-1 rounded text-sm font-semibold"
          style={{
            background: theme.colors.background.tertiary,
            color: theme.colors.text.secondary,
            border: `1px solid ${theme.colors.border}`
          }}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? '▲ Less' : '▼ More'}
        </button>
      </div>
      
      {/* Expanded Details */}
      {expanded && issue.suggestions && issue.suggestions.length > 0 && (
        <div 
          className="mt-4 pt-4"
          style={{ borderTop: `1px solid ${config.borderColor}40` }}
        >
          <div className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
            💡 Suggestions:
          </div>
          
          <div className="space-y-2">
            {issue.suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="p-3 rounded"
                style={{
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                <div className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                  {suggestion.title}
                  {suggestion.autoFixable && (
                    <span 
                      className="ml-2 px-2 py-0.5 rounded text-xs"
                      style={{
                        background: theme.colors.accents.green,
                        color: 'white'
                      }}
                    >
                      ⚡ Auto-fixable
                    </span>
                  )}
                </div>
                <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  {suggestion.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* File Location */}
      {issue.location && (
        <div 
          className="mt-3 text-xs font-mono"
          style={{ 
            color: theme.colors.text.tertiary,
            opacity: 0.7
          }}
        >
          📄 {issue.location}
        </div>
      )}
    </div>
  );
}