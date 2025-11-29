// packages/web-app/src/components/UIScreenEditor/FunctionCallContent.jsx
// Enhanced Function Call block with POM autocomplete
//
// Features:
// - Instance dropdown with POM search
// - Method dropdown filtered by selected instance/POM
// - storeAs suggestions from method return keys
// - Live code preview

import { useState, useEffect, useMemo } from 'react';
import AutocompleteInput from './AutocompleteInput';
import usePOMData from '../../hooks/usePOMData';

/**
 * FunctionCallContent - Enhanced with POM integration
 * 
 * Props:
 * - block: The block object
 * - editMode: Whether editing is enabled
 * - theme: Theme object
 * - onUpdate: (updates) => void
 * - pomName: Current screen's POM (for default instance)
 * - projectPath: Project path for API calls
 * - storedVariables: Available stored variables (for future args support)
 */
export default function FunctionCallContent({ 
  block, 
  editMode, 
  theme, 
  onUpdate, 
  pomName,
  projectPath,
  storedVariables = []
}) {
  const data = block.data || {};
  
  // Load POM data
  const { 
    poms, 
    loading: pomsLoading,
    getPOMFunctions,
    getMethodReturnKeys 
  } = usePOMData(projectPath);

  // Local state for method suggestions
  const [methodSuggestions, setMethodSuggestions] = useState([]);
  const [returnKeys, setReturnKeys] = useState([]);

  // Transform POMs to autocomplete options
  const instanceOptions = useMemo(() => {
    return poms.map(pom => ({
      value: pom.name,
      label: pom.displayName || pom.name,
      description: pom.path,
      icon: '📦'
    }));
  }, [poms]);

  // Update method suggestions when instance changes
  useEffect(() => {
    if (data.instance) {
      // Find the POM that matches the instance
      const matchingPOM = poms.find(p => 
        p.name === data.instance ||
        p.name.includes(data.instance) ||
        data.instance.includes(p.name)
      );
      
      if (matchingPOM) {
        const functions = getPOMFunctions(matchingPOM.name);
        setMethodSuggestions(functions.map(fn => ({
          value: fn.name,
          label: fn.name,
          description: fn.signature,
          async: fn.async,
          returns: fn.returns
        })));
      } else {
        // Try to match by screen's pomName
        if (pomName) {
          const functions = getPOMFunctions(pomName);
          setMethodSuggestions(functions.map(fn => ({
            value: fn.name,
            label: fn.name,
            description: fn.signature,
            async: fn.async,
            returns: fn.returns
          })));
        }
      }
    }
  }, [data.instance, poms, pomName, getPOMFunctions]);

  // Update return keys when method changes
  useEffect(() => {
    if (data.instance && data.method) {
      const keys = getMethodReturnKeys(data.instance, data.method);
      setReturnKeys(keys);
    } else {
      setReturnKeys([]);
    }
  }, [data.instance, data.method, getMethodReturnKeys]);

  // Update handler
  const updateData = (key, value) => {
    onUpdate({
      data: { ...data, [key]: value }
    });
  };

  // Handle instance selection
  const handleInstanceSelect = (option) => {
    updateData('instance', option.value);
    // Clear method when instance changes
    if (data.method) {
      onUpdate({
        data: { ...data, instance: option.value, method: '' }
      });
    }
  };

  // Handle method selection
  const handleMethodSelect = (option) => {
    updateData('method', option.value);
    // Auto-enable await for async methods
    if (option.async && !data.await) {
      onUpdate({
        data: { ...data, method: option.value, await: true }
      });
    }
  };

  // storeAs options from return keys
  const storeAsOptions = useMemo(() => {
    if (returnKeys.length === 0) return [];
    
    // Suggest variable names based on return keys
    return [
      // Suggest the raw method result
      { value: `${data.method}Result`, label: `${data.method}Result`, description: 'Full return value' },
      // Suggest each return key
      ...returnKeys.map(key => ({
        value: key,
        label: key,
        description: `Destructure: { ${key} }`
      }))
    ];
  }, [returnKeys, data.method]);

  return (
    <div className="space-y-3">
      {/* Instance & Method Row */}
      <div className="flex gap-3">
        {/* Instance */}
        <div className="flex-1">
          {editMode ? (
            <AutocompleteInput
              value={data.instance || ''}
              onChange={(val) => updateData('instance', val)}
              options={instanceOptions}
              placeholder="Select POM instance..."
              disabled={!editMode}
              theme={theme}
              label="Instance"
              icon="📦"
              loading={pomsLoading}
              onOptionSelect={handleInstanceSelect}
              emptyMessage="No POMs found"
              allowFreeText={true}
            />
          ) : (
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
                Instance
              </label>
              <div 
                className="px-3 py-1.5 rounded text-sm font-mono"
                style={{ 
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              >
                {data.instance || <span style={{ color: theme.colors.text.tertiary }}>—</span>}
              </div>
            </div>
          )}
        </div>

        {/* Method */}
        <div className="flex-1">
          {editMode ? (
            <AutocompleteInput
              value={data.method || ''}
              onChange={(val) => updateData('method', val)}
              options={methodSuggestions}
              placeholder="Select method..."
              disabled={!editMode || !data.instance}
              theme={theme}
              label="Method"
              icon="⚡"
              onOptionSelect={handleMethodSelect}
              emptyMessage={data.instance ? "No methods found" : "Select instance first"}
              allowFreeText={true}
            />
          ) : (
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
                Method
              </label>
              <div 
                className="px-3 py-1.5 rounded text-sm font-mono"
                style={{ 
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              >
                {data.method || <span style={{ color: theme.colors.text.tertiary }}>—</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Options Row */}
      <div className="flex items-end gap-4">
        {/* Await checkbox */}
        <label className="flex items-center gap-2 text-sm cursor-pointer py-1.5">
          <input
            type="checkbox"
            checked={data.await ?? true}
            onChange={(e) => updateData('await', e.target.checked)}
            disabled={!editMode}
            className="rounded"
          />
          <span style={{ color: theme.colors.text.secondary }}>await</span>
        </label>

        {/* Store As */}
        <div className="flex-1 max-w-[200px]">
          {editMode ? (
            <AutocompleteInput
              value={data.storeAs || ''}
              onChange={(val) => updateData('storeAs', val)}
              options={storeAsOptions}
              placeholder="variableName"
              disabled={!editMode}
              theme={theme}
              label="Store result as"
              icon="💾"
              emptyMessage="Type variable name"
              allowFreeText={true}
            />
          ) : (
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
                Store result as
              </label>
              <div 
                className="px-3 py-1.5 rounded text-sm font-mono"
                style={{ 
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border}`,
                  color: data.storeAs ? theme.colors.accents.yellow : theme.colors.text.tertiary
                }}
              >
                {data.storeAs || '—'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Return Keys Hint */}
      {editMode && returnKeys.length > 0 && (
        <div 
          className="flex items-center gap-2 p-2 rounded text-xs"
          style={{ 
            background: `${theme.colors.accents.purple}15`,
            border: `1px solid ${theme.colors.accents.purple}30`
          }}
        >
          <span style={{ color: theme.colors.accents.purple }}>💡</span>
          <span style={{ color: theme.colors.text.secondary }}>
            This method returns: 
          </span>
          <div className="flex gap-1 flex-wrap">
            {returnKeys.map(key => (
              <button
                key={key}
                onClick={() => updateData('storeAs', key)}
                className="px-1.5 py-0.5 rounded font-mono transition hover:brightness-110"
                style={{ 
                  background: `${theme.colors.accents.purple}30`,
                  color: theme.colors.accents.purple
                }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Code Preview */}
      <div 
        className="p-3 rounded font-mono text-sm"
        style={{ 
          background: theme.colors.background.primary,
          border: `1px solid ${theme.colors.border}`
        }}
      >
        {/* Line 1: Variable declaration */}
        {data.storeAs && (
          <span style={{ color: theme.colors.accents.yellow }}>
            const {data.storeAs} = 
          </span>
        )}
        
        {/* await keyword */}
        {data.await && (
          <span style={{ color: theme.colors.accents.blue }}> await </span>
        )}
        
        {/* Instance */}
        <span style={{ color: theme.colors.text.primary }}>
          {data.instance || <span style={{ color: theme.colors.text.tertiary }}>instance</span>}
        </span>
        
        {/* Dot */}
        <span style={{ color: theme.colors.text.tertiary }}>.</span>
        
        {/* Method */}
        <span style={{ color: theme.colors.accents.green }}>
          {data.method || <span style={{ color: theme.colors.text.tertiary }}>method</span>}
        </span>
        
        {/* Parentheses */}
        <span style={{ color: theme.colors.text.tertiary }}>()</span>
        
        {/* Semicolon */}
        <span style={{ color: theme.colors.text.tertiary }}>;</span>
      </div>

      {/* Arguments Section (future enhancement) */}
      {data.args && data.args.length > 0 && (
        <div className="mt-2">
          <label className="text-xs font-semibold mb-1 block" style={{ color: theme.colors.text.tertiary }}>
            Arguments
          </label>
          <div className="flex flex-wrap gap-1">
            {data.args.map((arg, idx) => (
              <span 
                key={idx}
                className="px-2 py-1 rounded text-xs font-mono"
                style={{ 
                  background: `${theme.colors.accents.blue}20`,
                  color: theme.colors.accents.blue
                }}
              >
                {arg}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}