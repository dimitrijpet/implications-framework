// packages/web-app/src/components/UIScreenEditor/NavigationEditor.jsx
// ✨ Navigation Editor - Configure how to navigate to a screen before validation
import { useState, useEffect } from 'react';

export default function NavigationEditor({ 
  navigation, 
  projectPath, 
  pomName: defaultPomName,
  instanceName: defaultInstanceName,
  storedVariables = [],
  onChange, 
  onRemove,
  theme 
}) {
  const [isExpanded, setIsExpanded] = useState(!!navigation);
  const [availablePOMs, setAvailablePOMs] = useState([]);
  const [availableMethods, setAvailableMethods] = useState([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  
  // Local state for navigation config
  const [navConfig, setNavConfig] = useState(navigation || {
    pomName: defaultPomName || '',
    instanceName: defaultInstanceName || '',
    method: '',
    args: []
  });

 useEffect(() => {
  console.log('🧭 NavigationEditor received navigation prop:', navigation);
  if (navigation && Object.keys(navigation).length > 0) {
    console.log('🧭 Setting navConfig to:', navigation);
    setNavConfig(navigation);
    setIsExpanded(true);
  }
}, [navigation]);
  // Fetch available POMs
  useEffect(() => {
    if (projectPath) {
      fetchPOMs();
    }
  }, [projectPath]);

  // Fetch methods when POM changes
  useEffect(() => {
    if (navConfig.pomName && projectPath) {
      fetchMethods(navConfig.pomName);
    }
  }, [navConfig.pomName, projectPath]);

  const fetchPOMs = async () => {
    try {
      const response = await fetch(
        `/api/discovery/screens?projectPath=${encodeURIComponent(projectPath)}`
      );
      if (response.ok) {
        const data = await response.json();
        setAvailablePOMs(data.screens || []);
      }
    } catch (error) {
      console.error('Failed to fetch POMs:', error);
    }
  };

const fetchMethods = async (pomName) => {
  setIsLoadingMethods(true);
  try {
    // Extract just the filename if it's a full path
    const cleanPomName = pomName.includes('/') 
      ? pomName.split('/').pop().replace('.js', '')
      : pomName;
    
    const response = await fetch(
      `/api/poms/functions?projectPath=${encodeURIComponent(projectPath)}&pomName=${encodeURIComponent(cleanPomName)}`
    );
    if (response.ok) {
      const data = await response.json();
      // Show ALL methods, not just navigation-filtered ones
      const allMethods = data.functions || [];
      setAvailableMethods(allMethods);
    }
  } catch (error) {
    console.error('Failed to fetch methods:', error);
  } finally {
    setIsLoadingMethods(false);
  }
};

  const handlePOMChange = (pomName) => {
    const updated = { ...navConfig, pomName, method: '', args: [] };
    setNavConfig(updated);
    onChange(updated);
  };

  const handleMethodChange = (method) => {
    const updated = { ...navConfig, method };
    setNavConfig(updated);
    onChange(updated);
  };

  const handleArgChange = (index, value) => {
    const newArgs = [...(navConfig.args || [])];
    newArgs[index] = value;
    const updated = { ...navConfig, args: newArgs };
    setNavConfig(updated);
    onChange(updated);
  };

  const handleAddArg = () => {
    const newArgs = [...(navConfig.args || []), ''];
    const updated = { ...navConfig, args: newArgs };
    setNavConfig(updated);
    onChange(updated);
  };

  const handleRemoveArg = (index) => {
    const newArgs = (navConfig.args || []).filter((_, i) => i !== index);
    const updated = { ...navConfig, args: newArgs };
    setNavConfig(updated);
    onChange(updated);
  };

  const handleEnable = () => {
    setIsExpanded(true);
    const initial = {
      pomName: defaultPomName || '',
      instanceName: defaultInstanceName || '',
      method: '',
      args: []
    };
    setNavConfig(initial);
    onChange(initial);
  };

  const handleDisable = () => {
    setIsExpanded(false);
    setNavConfig({});
    onRemove();
  };

  const color = theme.colors.accents.cyan || theme.colors.accents.blue;

  // Collapsed state - show "Add Navigation" button
  if (!isExpanded && !navigation) {
    return (
      <button
        onClick={handleEnable}
        className="w-full px-3 py-2 rounded text-sm font-semibold transition hover:brightness-110 flex items-center justify-center gap-2"
        style={{ 
          background: `${color}20`,
          color: color,
          border: `1px dashed ${color}40`
        }}
      >
        🧭 Add Navigation
      </button>
    );
  }

  return (
    <div 
      className="p-3 rounded space-y-3"
      style={{ 
        background: `${color}10`, 
        border: `1px solid ${color}40` 
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>🧭</span>
          <span className="font-semibold text-sm" style={{ color }}>
            Navigation
          </span>
          <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
            (runs before validation)
          </span>
        </div>
        <button
          onClick={handleDisable}
          className="text-xs px-2 py-1 rounded transition hover:brightness-110"
          style={{ background: theme.colors.accents.red, color: 'white' }}
        >
          ✕ Remove
        </button>
      </div>

      {/* POM Selector */}
      <div className="space-y-1">
        <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
          Screen Object (POM)
        </label>
        <select
          value={navConfig.pomName || ''}
          onChange={(e) => handlePOMChange(e.target.value)}
          className="w-full px-2 py-1.5 rounded text-sm"
          style={{ 
            background: theme.colors.background.primary, 
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text.primary 
          }}
        >
          <option value="">Select screen object...</option>
          {availablePOMs.map(pom => (
            <option key={pom.name || pom} value={pom.name || pom}>
              {pom.name || pom}
            </option>
          ))}
        </select>
      </div>

      {/* Method Selector */}
      {navConfig.pomName && (
        <div className="space-y-1">
          <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
            Navigation Method
          </label>
          <select
            value={navConfig.method || ''}
            onChange={(e) => handleMethodChange(e.target.value)}
            disabled={isLoadingMethods}
            className="w-full px-2 py-1.5 rounded text-sm"
            style={{ 
              background: theme.colors.background.primary, 
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text.primary 
            }}
          >
            <option value="">
              {isLoadingMethods ? 'Loading...' : 'Select method...'}
            </option>
            {availableMethods.map(method => (
              <option key={method} value={method}>
                {method}()
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Arguments */}
      {navConfig.method && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
              Arguments
            </label>
            <button
              onClick={handleAddArg}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: color, color: 'white' }}
            >
              + Add Arg
            </button>
          </div>
          
          {(navConfig.args || []).map((arg, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs w-6" style={{ color: theme.colors.text.tertiary }}>
                #{idx + 1}
              </span>
              <select
                value={arg}
                onChange={(e) => handleArgChange(idx, e.target.value)}
                className="flex-1 px-2 py-1 rounded text-sm font-mono"
                style={{ 
                  background: theme.colors.background.primary, 
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.accents.purple 
                }}
              >
                <option value="">Select variable...</option>
                {storedVariables.map(v => (
                  <option key={v.name} value={`{{${v.name}}}`}>
                    {v.name}
                  </option>
                ))}
                <option value="__custom__">Custom value...</option>
              </select>
              <button
                onClick={() => handleRemoveArg(idx)}
                className="text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          ))}

          {(navConfig.args || []).length === 0 && (
            <div className="text-xs text-center py-2" style={{ color: theme.colors.text.tertiary }}>
              No arguments (click "+ Add Arg" if method needs parameters)
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {navConfig.pomName && navConfig.method && (
        <div 
          className="p-2 rounded text-xs font-mono"
          style={{ background: theme.colors.background.primary }}
        >
          <span style={{ color: theme.colors.text.tertiary }}>// Generated:</span>
          <br />
          <span style={{ color: theme.colors.accents.blue }}>await</span>{' '}
          <span style={{ color: theme.colors.accents.green }}>
            {navConfig.instanceName || navConfig.pomName}
          </span>
          <span style={{ color: theme.colors.text.primary }}>.</span>
          <span style={{ color: theme.colors.accents.yellow }}>
            {navConfig.method}
          </span>
          <span style={{ color: theme.colors.text.primary }}>(</span>
          <span style={{ color: theme.colors.accents.purple }}>
            {(navConfig.args || []).filter(a => a).join(', ')}
          </span>
          <span style={{ color: theme.colors.text.primary }}>);</span>
        </div>
      )}
    </div>
  );
}