/**
 * AddScreenModal - Enhanced Version
 * ✅ Platform selection
 * ✅ Instance selection (nested instance support)
 * ✅ Working field autocomplete
 * ✅ Uses existing POM API
 */

import React, { useState, useEffect } from 'react';
import { getAllTemplates, createScreenFromTemplate } from '../../utils/screenTemplates';
import { validateScreenName } from '../../utils/screenValidation';
import useProjectConfig from '../../hooks/useProjectConfig';

const API_URL = 'http://localhost:3000';

export default function AddScreenModal({ 
  isOpen, 
  onClose, 
  onAdd,
  projectPath,
  existingScreens = {}
}) {
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedPOM, setSelectedPOM] = useState('');
  const [selectedInstance, setSelectedInstance] = useState('');  // ✅ NEW
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('simple');
  const [searchQuery, setSearchQuery] = useState('');
  const [validation, setValidation] = useState({ valid: false, errors: [] });
  
  // POM fetching
  const [availablePOMs, setAvailablePOMs] = useState([]);
  const [loadingPOMs, setLoadingPOMs] = useState(false);
  
  // ✅ NEW: Instance fetching
  const [availableInstances, setAvailableInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);

  const { platforms: availablePlatforms, loading: platformsLoading } = useProjectConfig(projectPath);

  const templates = getAllTemplates();

  // Fetch POMs when modal opens OR when platform changes
  useEffect(() => {
    if (isOpen && projectPath) {
      fetchAvailablePOMs(selectedPlatform);
    }
  }, [isOpen, projectPath, selectedPlatform]);

  // ✅ NEW: Fetch instances when POM is selected
  useEffect(() => {
    if (selectedPOM && projectPath) {
      fetchAvailableInstances();
    } else {
      setAvailableInstances([]);
      setSelectedInstance('');
    }
  }, [selectedPOM, selectedPlatform, projectPath]);

  const fetchAvailablePOMs = async (platform) => {
    setLoadingPOMs(true);
    try {
      let url = `${API_URL}/api/poms?projectPath=${encodeURIComponent(projectPath)}`;
      if (platform) {
        url += `&platform=${encodeURIComponent(platform)}`;
      }
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        const transformedPOMs = data.poms.map(pom => {
          const mainClass = pom.classes?.[0];
          
          return {
            name: pom.name,
            className: mainClass?.name || pom.name,
            path: pom.path,
            classes: pom.classes,
            methods: mainClass?.methods || [],
            fields: mainClass?.fields || []
          };
        });
        
        console.log(`✅ Loaded ${transformedPOMs.length} POMs${platform ? ` for ${platform}` : ''}`);
        setAvailablePOMs(transformedPOMs);
      } else {
        console.error('Failed to fetch POMs:', response.status);
        setAvailablePOMs([]);
      }
    } catch (error) {
      console.error('Error fetching POMs:', error);
      setAvailablePOMs([]);
    } finally {
      setLoadingPOMs(false);
    }
  };

  // ✅ NEW: Fetch available instances for selected POM
  const fetchAvailableInstances = async () => {
    setLoadingInstances(true);
    try {
      const selected = availablePOMs.find(p => p.name === selectedPOM);
      if (!selected) {
        setAvailableInstances([]);
        return;
      }

      let url = `${API_URL}/api/poms/${encodeURIComponent(selectedPOM)}?projectPath=${encodeURIComponent(projectPath)}`;
      if (selectedPlatform) {
        url += `&platform=${encodeURIComponent(selectedPlatform)}`;
      }
      if (selected.path) {
        url += `&pomPath=${encodeURIComponent(selected.path)}`;
      }

      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        // Build instance list: default (main class) + nested instances
        const instances = [];
        
        // Add default (main class getters)
        const defaultName = selected.className 
          ? selected.className.charAt(0).toLowerCase() + selected.className.slice(1)
          : 'default';
        
        instances.push({
          name: defaultName,
          displayName: `${selected.className || selected.name} (main)`,
          isDefault: true,
          locatorCount: data.instancePaths?.default?.length || 0
        });
        
        // Add nested instances
        if (data.instances && Array.isArray(data.instances)) {
          for (const inst of data.instances) {
            instances.push({
              name: inst.name,
              displayName: `${inst.name} (${inst.className})`,
              className: inst.className,
              isDefault: false,
              locatorCount: data.instancePaths?.[inst.name]?.length || 0
            });
          }
        }
        
        console.log(`✅ Loaded ${instances.length} instance(s) for ${selectedPOM}`);
        setAvailableInstances(instances);
        
        // Auto-select default instance
        setSelectedInstance(defaultName);
      } else {
        setAvailableInstances([]);
      }
    } catch (error) {
      console.error('Error fetching instances:', error);
      setAvailableInstances([]);
    } finally {
      setLoadingInstances(false);
    }
  };

  // Filter POMs by search
  const filteredPOMs = React.useMemo(() => {
    if (!searchQuery) return availablePOMs;
    const query = searchQuery.toLowerCase();
    return availablePOMs.filter(pom => {
      const cleanName = (pom.name || '').replace(/\.(screen|modal|wrapper)$/i, '').toLowerCase();
      const className = (pom.className || '').toLowerCase();
      const path = (pom.path || '').toLowerCase();
      
      return cleanName.includes(query) ||
             className.includes(query) ||
             path.includes(query);
    });
  }, [availablePOMs, searchQuery]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (availablePlatforms && availablePlatforms.length === 1) {
        setSelectedPlatform(availablePlatforms[0].name);
      } else {
        setSelectedPlatform('');
      }
      setSelectedPOM('');
      setSelectedInstance('');  // ✅ Reset instance
      setDescription('');
      setSelectedTemplate('simple');
      setSearchQuery('');
      setValidation({ valid: false, errors: [] });
    }
  }, [isOpen, availablePlatforms]);

  // ✅ UPDATED: Validate selected POM + Instance combo
  useEffect(() => {
    if (selectedPOM && selectedPlatform) {
      const selected = availablePOMs.find(p => p.name === selectedPOM);
      if (selected) {
        const screenName = selected.className || selected.name.replace(/\.(screen|modal|wrapper)$/i, '');
        const defaultInstanceName = screenName.charAt(0).toLowerCase() + screenName.slice(1);
        
        // Determine if this is a nested instance
        const isNestedInstance = selectedInstance && selectedInstance !== defaultInstanceName;
        
        // ✅ Build unique key: ClassName or ClassName_instanceName for nested
        const uniqueKey = isNestedInstance 
          ? `${screenName}_${selectedInstance}`
          : screenName;
        
        const platformScreens = existingScreens[selectedPlatform] || {};
        
        // Check if this exact combo already exists
        const isDuplicate = Object.keys(platformScreens).some(key => {
          // Exact key match
          if (key === uniqueKey) return true;
          
          // Also check if same class + same instance
          const existing = platformScreens[key];
          if (existing._pomSource?.className === selected.className) {
            return existing.instance === selectedInstance;
          }
          return false;
        });
        
        if (isDuplicate) {
          setValidation({ 
            valid: false, 
            errors: [`${screenName} with instance "${selectedInstance}" already exists in ${selectedPlatform}`] 
          });
        } else {
          setValidation({ valid: true, errors: [] });
        }
      }
    } else {
      setValidation({ valid: false, errors: [] });
    }
  }, [selectedPOM, selectedPlatform, selectedInstance, existingScreens, availablePOMs]);

  // ✅ UPDATED: handleSubmit with instance support
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validation.valid || !selectedPOM || !selectedPlatform) {
      return;
    }

    const selected = availablePOMs.find(p => p.name === selectedPOM);
    if (!selected) return;

    const screenClassName = selected.className || selected.name.replace(/\.(screen|modal|wrapper)$/i, '');
    const defaultInstanceName = screenClassName.charAt(0).toLowerCase() + screenClassName.slice(1);
    
    // Determine if nested instance
    const isNestedInstance = selectedInstance && selectedInstance !== defaultInstanceName;
    
    // ✅ Build unique screen key
    const screenKey = isNestedInstance 
      ? `${screenClassName}_${selectedInstance}`
      : screenClassName;

    // Create screen from template
    const newScreen = createScreenFromTemplate(
      selectedTemplate,
      screenKey,
      description.trim() || `${screenClassName} ${isNestedInstance ? `(${selectedInstance})` : ''} from ${selected.path}`
    );

    const screenFile = selected.name.replace(/\.js$/, '');
    
    newScreen.screen = screenFile;
    newScreen.instance = selectedInstance || defaultInstanceName;  // ✅ Use selected instance
    newScreen._pomSource = {
      path: selected.path,
      name: selected.name,
      className: selected.className,
      methods: selected.methods || [],
      fields: selected.fields || []
    };

    console.log('✅ Adding screen:', screenKey, 'to platform:', selectedPlatform);
    console.log('   Instance:', newScreen.instance);
    console.log('   Is nested:', isNestedInstance);
    console.log('📦 newScreen data:', JSON.stringify(newScreen, null, 2));
    
    onAdd(selectedPlatform, screenKey, newScreen);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!isOpen) return null;

  const canSubmit = validation.valid && selectedPOM && selectedPlatform && selectedInstance;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleCancel}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-white">
            Add UI Screen
          </h2>
          {loadingPOMs || platformsLoading ? (
            <p className="text-sm text-gray-400 mt-1">
              ⏳ Loading...
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">
              Select platform, screen object, and instance ({availablePOMs.length} POMs available)
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* PLATFORM SELECTION */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target Platform <span className="text-red-400">*</span>
            </label>
            {availablePlatforms && availablePlatforms.length > 0 ? (
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select platform...</option>
                {availablePlatforms.map(platform => (
                  <option key={platform.name} value={platform.name}>
                    {platform.displayName || platform.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-gray-900 border border-gray-600 rounded-md text-gray-400">
                No platforms available
              </div>
            )}
          </div>

          {/* POM Screen Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Screen Object (POM) <span className="text-red-400">*</span>
            </label>
            
            {loadingPOMs ? (
              <div className="p-4 bg-gray-900 border border-gray-600 rounded-md text-center">
                <p className="text-gray-400">⏳ Loading POMs...</p>
              </div>
            ) : availablePOMs.length === 0 ? (
              <div className="p-4 bg-gray-900 border border-gray-600 rounded-md text-center">
                <p className="text-gray-400 mb-2">No POMs discovered</p>
                <p className="text-xs text-gray-500">
                  Make sure your project path is correct
                </p>
              </div>
            ) : (
              <>
                {/* Search Box */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search by name, class, or path..."
                  className="w-full px-3 py-2 mb-3 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {/* POM List */}
                <div className="max-h-64 overflow-y-auto border border-gray-600 rounded-md bg-gray-900">
                  {filteredPOMs.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">
                      No POMs match "{searchQuery}"
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-700">
                      {filteredPOMs.map(pom => {
                        const isSelected = selectedPOM === pom.name;
                        const uniqueKey = `${pom.path}-${pom.name}`;
                        
                        return (
                          <label
                            key={uniqueKey}
                            className={`
                              flex items-start p-3 cursor-pointer transition-colors
                              ${isSelected
                                ? 'bg-blue-500 bg-opacity-20 border-l-4 border-blue-500'
                                : 'hover:bg-gray-800'
                              }
                            `}
                          >
                            <input
                              type="radio"
                              name="pomScreen"
                              value={pom.name}
                              checked={isSelected}
                              onChange={(e) => setSelectedPOM(e.target.value)}
                              className="mt-1 mr-3"
                            />
                            <div className="flex-1">
                              <div className="text-white font-medium">
                                {pom.className || pom.name.replace(/\.(screen|modal|wrapper)$/i, '')}
                              </div>
                              <div className="text-xs text-gray-400 mt-1 font-mono">
                                {pom.path}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

     {/* Instance Selection - MORE PROMINENT */}
{selectedPOM && availableInstances.length > 0 && (
  <div className="bg-indigo-900 bg-opacity-30 border-2 border-indigo-500 rounded-lg p-4">
    <label className="block text-sm font-medium text-indigo-300 mb-3">
      🎯 Select Instance <span className="text-red-400">*</span>
    </label>
    
    {loadingInstances ? (
      <div className="p-4 bg-gray-900 border border-gray-600 rounded-md">
        <p className="text-gray-400">⏳ Loading instances...</p>
      </div>
    ) : (
      <>
        <div className="space-y-2 max-h-64 overflow-y-auto border border-indigo-600 rounded-md bg-gray-900 p-3">
          {availableInstances.map(inst => (
            <label
              key={inst.name}
              className={`
                flex items-center p-4 cursor-pointer rounded-lg transition-colors
                ${selectedInstance === inst.name
                  ? 'bg-indigo-600 bg-opacity-40 border-2 border-indigo-400'
                  : 'hover:bg-gray-800 border-2 border-transparent'
                }
              `}
            >
              <input
                type="radio"
                name="instance"
                value={inst.name}
                checked={selectedInstance === inst.name}
                onChange={(e) => setSelectedInstance(e.target.value)}
                className="mr-4 w-5 h-5"
              />
              <div className="flex-1">
                <div className="text-white font-semibold text-base flex items-center gap-2">
                  {inst.displayName}
                  {inst.isDefault && (
                    <span className="text-xs bg-green-700 text-green-100 px-2 py-1 rounded-full">
                      ⭐ default
                    </span>
                  )}
                  {!inst.isDefault && (
                    <span className="text-xs bg-purple-700 text-purple-100 px-2 py-1 rounded-full">
                      📦 nested
                    </span>
                  )}
                </div>
                <div className="text-sm text-indigo-300 mt-1">
                  {inst.locatorCount} locators available
                </div>
              </div>
            </label>
          ))}
        </div>
        
        <p className="text-xs text-indigo-400 mt-3">
          💡 <strong>Default:</strong> Uses main class locators. <strong>Nested:</strong> Uses locators from a sub-instance (e.g., slideshowSection).
        </p>
      </>
    )}
  </div>
)}

          {/* Validation Message */}
          {selectedPOM && selectedPlatform && selectedInstance && !validation.valid && (
            <div className="p-3 bg-red-900 bg-opacity-20 border border-red-700 rounded-md">
              <p className="text-sm text-red-400">
                ❌ {validation.errors[0]}
              </p>
            </div>
          )}

          {selectedPOM && selectedPlatform && selectedInstance && validation.valid && (
            <div className="p-3 bg-green-900 bg-opacity-20 border border-green-700 rounded-md">
              <p className="text-sm text-green-400">
                ✓ Ready to add "{selectedPOM.replace(/\.(screen|modal|wrapper)$/i, '')}" 
                {selectedInstance && ` (instance: ${selectedInstance})`} to {selectedPlatform}
              </p>
            </div>
          )}

          {/* Description (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Custom description (or leave blank for auto-generated)"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Template Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Template
            </label>
            <div className="space-y-2">
              {templates.map(template => (
                <label 
                  key={template.id}
                  className={`
                    flex items-start p-3 border rounded-md cursor-pointer transition-colors
                    ${selectedTemplate === template.id 
                      ? 'border-blue-500 bg-blue-500 bg-opacity-10' 
                      : 'border-gray-600 bg-gray-900 hover:border-gray-500'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="template"
                    value={template.id}
                    checked={selectedTemplate === template.id}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="mt-0.5 mr-3"
                  />
                  <div>
                    <div className="text-white font-medium">{template.name}</div>
                    <div className="text-sm text-gray-400">{template.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-3 sticky bottom-0 bg-gray-800">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${canSubmit
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Add Screen
          </button>
        </div>
      </div>
    </div>
  );
}