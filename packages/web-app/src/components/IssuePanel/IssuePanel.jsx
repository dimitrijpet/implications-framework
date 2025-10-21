import { useState } from 'react';
import IssueCard from './IssueCard';

export default function IssuePanel({ analysisResult, theme, onIssueClick }) {
  const [filter, setFilter] = useState('all'); // all, error, warning, info
  const [searchTerm, setSearchTerm] = useState('');
  
  if (!analysisResult || !analysisResult.issues) {
    return null;
  }
  
  const { issues, summary } = analysisResult;
  
  // Filter issues
  const filteredIssues = issues.filter(issue => {
    // Filter by severity
    if (filter !== 'all' && issue.severity !== filter) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        issue.stateName.toLowerCase().includes(searchLower) ||
        issue.title.toLowerCase().includes(searchLower) ||
        issue.message.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });
  
  return (
    <div 
      className="rounded-xl p-6"
      style={{ 
        background: `${theme.colors.background.secondary}80`,
        border: `1px solid ${theme.colors.border}`,
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1" style={{ color: theme.colors.accents.purple }}>
              🔍 Issues Detected
            </h2>
            <p className="text-sm" style={{ color: theme.colors.text.tertiary }}>
              Analysis found {summary.total} issue{summary.total !== 1 ? 's' : ''} in your implications
            </p>
          </div>
          
          {/* Summary Badges */}
          <div className="flex gap-3">
            <div 
              className="px-4 py-2 rounded-lg text-center"
              style={{ 
                background: `${theme.colors.accents.red}20`,
                border: `2px solid ${theme.colors.accents.red}`
              }}
            >
              <div className="text-2xl font-bold" style={{ color: theme.colors.accents.red }}>
                {summary.errors}
              </div>
              <div className="text-xs" style={{ color: theme.colors.text.secondary }}>
                Errors
              </div>
            </div>
            
            <div 
              className="px-4 py-2 rounded-lg text-center"
              style={{ 
                background: `${theme.colors.accents.orange}20`,
                border: `2px solid ${theme.colors.accents.orange}`
              }}
            >
              <div className="text-2xl font-bold" style={{ color: theme.colors.accents.orange }}>
                {summary.warnings}
              </div>
              <div className="text-xs" style={{ color: theme.colors.text.secondary }}>
                Warnings
              </div>
            </div>
            
            <div 
              className="px-4 py-2 rounded-lg text-center"
              style={{ 
                background: `${theme.colors.accents.blue}20`,
                border: `2px solid ${theme.colors.accents.blue}`
              }}
            >
              <div className="text-2xl font-bold" style={{ color: theme.colors.accents.blue }}>
                {summary.info}
              </div>
              <div className="text-xs" style={{ color: theme.colors.text.secondary }}>
                Info
              </div>
            </div>
          </div>
        </div>
        
        {/* Filters and Search */}
        <div className="flex gap-3">
          {/* Filter Buttons */}
          <div className="flex gap-2">
            {['all', 'error', 'warning', 'info'].map(filterType => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className="px-4 py-2 rounded-lg font-semibold transition"
                style={{
                  background: filter === filterType 
                    ? theme.colors.accents.purple 
                    : theme.colors.background.tertiary,
                  color: filter === filterType 
                    ? 'white' 
                    : theme.colors.text.secondary,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                {filterType === 'all' ? '🔍 All' : ''}
                {filterType === 'error' ? '❌ Errors' : ''}
                {filterType === 'warning' ? '⚠️ Warnings' : ''}
                {filterType === 'info' ? 'ℹ️ Info' : ''}
              </button>
            ))}
          </div>
          
          {/* Search */}
          <input
            type="text"
            placeholder="Search issues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg"
            style={{
              background: theme.colors.background.tertiary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text.primary
            }}
          />
        </div>
        
        {/* Results Count */}
        <div className="mt-3 text-sm" style={{ color: theme.colors.text.tertiary }}>
          Showing {filteredIssues.length} of {issues.length} issues
        </div>
      </div>
      
      {/* Issues List */}
      <div className="space-y-3">
        {filteredIssues.length > 0 ? (
          filteredIssues.map((issue, index) => (
            <IssueCard 
              key={index}
              issue={issue}
              theme={theme}
              onClick={() => onIssueClick && onIssueClick(issue)}
            />
          ))
        ) : (
          <div 
            className="text-center py-12"
            style={{ color: theme.colors.text.tertiary }}
          >
            {searchTerm ? (
              <>
                🔍 No issues match "{searchTerm}"
              </>
            ) : (
              <>
                ✅ No {filter} issues found
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}