/**
 * AddScreenModal - Enhanced Version
 * ✅ Platform selection
 * ✅ Working field autocomplete
 * ✅ Uses existing POM API
 */

import React, { useState, useEffect } from 'react';
import { getAllTemplates, createScreenFromTemplate } from '../../utils/screenTemplates';
import { validateScreenName } from '../../utils/screenValidation';

const API_URL = 'http://localhost:3000';

export default function AddScreenModal({ 
  isOpen, 
  onClose, 
  onAdd,
  projectPath,         // ✅ NEW: For autocomplete
  availablePlatforms,  // ✅ NEW: List of platforms to choose from
  existingScreens = {} // All existing screens across all platforms
}) {
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedPOM, setSelectedPOM] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('simple');
  const [searchQuery, setSearchQuery] = useState('');
  const [validation, setValidation] = useState({ valid: false, errors: [] });
  
  // POM fetching
  const [availablePOMs, setAvailablePOMs] = useState([]);
  const [loadingPOMs, setLoadingPOMs] = useState(false);

  const templates = getAllTemplates();

  // Fetch POMs when modal opens
  useEffect(() => {
    if (isOpen && projectPath) {
      fetchAvailablePOMs();
    }
  }, [isOpen, projectPath]);

  const fetchAvailablePOMs = async () => {
    setLoadingPOMs(true);
    try {
      const response = await fetch(
        `${API_URL}/api/poms?projectPath=${encodeURIComponent(projectPath)}`
      );
      
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
        
        console.log('✅ Loaded', transformedPOMs.length, 'POMs');
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
      // ✅ Auto-select first platform if only one
      if (availablePlatforms && availablePlatforms.length === 1) {
        setSelectedPlatform(availablePlatforms[0].name);
      } else {
        setSelectedPlatform('');
      }
      setSelectedPOM('');
      setDescription('');
      setSelectedTemplate('simple');
      setSearchQuery('');
      setValidation({ valid: false, errors: [] });
    }
  }, [isOpen, availablePlatforms]);

  // Validate selected POM
  useEffect(() => {
    if (selectedPOM && selectedPlatform) {
      const selected = availablePOMs.find(p => p.name === selectedPOM);
      if (selected) {
        const screenName = selected.className || selected.name.replace(/\.(screen|modal|wrapper)$/i, '');
        
        // ✅ Check against screens in selected platform only
        const platformScreens = existingScreens[selectedPlatform] || {};
        const result = validateScreenName(screenName, selectedPlatform, platformScreens);
        setValidation(result);
      }
    } else {
      setValidation({ valid: false, errors: [] });
    }
  }, [selectedPOM, selectedPlatform, existingScreens, availablePOMs]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validation.valid || !selectedPOM || !selectedPlatform) {
      return;
    }

    const selected = availablePOMs.find(p => p.name === selectedPOM);
    if (!selected) return;

    const screenName = selected.className || selected.name.replace(/\.(screen|modal|wrapper)$/i, '');

    // Create screen from template
    const newScreen = createScreenFromTemplate(
      selectedTemplate,
      screenName,
      description.trim() || `${selected.className || screenName} from ${selected.path}`
    );

    // Set POM reference to original name
    newScreen.screen = selected.name;  
    newScreen._pomSource = {
      path: selected.path,
      name: selected.name,
      className: selected.className,
      methods: selected.methods || [],
      fields: selected.fields || []
    };

    console.log('✅ Adding screen:', screenName, 'to platform:', selectedPlatform);
    onAdd(selectedPlatform, screenName, newScreen);
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

  const canSubmit = validation.valid && selectedPOM && selectedPlatform;

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
          {loadingPOMs ? (
            <p className="text-sm text-gray-400 mt-1">
              ⏳ Loading screen objects...
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">
              Select platform and screen object ({availablePOMs.length} POMs available)
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* ✅ PLATFORM SELECTION */}
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
                <div className="max-h-96 overflow-y-auto border border-gray-600 rounded-md bg-gray-900">
                  {filteredPOMs.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">
                      No POMs match "{searchQuery}"
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-700">
                      {filteredPOMs.map(pom => {
                        const isSelected = selectedPOM === pom.name;
                        const isDuplicate = validation.errors.some(e => e.includes('already exists'));
                        const uniqueKey = `${pom.path}-${pom.name}`;
                        
                        return (
                          <label
                            key={uniqueKey}
                            className={`
                              flex items-start p-4 cursor-pointer transition-colors
                              ${isSelected && isDuplicate
                                ? 'bg-red-900 bg-opacity-20 border-l-4 border-red-500'
                                : isSelected
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
                              <div className="flex items-center gap-2">
                                <div className="text-white font-medium">
                                  {pom.className || pom.name.replace(/\.(screen|modal|wrapper)$/i, '')}
                                </div>
                                {isSelected && isDuplicate && (
                                  <span className="text-xs bg-red-900 text-red-200 px-2 py-0.5 rounded">
                                    Already exists
                                  </span>
                                )}
                              </div>
                              
                              {pom.className && (
                                <div className="text-xs text-blue-400 mt-1">
                                  Class: {pom.className}
                                </div>
                              )}
                              
                              <div className="text-xs text-gray-400 mt-1 font-mono">
                                {pom.path}
                              </div>
                              
                              {pom.methods && pom.methods.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {pom.methods.slice(0, 5).map((method, idx) => (
                                    <span 
                                      key={idx}
                                      className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded"
                                    >
                                      {method.name}()
                                    </span>
                                  ))}
                                  {pom.methods.length > 5 && (
                                    <span className="text-xs text-gray-500">
                                      +{pom.methods.length - 5} more
                                    </span>
                                  )}
                                </div>
                              )}
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

          {/* Validation Message */}
          {selectedPOM && selectedPlatform && !validation.valid && (
            <div className="p-3 bg-red-900 bg-opacity-20 border border-red-700 rounded-md">
              <p className="text-sm text-red-400">
                ❌ {validation.errors[0]}
              </p>
            </div>
          )}

          {selectedPOM && selectedPlatform && validation.valid && (
            <div className="p-3 bg-green-900 bg-opacity-20 border border-green-700 rounded-md">
              <p className="text-sm text-green-400">
                ✓ Ready to add "{selectedPOM.replace(/\.(screen|modal|wrapper)$/i, '')}" to {selectedPlatform}
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