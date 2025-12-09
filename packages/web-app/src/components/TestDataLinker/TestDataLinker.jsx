// packages/web-app/src/components/TestDataLinker/TestDataLinker.jsx

import { useState, useEffect } from 'react';
import { FileJson, Search, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';

/**
 * TestDataLinker - Link master testData file and get intelligent field suggestions
 * 
 * Phase 1 of Intelligence System
 * 
 * Usage:
 *   <TestDataLinker 
 *     stateName="search_results"
 *     projectPath={projectPath}
 *     onFieldsSelected={handleFields}
 *   />
 */
export default function TestDataLinker({ 
  stateName, 
  projectPath,
  implicationPath,  // NEW: Path to implication file for persistence
  theme,
  onFieldsSelected,
  onAnalysisComplete,
  existingContext = {}
}) {
  const [testDataPath, setTestDataPath] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validating, setValidating] = useState(false);
  const [isValid, setIsValid] = useState(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  
  // Debug: Log props on mount
  console.log('🎯 TestDataLinker mounted with props:', {
    stateName,
    projectPath,
    implicationPath,
    hasTheme: !!theme,
    hasOnFieldsSelected: !!onFieldsSelected,
    hasOnAnalysisComplete: !!onAnalysisComplete
  });
  
  // NEW: Auto-load saved testData path on mount
  useEffect(() => {
    if (implicationPath) {
      loadSavedTestDataPath();
    }
  }, [implicationPath]);
  
 
  /**
   * Load saved testData path from implication file metadata
   */
  const loadSavedTestDataPath = async () => {
    if (!implicationPath) return;
    
    setLoadingLink(true);
    
    try {
      const response = await fetch(
        `/api/test-data/load-link?implicationPath=${encodeURIComponent(implicationPath)}`
      );
      const result = await response.json();
      
      if (result.success && result.testDataPath) {
        console.log('📂 Loaded saved testData path:', result.testDataPath);
        setTestDataPath(result.testDataPath);
        // Auto-validate the loaded path
        validatePath(result.testDataPath);
      }
    } catch (err) {
      console.error('❌ Error loading saved path:', err);
    } finally {
      setLoadingLink(false);
    }
  };
  
  /**
   * Save testData path to implication file metadata
   */
  const saveTestDataLink = async (pathToSave) => {
    if (!implicationPath || !pathToSave) return;
    
    setSavingLink(true);
    
    try {
      const relativePath = convertToRelativePath(pathToSave, projectPath);
      
      const response = await fetch('/api/test-data/save-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          implicationPath,
          testDataPath: relativePath
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('💾 Saved testData link:', relativePath);
      } else {
        console.error('❌ Failed to save link:', result.error);
      }
    } catch (err) {
      console.error('❌ Error saving link:', err);
    } finally {
      setSavingLink(false);
    }
  };
  
  /**
   * Validate testData file exists and is valid JSON
   */
  const validatePath = async (path) => {
    if (!path) {
      setIsValid(null);
      return;
    }
    
    setValidating(true);
    
    try {
      // Convert absolute path to relative if needed
      const relativePath = convertToRelativePath(path, projectPath);
      
      const response = await fetch(
        `/api/test-data/validate?testDataPath=${encodeURIComponent(relativePath)}&projectPath=${encodeURIComponent(projectPath)}`
      );
      const result = await response.json();
      
      setIsValid(result.valid);
      
      if (!result.exists) {
        setError('File not found');
      } else if (!result.valid) {
        setError('Invalid JSON file');
      } else {
        setError(null);
      }
    } catch (err) {
      setIsValid(false);
      setError('Failed to validate file');
    } finally {
      setValidating(false);
    }
  };
  
  /**
   * Convert absolute path to relative path if needed
   */
  const convertToRelativePath = (path, projectPath) => {
    // Already relative
    if (!path.startsWith('/')) {
      return path;
    }
    
    // Normalize projectPath (remove trailing slash)
    const normalizedProject = projectPath.replace(/\/+$/, '');
    
    // If path starts with projectPath, make it relative
    if (path.startsWith(normalizedProject)) {
      const relative = path.substring(normalizedProject.length).replace(/^\/+/, '');
      console.log('🔄 Converted path:', { 
        absolute: path, 
        projectPath: normalizedProject,
        relative 
      });
      return relative;
    }
    
    // Otherwise return as-is and let backend handle it
    console.log('⚠️ Path does not start with projectPath:', {
      path,
      projectPath: normalizedProject
    });
    return path;
  };
  
  /**
   * Analyze testData file and get suggestions
   * Uses combined intelligence when implicationPath is available
   */
  const analyzeTestData = async () => {
    if (!testDataPath) {
      setError('Please enter a testData file path');
      return;
    }
    
    if (!stateName) {
      setError('State name is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Convert absolute path to relative if needed
      const relativePath = convertToRelativePath(testDataPath, projectPath);
      
      // Use combined analysis if implicationPath available, otherwise basic analysis
      const endpoint = '/api/test-data/analyze'; 
      
      console.log(`🔍 Analyzing testData with ${implicationPath ? 'COMBINED' : 'BASIC'} intelligence:`, {
        testDataPath: relativePath,
        stateName,
        implicationPath,
        projectPath
      });
      
      const body = implicationPath ? {
        testDataPath: relativePath,
        stateName,
        implicationPath,
        projectPath
      } : {
        testDataPath: relativePath,
        stateName,
        projectPath
      };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }
      
      console.log('✅ Analysis complete:', result.meta);
      
      if (result.meta.boostedMatches) {
        console.log(`  ⬆️ ${result.meta.boostedMatches} fields boosted by UI analysis!`);
      }
      
      // Store the whole result (includes analysis and meta)
      setAnalysis(result);
      
      // Save testData link to implication file
      await saveTestDataLink(testDataPath);
      
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }
      
    } catch (err) {
      console.error('❌ Analysis error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Handle path input change with debounced validation
   */
  const handlePathChange = (e) => {
    const path = e.target.value;
    setTestDataPath(path);
    
    // Debounce validation
    if (window.validateTimeout) {
      clearTimeout(window.validateTimeout);
    }
    
    window.validateTimeout = setTimeout(() => {
      validatePath(path);
    }, 500);
  };
  
  return (
    <div className="test-data-linker space-y-4">
      
      {/* ========================================
          INPUT SECTION
          ======================================== */}
      <div className="border rounded-lg p-4" style={{ 
        background: theme.colors.background.primary,
        borderColor: theme.colors.background.tertiary 
      }}>
        <div className="flex items-center gap-2 mb-3">
          <FileJson className="w-5 h-5" style={{ color: theme.colors.accents.blue }} />
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
            Link Master TestData File
          </h3>
        </div>
        
        <div className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
          Link your master testData file to get intelligent field suggestions based on what data is available.
        </div>
        
        {/* Path Input */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={testDataPath}
                onChange={handlePathChange}
                placeholder="tests/data/your-test-master.json"
                className="w-full px-3 py-2 rounded border font-mono text-sm"
                style={{ 
                  background: theme.colors.background.secondary,
                  borderColor: error ? theme.colors.accents.red : 
                              isValid ? theme.colors.accents.green :
                              theme.colors.background.tertiary,
                  color: theme.colors.text.primary
                }}
              />
              
              {/* Validation Indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validating && (
                  <div className="animate-spin w-4 h-4 border-2 border-t-transparent rounded-full"
                       style={{ borderColor: theme.colors.accents.blue }} />
                )}
                {!validating && isValid === true && (
                  <CheckCircle className="w-4 h-4" style={{ color: theme.colors.accents.green }} />
                )}
                {!validating && isValid === false && (
                  <AlertCircle className="w-4 h-4" style={{ color: theme.colors.accents.red }} />
                )}
              </div>
            </div>
            
            <button
              onClick={analyzeTestData}
              disabled={loading || !testDataPath || isValid === false}
              className="px-4 py-2 rounded font-medium flex items-center gap-2 disabled:opacity-50"
              style={{ 
                background: theme.colors.accents.blue,
                color: '#ffffff'
              }}
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-t-transparent rounded-full" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Analyze & Suggest
                </>
              )}
            </button>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="text-sm p-2 rounded flex items-center gap-2" style={{ 
              background: `${theme.colors.accents.red}10`,
              color: theme.colors.accents.red 
            }}>
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          {/* Validation Success */}
          {isValid && !error && (
            <div className="text-sm" style={{ color: theme.colors.accents.green }}>
              ✓ Valid testData file found
            </div>
          )}
        </div>
      </div>
      
      {/* ========================================
          ANALYSIS RESULTS
          ======================================== */}
      {analysis && (
        <AnalysisResults 
          analysis={analysis}
          theme={theme}
          onFieldsSelected={onFieldsSelected}
          existingContext={existingContext}
        />
      )}
    </div>
  );
}

/**
 * AnalysisResults - Display suggestions from testData analysis
 */
function AnalysisResults({ analysis, theme, onFieldsSelected, existingContext = {} }) {
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [showAllFields, setShowAllFields] = useState(false);
  
  // The API returns analysis and meta separately
  // analysis.analysis contains the actual analysis data
  const actualAnalysis = analysis.analysis || analysis;
  const { suggestions, keywords } = actualAnalysis;
  
  // meta might be in analysis.meta or at root level
  const meta = analysis.meta || {
    totalFields: 0,
    exactMatches: 0,
    requiredFields: 0,
    availableFields: 0,
    highConfidenceCount: 0
  };
  
  // Combine all suggestions
  const allSuggestions = [
    ...suggestions.exact,
    ...suggestions.required,
    ...suggestions.available
  ].sort((a, b) => b.confidence - a.confidence);
  
  // Filter out fields that already exist in context
  const existingFieldNames = Object.keys(existingContext || {});
  const newSuggestions = allSuggestions.filter(s => !existingFieldNames.includes(s.field));
  const alreadyExisting = allSuggestions.filter(s => existingFieldNames.includes(s.field));
  
  // Split into high and low confidence
  const highConfidence = newSuggestions.filter(s => s.confidence >= 70);
  const lowConfidence = newSuggestions.filter(s => s.confidence < 70);
  
  const toggleField = (fieldName) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldName)) {
      newSelected.delete(fieldName);
    } else {
      newSelected.add(fieldName);
    }
    setSelectedFields(newSelected);
  };
  
  const selectAllHighConfidence = () => {
    setSelectedFields(new Set(highConfidence.map(s => s.field)));
  };
  
  const handleAddSelected = () => {
    const fields = newSuggestions.filter(s => selectedFields.has(s.field));
    if (onFieldsSelected) {
      onFieldsSelected(fields);
    }
  };
  
  return (
    <div className="space-y-4">
      
      {/* Summary */}
      <div className="border rounded-lg p-4" style={{ 
        background: `${theme.colors.accents.blue}10`,
        borderColor: theme.colors.accents.blue 
      }}>
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 mt-0.5" style={{ color: theme.colors.accents.blue }} />
          <div className="flex-1">
            <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
              {meta.boostedMatches ? '🧠 Super-Intelligent Analysis Complete' : 'Analysis Complete'}
            </h4>
            <div className="text-sm space-y-1" style={{ color: theme.colors.text.secondary }}>
              <div>Found <span className="font-semibold">{meta.totalFields}</span> fields in testData</div>
              <div>Keywords extracted: {keywords.map(k => `"${k}"`).join(', ')}</div>
              
              {meta.uiVariables > 0 && (
                <div style={{ color: theme.colors.accents.purple }}>
                  + <span className="font-semibold">{meta.uiVariables}</span> UI variables detected
                </div>
              )}
              
              {meta.boostedMatches > 0 && (
                <div style={{ color: theme.colors.accents.green }}>
                  ⬆️ <span className="font-semibold">{meta.boostedMatches}</span> fields confidence-boosted!
                </div>
              )}
              
              <div className="flex flex-wrap gap-4 mt-2">
                {meta.superHighConfidenceCount > 0 && (
                  <span style={{ color: theme.colors.accents.purple }}>
                    {meta.superHighConfidenceCount} super-high (95%+)
                  </span>
                )}
                <span style={{ color: theme.colors.accents.green }}>
                  {highConfidence.length} new high-confidence
                </span>
                <span style={{ color: theme.colors.text.tertiary }}>
                  {lowConfidence.length} other available
                </span>
                {alreadyExisting.length > 0 && (
                  <span style={{ color: theme.colors.accents.blue }}>
                    {alreadyExisting.length} already in context ✓
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Already Existing Fields */}
      {alreadyExisting.length > 0 && (
        <div className="border rounded-lg p-4" style={{ 
          background: `${theme.colors.accents.blue}05`,
          borderColor: theme.colors.background.tertiary 
        }}>
          <div className="text-sm font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
            ✓ Already in Context ({alreadyExisting.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {alreadyExisting.map(s => (
              <span 
                key={s.field}
                className="px-2 py-1 rounded text-xs font-mono"
                style={{ 
                  background: `${theme.colors.accents.blue}20`,
                  color: theme.colors.accents.blue 
                }}
              >
                {s.field} ✓
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* New Suggestions */}
      {newSuggestions.length > 0 ? (
        <div className="border rounded-lg overflow-hidden" style={{ 
          borderColor: theme.colors.background.tertiary 
        }}>
          <div className="flex items-center justify-between p-3" style={{ 
            background: theme.colors.background.primary 
          }}>
            <h4 className="font-semibold" style={{ color: theme.colors.text.primary }}>
              💡 Suggested Fields
            </h4>
            <div className="flex gap-2">
              {highConfidence.length > 0 && (
                <button
                  onClick={selectAllHighConfidence}
                  className="text-sm px-3 py-1 rounded"
                  style={{ 
                    background: `${theme.colors.accents.green}20`,
                    color: theme.colors.accents.green 
                  }}
                >
                  Select All High-Confidence ({highConfidence.length})
                </button>
              )}
              <button
                onClick={handleAddSelected}
                disabled={selectedFields.size === 0}
                className="text-sm px-3 py-1 rounded font-medium disabled:opacity-50"
                style={{ 
                  background: theme.colors.accents.blue,
                  color: '#ffffff'
                }}
              >
                Add {selectedFields.size} Selected
              </button>
            </div>
          </div>
          
          {/* High Confidence Fields */}
          {highConfidence.length > 0 && (
            <div>
              <div className="px-3 py-2" style={{ 
                background: `${theme.colors.accents.green}10`,
                borderBottom: `1px solid ${theme.colors.background.tertiary}`
              }}>
                <span className="text-xs font-semibold" style={{ color: theme.colors.accents.green }}>
                  ⭐ HIGH CONFIDENCE ({highConfidence.length})
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: theme.colors.background.tertiary }}>
                {highConfidence.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.field}
                    suggestion={suggestion}
                    theme={theme}
                    selected={selectedFields.has(suggestion.field)}
                    onToggle={() => toggleField(suggestion.field)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Low Confidence Fields (Collapsible) */}
          {lowConfidence.length > 0 && (
            <div>
              <button
                onClick={() => setShowAllFields(!showAllFields)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-opacity-50 transition"
                style={{ 
                  background: `${theme.colors.background.tertiary}50`,
                  borderTop: `1px solid ${theme.colors.background.tertiary}`
                }}
              >
                <span className="text-xs font-semibold" style={{ color: theme.colors.text.secondary }}>
                  📋 OTHER AVAILABLE FIELDS ({lowConfidence.length})
                </span>
                <span style={{ color: theme.colors.text.tertiary }}>
                  {showAllFields ? '▼' : '▶'}
                </span>
              </button>
              
              {showAllFields && (
                <div className="divide-y" style={{ borderColor: theme.colors.background.tertiary }}>
                  {lowConfidence.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.field}
                      suggestion={suggestion}
                      theme={theme}
                      selected={selectedFields.has(suggestion.field)}
                      onToggle={() => toggleField(suggestion.field)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-6 text-center" style={{ 
          background: `${theme.colors.accents.green}10`,
          borderColor: theme.colors.accents.green 
        }}>
          <div className="text-lg font-semibold mb-2" style={{ color: theme.colors.accents.green }}>
            ✓ All Suggested Fields Already Added!
          </div>
          <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
            Your context already includes all high-confidence fields from testData.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SuggestionCard - Individual field suggestion
 */
function SuggestionCard({ suggestion, theme, selected, onToggle }) {
  const { field, value, reason, confidence } = suggestion;
  
  const confidenceColor = 
    confidence >= 70 ? theme.colors.accents.green :
    confidence >= 50 ? theme.colors.accents.blue :
    theme.colors.text.tertiary;
  
  const confidenceLabel = 
    confidence >= 70 ? 'High' :
    confidence >= 50 ? 'Medium' :
    'Low';
  
  return (
    <div 
      className="p-3 flex items-center gap-3 hover:bg-opacity-50 cursor-pointer transition"
      style={{ background: selected ? `${theme.colors.accents.blue}10` : 'transparent' }}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4"
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Field Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono font-semibold" style={{ color: theme.colors.text.primary }}>
            {field}
          </span>
          <span 
            className="text-xs px-2 py-0.5 rounded font-medium"
            style={{ 
              background: `${confidenceColor}20`,
              color: confidenceColor 
            }}
          >
            {confidenceLabel} ({confidence}%)
          </span>
        </div>
        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {reason}
        </div>
        {value !== null && value !== undefined && (
          <div className="text-xs font-mono mt-1 p-1 rounded inline-block" style={{ 
            background: theme.colors.background.tertiary,
            color: theme.colors.text.tertiary 
          }}>
            Current value: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </div>
        )}
      </div>
    </div>
  );
}