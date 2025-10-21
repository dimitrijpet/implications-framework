// packages/web-app/src/components/IssuePanel/IssueCard.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function IssueCard({ issue, theme, onActionComplete }) {
  const [expanded, setExpanded] = useState(false);
  const [executing, setExecuting] = useState(false);
  const navigate = useNavigate();
  
  // Handle suggestion click
  const handleSuggestionClick = async (suggestion) => {
    setExecuting(true);
    
    try {
      console.log('🔧 Executing suggestion:', suggestion.action, suggestion.data);
      
      switch (suggestion.action) {
        // Config mutations
        case 'add-mapping':
          await handleAddMapping(suggestion.data);
          break;
          
        case 'add-prefix':
          await handleAddPrefix(suggestion.data);
          break;
          
        // Navigation
        case 'check-registry':
          navigate('/settings');
          return;
          
        // File mutations
        case 'use-base-directly':
          await handleUseBaseDirectly(suggestion.data);
          break;
          
        case 'add-transition':
          alert('➕ Add Transition\n\nThis will open a transition editor.\n\nComing in next phase!');
          return;
          
        case 'add-outgoing':
          alert('➕ Add Outgoing Transitions\n\nThis will open a transition editor.\n\nComing in next phase!');
          return;
          
        case 'remove-state':
          await handleRemoveState(suggestion.data);
          break;
          
        case 'add-overrides':
          alert('✏️ Add Meaningful Overrides\n\nThis will open the state editor.\n\nComing in next phase!');
          return;
          
        default:
          console.warn('Unknown action:', suggestion.action);
          alert(`Action "${suggestion.action}" is not yet implemented.\n\nComing soon!`);
          return;
      }
      
      // Notify parent that action completed
      if (onActionComplete) {
        onActionComplete(suggestion.action);
      }
      
    } catch (error) {
      console.error('❌ Action failed:', error);
      if (error.message !== 'Cancelled') {
        alert(`Failed: ${error.message}`);
      }
    } finally {
      setExecuting(false);
    }
  };
  
  // Add custom mapping to config
  const handleAddMapping = async (data) => {
    const { targetName, suggestedMapping } = data;
    
    const shortName = prompt(
      `Add mapping for "${targetName}".\n\nShort name:`, 
      targetName
    );
    if (!shortName) throw new Error('Cancelled');
    
    const fullName = prompt(
      'Full class name:', 
      suggestedMapping || `${capitalize(shortName)}Implications`
    );
    if (!fullName) throw new Error('Cancelled');
    
    console.log(`📝 Adding mapping: "${shortName}" → "${fullName}"`);
    
    // Call API to add mapping
    const response = await fetch('http://localhost:3000/api/config/add-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: localStorage.getItem('lastProjectPath'),
        shortName,
        fullName
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ API response:', result);
  };
  
  // Add prefix to config
  const handleAddPrefix = async (data) => {
    const { targetName } = data;
    
    const prefix = prompt(
      `Add status prefix for "${targetName}".\n\nPrefix:`, 
      capitalize(targetName)
    );
    if (!prefix) throw new Error('Cancelled');
    
    console.log(`📝 Adding prefix: "${prefix}"`);
    
    // Call API to add prefix
    const response = await fetch('http://localhost:3000/api/config/add-prefix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: localStorage.getItem('lastProjectPath'),
        prefix
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ API response:', result);
  };
  
// packages/web-app/src/components/IssuePanel/IssueCard.jsx
// Replace the handleUseBaseDirectly function:

const handleUseBaseDirectly = async (data) => {
  const { className, platform, screen } = data;
  
  // Extract filePath from issue.location (format: "path/to/file.js:line:col")
  let filePath = data.filePath;
  if (!filePath && issue.location) {
    filePath = issue.location.split(':')[0];
  }
  
  if (!filePath) {
    throw new Error('Cannot determine file path for this state');
  }
  
  // Make path absolute by prepending project path
  const projectPath = localStorage.getItem('lastProjectPath');
  const absolutePath = filePath.startsWith('/') ? filePath : `${projectPath}/${filePath}`;
  
  console.log('📍 Paths:', { relative: filePath, absolute: absolutePath, projectPath });
  
  const confirm = window.confirm(
    `Remove override for ${platform}.${screen}?\n\n` +
    `This will change the code to use the base implementation directly.\n\n` +
    `Class: ${className || issue.stateName}\n` +
    `File: ${filePath}\n\n` +
    `A backup will be created automatically.`
  );
  
  if (!confirm) throw new Error('Cancelled');
  
  console.log(`📝 Removing override: ${platform}.${screen}`);
  console.log(`📂 File: ${absolutePath}`);
  
  // Call API to remove override
  const response = await fetch('http://localhost:3000/api/implications/use-base-directly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath: absolutePath,  // Send absolute path
      platform,
      screen
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  const result = await response.json();
  console.log('✅ API response:', result);
  console.log('📦 Backup created:', result.backup);
};
  // Remove isolated state (comment out file)
  const handleRemoveState = async (data) => {
    const { className, filePath } = data;
    
    const confirm = window.confirm(
      `Are you sure you want to comment out ${className}?\n\n` +
      `This will add a comment block around the entire file.\n\n` +
      `File: ${filePath}\n` +
      `A backup will be created automatically.`
    );
    
    if (!confirm) throw new Error('Cancelled');
    
    console.log(`🗑️ Commenting out: ${className}`);
    
    // Call API to comment out file
    const response = await fetch('http://localhost:3000/api/implications/remove-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ API response:', result);
    console.log('📦 Backup created:', result.backup);
  };
  
  // Helper
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
  
  // Get severity styling
  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'error':
        return { bg: '#dc2626', text: '#fff' };
      case 'warning':
        return { bg: '#f59e0b', text: '#000' };
      case 'info':
        return { bg: '#3b82f6', text: '#fff' };
      default:
        return { bg: theme.colors.background.tertiary, text: theme.colors.text.primary };
    }
  };

  const style = getSeverityStyle(issue.severity);

  return (
    <div 
      className="rounded-lg p-4 mb-3"
      style={{ 
        background: theme.colors.background.secondary,
        border: `2px solid ${style.bg}`
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3 flex-1">
          {/* Severity Badge */}
          <span 
            className="px-3 py-1 rounded-full text-xs font-bold uppercase"
            style={{ background: style.bg, color: style.text }}
          >
            {issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}
            {' '}
            {issue.severity}
          </span>
          
          {/* Title */}
          <div className="flex-1">
            <h3 className="font-bold text-lg" style={{ color: theme.colors.text.primary }}>
              {issue.title}
            </h3>
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              in {issue.stateName}
            </p>
          </div>
        </div>
        
        {/* Expand Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1 rounded text-sm font-medium transition-colors hover:brightness-90"
          style={{ 
            background: theme.colors.background.tertiary,
            color: theme.colors.text.primary 
          }}
        >
          {expanded ? '▼ Less' : '▶ More'}
        </button>
      </div>

      {/* Message */}
      <p className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
        {issue.message}
      </p>

      {/* Expanded Content */}
      {expanded && (
        <div 
          className="mt-4 p-4 rounded-lg"
          style={{ background: theme.colors.background.tertiary }}
        >
          {/* Suggestions */}
          {issue.suggestions && issue.suggestions.length > 0 && (
            <div className="mb-4">
              <h4 className="font-bold mb-2" style={{ color: theme.colors.text.primary }}>
                💡 Suggestions
              </h4>
              <div className="space-y-2">
                {issue.suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg"
                    style={{ background: theme.colors.background.secondary }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h5 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                          {suggestion.title}
                        </h5>
                        <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                          {suggestion.description}
                        </p>
                      </div>
                      
                      {/* Action Button */}
                      <button
                        onClick={() => handleSuggestionClick(suggestion)}
                        disabled={executing}
                        className="px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap disabled:opacity-50 hover:brightness-110"
                        style={{ 
                          background: theme.colors.accents.blue,
                          color: '#fff',
                          cursor: executing ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {executing ? '⏳' : suggestion.autoFixable ? '⚡' : '🔧'} 
                        {' '}
                        {executing ? 'Working...' : 'Apply'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          {issue.details && Object.keys(issue.details).length > 0 && (
            <div>
              <h4 className="font-bold mb-2" style={{ color: theme.colors.text.primary }}>
                📋 Details
              </h4>
              <div className="space-y-1">
                {Object.entries(issue.details).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-sm">
                    <span className="font-medium" style={{ color: theme.colors.text.secondary }}>
                      {key}:
                    </span>
                    <span className="font-mono" style={{ color: theme.colors.text.primary }}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Location */}
          {issue.location && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: theme.colors.border }}>
              <p className="text-xs font-mono" style={{ color: theme.colors.text.tertiary }}>
                📄 {issue.location}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}