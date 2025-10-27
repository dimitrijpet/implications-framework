// packages/web-app/src/components/UIScreenEditor/FieldAutocomplete.jsx

import { useState, useEffect } from 'react';
import { ChevronDown, AlertCircle, CheckCircle, Search } from 'lucide-react';

/**
 * Simple field autocomplete - just shows fields, no POM/Instance selection
 * Used in ElementSection when POM is already selected at screen level
 */
export default function FieldAutocomplete({ 
  projectPath,
  pomName,
  instanceName,
  fieldValue,
  onFieldChange,
  onValidationChange,
  placeholder = "Start typing or select field"
}) {
  const [availableFields, setAvailableFields] = useState([]);
  const [isValid, setIsValid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch available fields when POM changes
  useEffect(() => {
    if (!projectPath || !pomName) {
      setAvailableFields([]);
      return;
    }
    
    const fetchFields = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/poms/${pomName}?projectPath=${encodeURIComponent(projectPath)}`
        );
        const data = await response.json();
        
        if (data.success) {
          if (instanceName && data.instancePaths[instanceName]) {
            // Filter by instance
            setAvailableFields(data.instancePaths[instanceName]);
          } else {
            // Show all fields
            const allFields = new Set();
            Object.values(data.instancePaths || {}).forEach(paths => {
              paths.forEach(path => allFields.add(path));
            });
            setAvailableFields(Array.from(allFields).sort());
          }
        }
      } catch (error) {
        console.error('Failed to fetch fields:', error);
        setAvailableFields([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFields();
  }, [projectPath, pomName, instanceName]);

  // Validate field
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
  const filteredFields = searchTerm 
    ? availableFields.filter(field =>
        field.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : availableFields;

  if (!pomName) {
    return (
      <input
        type="text"
        value={fieldValue || ''}
        onChange={(e) => onFieldChange(e.target.value)}
        placeholder="Select POM first"
        disabled
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
      />
    );
  }

  return (
    <div className="relative">
      {/* Input with validation indicator */}
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
          placeholder={placeholder}
          className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isValid === false ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
          }`}
        />
        
        {/* Validation icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          )}
          {!loading && isValid === true && (
            <CheckCircle className="w-4 h-4 text-green-600" />
          )}
          {!loading && isValid === false && fieldValue && (
            <AlertCircle className="w-4 h-4 text-amber-600" />
          )}
          {!loading && availableFields.length > 0 && !fieldValue && (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
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
            
            {filteredFields.length === 0 && searchTerm && (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No fields match "{searchTerm}"
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Field count */}
      {availableFields.length > 0 && !showDropdown && (
        <div className="mt-1 text-xs text-gray-500">
          {availableFields.length} fields available
        </div>
      )}
      
      {/* Validation message */}
      {isValid === false && fieldValue && (
        <div className="mt-1 text-xs text-amber-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Field not found in {pomName}{instanceName && `.${instanceName}`}
        </div>
      )}
    </div>
  );
}