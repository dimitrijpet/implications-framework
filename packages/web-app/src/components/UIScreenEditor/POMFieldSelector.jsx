// packages/web-app/src/components/UIScreenEditor/POMFieldSelector.jsx

import { useState, useEffect } from 'react';
import { ChevronDown, AlertCircle, CheckCircle, Search } from 'lucide-react';

/**
 * POM Field Selector with autocomplete and validation
 * 
 * Features:
 * - Fetches available POMs from API
 * - Shows POM instances (oneWayTicket, roundTrip, etc.)
 * - Autocomplete dropdown with available fields
 * - Real-time validation (warns if field not in POM)
 */
export default function POMFieldSelector({ 
  projectPath,
  screenName,
  pomName,
  instanceName,
  onPOMChange,
  onInstanceChange,
  fieldValue,
  onFieldChange,
  onValidationChange
}) {
  const [poms, setPoms] = useState([]);
  const [pomDetails, setPomDetails] = useState(null);
  const [availableFields, setAvailableFields] = useState([]);
  const [isValid, setIsValid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all POMs on mount
  useEffect(() => {
    if (!projectPath) return;
    
    const fetchPOMs = async () => {
      try {
        const response = await fetch(`/api/poms?projectPath=${encodeURIComponent(projectPath)}`);
        const data = await response.json();
        
        if (data.success) {
          setPoms(data.poms.map(p => p.name));
        }
      } catch (error) {
        console.error('Failed to fetch POMs:', error);
      }
    };
    
    fetchPOMs();
  }, [projectPath]);

  // Fetch POM details when POM selected
  useEffect(() => {
    if (!projectPath || !pomName) return;
    
    const fetchPOMDetails = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/poms/${pomName}?projectPath=${encodeURIComponent(projectPath)}`
        );
        const data = await response.json();
        
        if (data.success) {
          setPomDetails(data);
          
          // If instance selected, get its fields
          if (instanceName && data.instancePaths[instanceName]) {
            setAvailableFields(data.instancePaths[instanceName]);
          } else {
            // No instance selected - show ALL available fields
            // Combine top-level getters + all instance paths
            const allFields = new Set();
            
            // Add all instance paths
            Object.values(data.instancePaths || {}).forEach(paths => {
              paths.forEach(path => allFields.add(path));
            });
            
            setAvailableFields(Array.from(allFields).sort());
          }
        }
      } catch (error) {
        console.error('Failed to fetch POM details:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPOMDetails();
  }, [projectPath, pomName]);

  // Update available fields when instance changes
  useEffect(() => {
    if (pomDetails && instanceName) {
      const fields = pomDetails.instancePaths[instanceName] || [];
      setAvailableFields(fields);
    }
  }, [pomDetails, instanceName]);

  // Validate field when it changes
  useEffect(() => {
    if (!fieldValue || !availableFields.length) {
      setIsValid(null);
      return;
    }
    
    const valid = availableFields.includes(fieldValue);
    setIsValid(valid);
    
    if (onValidationChange) {
      onValidationChange(valid);
    }
  }, [fieldValue, availableFields, onValidationChange]);

  // Filter fields based on search
  const filteredFields = availableFields.filter(field =>
    field.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* POM Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Page Object Model
        </label>
        <select
          value={pomName || ''}
          onChange={(e) => onPOMChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select POM...</option>
          {poms.map(pom => (
            <option key={pom} value={pom}>{pom}</option>
          ))}
        </select>
      </div>

      {/* Instance Selector - OPTIONAL */}
      {pomDetails && pomDetails.instances && pomDetails.instances.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Instance (optional)
          </label>
          <select
            value={instanceName || ''}
            onChange={(e) => onInstanceChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All fields (no filter)</option>
            {pomDetails.instances.map(inst => (
              <option key={inst.name} value={inst.name}>
                {inst.name} ({inst.className})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Select an instance to filter fields, or leave empty to see all
          </p>
        </div>
      )}

      {/* Field Input with Autocomplete */}
      {availableFields.length > 0 && (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field Path
            {isValid !== null && (
              <span className="ml-2">
                {isValid ? (
                  <span className="inline-flex items-center text-green-600 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Valid
                  </span>
                ) : (
                  <span className="inline-flex items-center text-amber-600 text-xs">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Not found in POM
                  </span>
                )}
              </span>
            )}
          </label>
          
          <div className="relative">
            <input
              type="text"
              value={fieldValue || ''}
              onChange={(e) => {
                onFieldChange(e.target.value);
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => {
                // Delay to allow click on dropdown items
                setTimeout(() => setShowDropdown(false), 200);
              }}
              placeholder={pomName ? 'Start typing or select from dropdown' : 'Select POM first'}
              className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isValid === false ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
              }`}
            />
            
            <ChevronDown 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            />
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && filteredFields.length > 0 && (
            <>
              <div 
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search fields..."
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                
                <div className="py-1">
                  {filteredFields.map(field => (
                    <button
                      key={field}
                      type="button"  
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('✅ Field selected:', field);
                        onFieldChange(field);
                        setSearchTerm('');
                        setShowDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                    >
                      <span className="font-mono text-gray-900">{field}</span>
                    </button>
                  ))}
                </div>
                
                {filteredFields.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-gray-500">
                    No fields match "{searchTerm}"
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Show field count */}
      {availableFields.length > 0 && (
        <div className="text-xs text-gray-500">
          {availableFields.length} fields available
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-sm text-gray-500 animate-pulse">
          Loading POM details...
        </div>
      )}
    </div>
  );
}