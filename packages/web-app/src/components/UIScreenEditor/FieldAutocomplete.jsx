// packages/web-app/src/components/UIScreenEditor/FieldAutocomplete.jsx
// ✨ ENHANCED: Now shows functions alongside POM fields!

import { useState, useEffect } from 'react';
import { ChevronDown, AlertCircle, CheckCircle, Search } from 'lucide-react';

/**
 * Field Autocomplete with POM fields + Functions support
 * 
 * Shows:
 * - POM fields (from selected POM/instance)
 * - Functions (from screen.functions)
 * - Visual distinction (⚡ for functions)
 */
export default function FieldAutocomplete({ 
  projectPath,
  pomName,
  instanceName,
  fieldValue,
  onFieldChange,
  onValidationChange,
  placeholder = "Type field name or select from dropdown",
  functions = {}  // ✨ NEW: Functions from screen
}) {
  const [pomDetails, setPomDetails] = useState(null);
  const [availableFields, setAvailableFields] = useState([]);
  const [isValid, setIsValid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch POM details when POM selected
  useEffect(() => {
    if (!projectPath || !pomName) {
      setPomDetails(null);
      setAvailableFields([]);
      return;
    }
    
    const fetchPOMDetails = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/poms/${pomName}?projectPath=${encodeURIComponent(projectPath)}`
        );
        const data = await response.json();
        
        if (data.success) {
          setPomDetails(data);
        }
      } catch (error) {
        console.error('Failed to fetch POM details:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPOMDetails();
  }, [projectPath, pomName]);
// ✨ ENHANCED: Merge POM fields + function names
const functionNamesKey = JSON.stringify(Object.keys(functions || {}).sort());

useEffect(() => {
  if (!pomDetails) {
    setAvailableFields([]);
    return;
  }
  
  let pomFields = [];
  
  // ✅ FIX: Check if instanceName is in instancePaths
  // If not, it's probably the main class - use 'default'
  const instanceKey = pomDetails.instancePaths?.[instanceName] 
    ? instanceName 
    : 'default';
  
  if (pomDetails.instancePaths?.[instanceKey]) {
    pomFields = pomDetails.instancePaths[instanceKey];
    console.log(`📍 Using locators from "${instanceKey}":`, pomFields.length);
  } else {
    // Fallback: merge all
    const allFields = new Set();
    Object.values(pomDetails.instancePaths || {}).forEach(paths => {
      paths.forEach(path => allFields.add(path));
    });
    pomFields = Array.from(allFields).sort();
    console.log(`📍 Fallback - using all locators:`, pomFields.length);
  }
  
  const functionNames = Object.keys(functions || {});
  const allFields = [...functionNames, ...pomFields];
  setAvailableFields(allFields);
  
  console.log('📋 Total available fields:', allFields.length);
}, [pomDetails, instanceName, functionNamesKey]);

  // Validate field when it changes
  useEffect(() => {
    if (!fieldValue || !availableFields.length) {
      setIsValid(null);
      if (onValidationChange) onValidationChange(null);
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

  // Check if a field is a function
  const isFunction = (field) => Object.keys(functions).includes(field);

  return (
    <div className="space-y-2">
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field or Function
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
                  Not found
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
              setTimeout(() => setShowDropdown(false), 200);
            }}
            placeholder={placeholder}
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
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              
              <div className="py-1">
                {filteredFields.map(field => {
                  const isFn = isFunction(field);
                  return (
                    <button
                      key={field}
                      type="button"  
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('✅ Field selected:', field, isFn ? '(function)' : '(field)');
                        onFieldChange(field);
                        setSearchTerm('');
                        setShowDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors flex items-center gap-2"
                    >
                      {isFn && (
                        <span className="text-amber-500 font-bold" title="Function">⚡</span>
                      )}
                      <span className={`font-mono ${isFn ? 'text-amber-700 font-semibold' : 'text-gray-900'}`}>
                        {field}
                      </span>
                      {isFn && (
                        <span className="ml-auto text-xs text-amber-600 italic">
                          function
                        </span>
                      )}
                    </button>
                  );
                })}
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

      {/* Show field count */}
      {availableFields.length > 0 && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>{availableFields.length} available</span>
          {Object.keys(functions).length > 0 && (
            <span className="text-amber-600">
              ({Object.keys(functions).length} ⚡ functions)
            </span>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-sm text-gray-500 animate-pulse">
          Loading fields...
        </div>
      )}
    </div>
  );
}