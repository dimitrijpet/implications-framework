// packages/web-app/src/components/UIScreenEditor/AutocompleteInput.jsx
// Reusable autocomplete input with dropdown

import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * AutocompleteInput - Input with dropdown suggestions
 * 
 * Props:
 * - value: Current value
 * - onChange: (value) => void
 * - options: Array of { value, label, description?, icon? }
 * - placeholder: Placeholder text
 * - disabled: Whether input is disabled
 * - theme: Theme object
 * - label: Field label
 * - icon: Icon to show before input
 * - loading: Show loading state
 * - allowFreeText: Allow values not in options
 * - onOptionSelect: (option) => void - Called when option selected (with full option object)
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
 * MultiSelectInput - For selecting multiple values (like visible/hidden fields)
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
  loading = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const accentColor = theme.colors.accents[color] || theme.colors.accents.blue;

  // Filter options (exclude already selected)
  const filteredOptions = useMemo(() => {
    const available = options.filter(opt => !values.includes(opt.value));
    if (!query) return available;
    const q = query.toLowerCase();
    return available.filter(opt => 
      opt.label?.toLowerCase().includes(q) ||
      opt.value?.toLowerCase().includes(q)
    );
  }, [options, values, query]);

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

  // Add value
  const handleAdd = (value) => {
    if (!values.includes(value)) {
      onChange([...values, value]);
    }
    setQuery('');
    setIsOpen(false);
  };

  // Remove value
  const handleRemove = (value) => {
    onChange(values.filter(v => v !== value));
  };

  // Handle typing custom value
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      handleAdd(query.trim());
    } else if (e.key === 'Backspace' && !query && values.length > 0) {
      handleRemove(values[values.length - 1]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
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
        {/* Selected Tags */}
        {values.map((val) => (
          <span
            key={val}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono"
            style={{ 
              background: `${accentColor}20`,
              color: accentColor
            }}
          >
            {val}
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(val);
                }}
                className="hover:text-red-400 transition"
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

      {/* Dropdown */}
      {isOpen && !disabled && filteredOptions.length > 0 && (
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
              onClick={() => handleAdd(option.value)}
              className="px-3 py-2 cursor-pointer transition hover:bg-white/5"
            >
              <span 
                className="text-sm font-mono"
                style={{ color: theme.colors.text.primary }}
              >
                {option.label || option.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}