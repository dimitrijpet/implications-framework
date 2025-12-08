// packages/web-app/src/components/UIScreenEditor/AutocompleteInput.jsx
// ✅ UPDATED: MultiSelectInput now supports array index selectors (first, last, all, any, custom)

import { useState, useRef, useEffect, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════
// INDEX OPTIONS for array element selection
// ═══════════════════════════════════════════════════════════
const INDEX_OPTIONS = [
  { value: '', label: '(none)' },
  { value: 'first', label: 'first' },
  { value: 'last', label: 'last' },
  { value: 'any', label: 'any' },
  { value: 'all', label: 'all' },
  { value: 'custom', label: 'nth...' },
];

/**
 * Parse field name to extract index notation
 * "element[all]" → { field: "element", indexType: "all", customIndex: "" }
 */
const parseFieldWithIndex = (fieldStr) => {
  if (!fieldStr) return { field: '', indexType: '', customIndex: '' };
  
  const match = fieldStr.match(/^(.+)\[(\d+|last|all|any)\]$/);
  if (!match) {
    return { field: fieldStr, indexType: '', customIndex: '' };
  }
  
  const idx = match[2];
  if (idx === '0') {
    return { field: match[1], indexType: 'first', customIndex: '' };
  } else if (['last', 'all', 'any'].includes(idx)) {
    return { field: match[1], indexType: idx, customIndex: '' };
  } else {
    return { field: match[1], indexType: 'custom', customIndex: idx };
  }
};

/**
 * Build field string with index notation
 */
const buildFieldWithIndex = (field, indexType, customIndex) => {
  if (!field) return '';
  if (!indexType || indexType === '') return field;
  if (indexType === 'first') return `${field}[0]`;
  if (indexType === 'custom') return `${field}[${customIndex || '0'}]`;
  return `${field}[${indexType}]`;
};

/**
 * AutocompleteInput - Input with dropdown suggestions
 * (UNCHANGED from original)
 */
export default function AutocompleteInput({
  value = '',
  onChange,
  options = [],
  placeholder = 'Type to search...',
  disabled = false,
  theme,
  label,
  icon,
  loading = false,
  allowFreeText = true,
  onOptionSelect,
  emptyMessage = 'No matches found',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter options based on query
  const filteredOptions = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(opt => 
      opt.label?.toLowerCase().includes(q) ||
      opt.value?.toLowerCase().includes(q) ||
      opt.description?.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Reset highlight when options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions.length]);

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  // Handle option selection
  const handleSelect = (option) => {
    onChange(option.value);
    setQuery('');
    setIsOpen(false);
    onOptionSelect?.(option);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(i => 
          i < filteredOptions.length - 1 ? i + 1 : i
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => i > 0 ? i - 1 : 0);
        break;

      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;

      case 'Escape':
        setIsOpen(false);
        break;

      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  // Get display value
  const displayValue = value;

  return (
    <div className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <label 
          className="text-xs font-semibold mb-1 block" 
          style={{ color: theme.colors.text.tertiary }}
        >
          {label}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        {/* Icon */}
        {icon && (
          <span 
            className="absolute left-2 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: theme.colors.text.tertiary }}
          >
            {icon}
          </span>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full py-1.5 rounded text-sm font-mono transition ${icon ? 'pl-8 pr-8' : 'px-3 pr-8'}`}
          style={{
            background: theme.colors.background.primary,
            border: `1px solid ${isOpen ? theme.colors.accents.blue : theme.colors.border}`,
            color: theme.colors.text.primary,
            outline: 'none'
          }}
        />

        {/* Dropdown Arrow / Loading */}
        <span 
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          {loading ? (
            <span className="animate-spin inline-block" style={{ color: theme.colors.text.tertiary }}>⟳</span>
          ) : (
            <span 
              className="text-xs transition-transform inline-block"
              style={{ 
                color: theme.colors.text.tertiary,
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
            >
              ▼
            </span>
          )}
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto"
          style={{
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border}`
          }}
        >
          {loading ? (
            <div 
              className="p-3 text-sm text-center"
              style={{ color: theme.colors.text.tertiary }}
            >
              Loading...
            </div>
          ) : filteredOptions.length === 0 ? (
            <div 
              className="p-3 text-sm text-center"
              style={{ color: theme.colors.text.tertiary }}
            >
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((option, idx) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className="px-3 py-2 cursor-pointer transition"
                style={{
                  background: highlightedIndex === idx 
                    ? `${theme.colors.accents.blue}20` 
                    : 'transparent'
                }}
              >
                <div className="flex items-center gap-2">
                  {option.icon && (
                    <span className="text-sm">{option.icon}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div 
                      className="text-sm font-medium truncate"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {option.label}
                    </div>
                    {option.description && (
                      <div 
                        className="text-xs truncate font-mono"
                        style={{ color: theme.colors.text.tertiary }}
                      >
                        {option.description}
                      </div>
                    )}
                  </div>
                  {option.async && (
                    <span 
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ 
                        background: `${theme.colors.accents.purple}30`,
                        color: theme.colors.accents.purple
                      }}
                    >
                      async
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * MultiSelectInput - For selecting multiple values WITH ARRAY INDEX SUPPORT
 * 
 * ✅ NEW FEATURES:
 * - Each selected item can have an index selector (first, last, all, any, custom)
 * - Stored as "element[all]", "element[last]", etc.
 * - Set showIndexSelector={true} to enable (default: false for backward compatibility)
 */
export function MultiSelectInput({
  values = [],
  onChange,
  options = [],
  placeholder = 'Add fields...',
  disabled = false,
  theme,
  label,
  color = 'blue',
  loading = false,
  showIndexSelector = false  // ✅ NEW: Enable index selector per item
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingIndexEdit, setPendingIndexEdit] = useState(null); // { value, indexType, customIndex }
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const accentColor = theme.colors.accents[color] || theme.colors.accents.blue;

  // Parse all values to extract index info
  const parsedValues = useMemo(() => {
    return values.map(val => ({
      raw: val,
      ...parseFieldWithIndex(val)
    }));
  }, [values]);

  // Filter options (exclude already selected base fields)
  const filteredOptions = useMemo(() => {
    const selectedBaseFields = parsedValues.map(pv => pv.field);
    const available = options.filter(opt => !selectedBaseFields.includes(opt.value));
    if (!query) return available;
    const q = query.toLowerCase();
    return available.filter(opt => 
      opt.label?.toLowerCase().includes(q) ||
      opt.value?.toLowerCase().includes(q)
    );
  }, [options, parsedValues, query]);

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setPendingIndexEdit(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add value (with optional index)
  const handleAdd = (baseValue, indexType = '', customIndex = '') => {
    const finalValue = buildFieldWithIndex(baseValue, indexType, customIndex);
    if (!values.includes(finalValue)) {
      // Remove any existing entry for this base field
      const newValues = values.filter(v => {
        const parsed = parseFieldWithIndex(v);
        return parsed.field !== baseValue;
      });
      onChange([...newValues, finalValue]);
    }
    setQuery('');
    setIsOpen(false);
    setPendingIndexEdit(null);
  };

  // Remove value
  const handleRemove = (value) => {
    onChange(values.filter(v => v !== value));
  };

  // Update index for existing value
  const handleUpdateIndex = (oldValue, newIndexType, newCustomIndex) => {
    const parsed = parseFieldWithIndex(oldValue);
    const newValue = buildFieldWithIndex(parsed.field, newIndexType, newCustomIndex);
    onChange(values.map(v => v === oldValue ? newValue : v));
    setPendingIndexEdit(null);
  };

  // Handle typing custom value
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      if (showIndexSelector) {
        // Show index selector for new item
        setPendingIndexEdit({ value: query.trim(), indexType: '', customIndex: '' });
      } else {
        handleAdd(query.trim());
      }
    } else if (e.key === 'Backspace' && !query && values.length > 0) {
      handleRemove(values[values.length - 1]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setPendingIndexEdit(null);
    }
  };

  // Handle option click
  const handleOptionClick = (option) => {
    if (showIndexSelector) {
      setPendingIndexEdit({ value: option.value, indexType: '', customIndex: '' });
    } else {
      handleAdd(option.value);
    }
  };

  return (
    <div className="relative">
      {/* Label */}
      {label && (
        <label 
          className="text-xs font-semibold mb-1 block" 
          style={{ color: accentColor }}
        >
          {label}
        </label>
      )}

      {/* Tags Container */}
      <div
        onClick={() => !disabled && inputRef.current?.focus()}
        className="min-h-[36px] px-2 py-1.5 rounded flex flex-wrap gap-1 items-center cursor-text"
        style={{
          background: theme.colors.background.primary,
          border: `1px solid ${isOpen ? accentColor : theme.colors.border}`
        }}
      >
        {/* Selected Tags with Index Badges */}
        {parsedValues.map((pv) => (
          <span
            key={pv.raw}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono group"
            style={{ 
              background: `${accentColor}20`,
              color: accentColor
            }}
          >
            {/* Field name */}
            <span>{pv.field}</span>
            
            {/* Index badge (if has index) */}
            {pv.indexType && (
              <span 
                className="px-1 py-0.5 rounded text-[10px] font-bold cursor-pointer hover:brightness-125 transition"
                style={{ 
                  background: accentColor,
                  color: theme.colors.background.primary
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled && showIndexSelector) {
                    setPendingIndexEdit({ 
                      value: pv.raw, 
                      indexType: pv.indexType, 
                      customIndex: pv.customIndex,
                      isEdit: true 
                    });
                  }
                }}
                title={showIndexSelector ? 'Click to change index' : undefined}
              >
                {pv.indexType === 'first' ? '[0]' : 
                 pv.indexType === 'custom' ? `[${pv.customIndex}]` : 
                 `[${pv.indexType}]`}
              </span>
            )}
            
            {/* Index selector button (if enabled and no index yet) */}
            {showIndexSelector && !pv.indexType && !disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingIndexEdit({ 
                    value: pv.raw, 
                    indexType: '', 
                    customIndex: '',
                    isEdit: true 
                  });
                }}
                className="px-1 py-0.5 rounded text-[10px] opacity-50 hover:opacity-100 transition"
                style={{ 
                  background: `${accentColor}50`,
                  color: theme.colors.background.primary
                }}
                title="Add index selector"
              >
                [?]
              </button>
            )}
            
            {/* Remove button */}
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(pv.raw);
                }}
                className="hover:text-red-400 transition opacity-60 hover:opacity-100"
              >
                ×
              </button>
            )}
          </span>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setPendingIndexEdit(null);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent text-sm font-mono outline-none"
          style={{ color: theme.colors.text.primary }}
        />

        {/* Loading indicator */}
        {loading && (
          <span className="animate-spin" style={{ color: theme.colors.text.tertiary }}>⟳</span>
        )}
      </div>

      {/* Index Selector Popup */}
      {pendingIndexEdit && (
        <div
          className="absolute z-50 mt-1 p-3 rounded-lg shadow-xl"
          style={{
            background: theme.colors.background.secondary,
            border: `1px solid ${accentColor}`,
            minWidth: '240px'
          }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
            {pendingIndexEdit.isEdit ? 'Change' : 'Add'} index for: 
            <span className="font-mono ml-1" style={{ color: accentColor }}>
              {parseFieldWithIndex(pendingIndexEdit.value).field}
            </span>
          </div>
          
          {/* Index type selector */}
          <div className="flex flex-wrap gap-1 mb-2">
            {INDEX_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.value === 'custom') {
                    setPendingIndexEdit(prev => ({ ...prev, indexType: 'custom' }));
                  } else {
                    const baseField = parseFieldWithIndex(pendingIndexEdit.value).field;
                    if (pendingIndexEdit.isEdit) {
                      handleUpdateIndex(pendingIndexEdit.value, opt.value, '');
                    } else {
                      handleAdd(baseField, opt.value, '');
                    }
                  }
                }}
                className={`px-2 py-1 rounded text-xs font-semibold transition ${
                  pendingIndexEdit.indexType === opt.value ? 'ring-2 ring-offset-1' : ''
                }`}
                style={{ 
                  background: pendingIndexEdit.indexType === opt.value 
                    ? accentColor 
                    : `${accentColor}30`,
                  color: pendingIndexEdit.indexType === opt.value 
                    ? theme.colors.background.primary 
                    : accentColor,
                  ringColor: accentColor
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          
          {/* Custom index input */}
          {pendingIndexEdit.indexType === 'custom' && (
            <div className="flex gap-2 mb-2">
              <input
                type="number"
                min="0"
                value={pendingIndexEdit.customIndex}
                onChange={(e) => setPendingIndexEdit(prev => ({ 
                  ...prev, 
                  customIndex: e.target.value 
                }))}
                placeholder="Index number (0, 1, 2...)"
                className="flex-1 px-2 py-1 rounded text-sm"
                style={{
                  background: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
                autoFocus
              />
              <button
                onClick={() => {
                  const baseField = parseFieldWithIndex(pendingIndexEdit.value).field;
                  if (pendingIndexEdit.isEdit) {
                    handleUpdateIndex(pendingIndexEdit.value, 'custom', pendingIndexEdit.customIndex);
                  } else {
                    handleAdd(baseField, 'custom', pendingIndexEdit.customIndex);
                  }
                }}
                className="px-3 py-1 rounded text-sm font-semibold"
                style={{ background: accentColor, color: theme.colors.background.primary }}
              >
                Apply
              </button>
            </div>
          )}
          
          {/* Help text */}
          <div className="text-[10px] space-y-0.5" style={{ color: theme.colors.text.tertiary }}>
            <div><strong>first:</strong> First element [0]</div>
            <div><strong>last:</strong> Last element</div>
            <div><strong>any:</strong> At least one must match</div>
            <div><strong>all:</strong> All elements must match</div>
            <div><strong>nth:</strong> Specific index number</div>
          </div>
          
          {/* Cancel */}
          <button
            onClick={() => setPendingIndexEdit(null)}
            className="mt-2 text-xs w-full py-1 rounded transition hover:bg-white/10"
            style={{ color: theme.colors.text.tertiary }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && !pendingIndexEdit && filteredOptions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto"
          style={{
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border}`
          }}
        >
          {filteredOptions.map((option) => (
            <div
              key={option.value}
              onClick={() => handleOptionClick(option)}
              className="px-3 py-2 cursor-pointer transition hover:bg-white/5"
            >
              <span 
                className="text-sm font-mono"
                style={{ color: theme.colors.text.primary }}
              >
                {option.label || option.value}
              </span>
              {showIndexSelector && (
                <span 
                  className="ml-2 text-xs"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  (click to add index)
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}