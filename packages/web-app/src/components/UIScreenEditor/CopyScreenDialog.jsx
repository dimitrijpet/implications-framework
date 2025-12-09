/**
 * CopyScreenDialog Component
 * 
 * Dialog for copying screens within or between platforms
 * Features:
 * - Copy to same platform (duplicate)
 * - Copy to different platform
 * - Auto-suggest name with "_copy" suffix
 * - Real-time validation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { validateScreenName, suggestCopyName } from '../../utils/screenValidation';

export default function CopyScreenDialog({
  isOpen,
  onClose,
  onCopy,
  screen,
  sourcePlatformName,
  sourcePlatformDisplayName,
  availablePlatforms = [], // [{ name: 'web', displayName: 'Web' }, ...]
  allScreens = []
}) {
  const [copyMode, setCopyMode] = useState('same'); // 'same' or 'different'
  const [targetPlatform, setTargetPlatform] = useState('');
  const [newName, setNewName] = useState('');
  const [validation, setValidation] = useState({ valid: false, errors: [] });
  const [touched, setTouched] = useState(false);

  // ✅ FIX: Memoize allScreens length to prevent infinite loop
  const allScreensCount = useMemo(() => allScreens.length, [allScreens.length]);
  
  // ✅ FIX: Memoize screen name to prevent infinite loop
  const screenName = screen?.originalName;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && screen) {
      setCopyMode('same');
      setTargetPlatform('');
      setTouched(false);
      
      // Auto-suggest name
      const suggested = suggestCopyName(
        screen.originalName,
        allScreens,
        sourcePlatformName
      );
      setNewName(suggested);
    }
  }, [isOpen, screenName, sourcePlatformName]); // ✅ FIX: Use screenName, not screen

  // Validate when inputs change
  useEffect(() => {
    if (!newName) {
      setValidation({ valid: false, errors: ['Name is required'] });
      return;
    }

    const targetPlatformName = copyMode === 'same' 
      ? sourcePlatformName 
      : targetPlatform;

    if (copyMode === 'different' && !targetPlatform) {
      setValidation({ valid: false, errors: ['Select a platform'] });
      return;
    }

    const result = validateScreenName(newName, targetPlatformName, allScreens);
    setValidation(result);
  }, [newName, copyMode, targetPlatform, sourcePlatformName, allScreensCount]); // ✅ FIX: Use count, not array

  const handleCopyModeChange = (mode) => {
    setCopyMode(mode);
    if (mode === 'different' && availablePlatforms.length > 0) {
      // Auto-select first available platform
      const firstPlatform = availablePlatforms.find(p => p.name !== sourcePlatformName);
      setTargetPlatform(firstPlatform?.name || '');
    }
    setTouched(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validation.valid) {
      setTouched(true);
      return;
    }

    const targetPlatformName = copyMode === 'same' 
      ? sourcePlatformName 
      : targetPlatform;

    onCopy(sourcePlatformName, screen, targetPlatformName, newName.trim());
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
    
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]); // ✅ FIX: Only depend on isOpen

  if (!isOpen || !screen) return null;

  const showError = touched && !validation.valid;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleCancel}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            Copy "{screen.originalName}"
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            From: {sourcePlatformDisplayName}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Copy Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Copy to:
            </label>
            
            {/* Same Platform */}
            <label 
              className={`
                flex items-center p-3 border rounded-md cursor-pointer transition-colors mb-2
                ${copyMode === 'same'
                  ? 'border-blue-500 bg-blue-500 bg-opacity-10' 
                  : 'border-gray-600 bg-gray-900 hover:border-gray-500'
                }
              `}
            >
              <input
                type="radio"
                name="copyMode"
                value="same"
                checked={copyMode === 'same'}
                onChange={() => handleCopyModeChange('same')}
                className="mr-3"
              />
              <div>
                <div className="text-white font-medium">Same platform (duplicate)</div>
                <div className="text-sm text-gray-400">
                  Create a copy in {sourcePlatformDisplayName}
                </div>
              </div>
            </label>

            {/* Different Platform */}
            <label 
              className={`
                flex items-start p-3 border rounded-md cursor-pointer transition-colors
                ${copyMode === 'different'
                  ? 'border-blue-500 bg-blue-500 bg-opacity-10' 
                  : 'border-gray-600 bg-gray-900 hover:border-gray-500'
                }
              `}
            >
              <input
                type="radio"
                name="copyMode"
                value="different"
                checked={copyMode === 'different'}
                onChange={() => handleCopyModeChange('different')}
                className="mt-0.5 mr-3"
              />
              <div className="flex-1">
                <div className="text-white font-medium mb-2">Different platform</div>
                {copyMode === 'different' && (
                  <select
                    value={targetPlatform}
                    onChange={(e) => {
                      setTargetPlatform(e.target.value);
                      setTouched(true);
                    }}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">Select platform...</option>
                    {availablePlatforms
                      .filter(p => p.name !== sourcePlatformName)
                      .map(platform => (
                        <option key={platform.name} value={platform.name}>
                          {platform.displayName}
                        </option>
                      ))
                    }
                  </select>
                )}
              </div>
            </label>
          </div>

          {/* New Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setTouched(true);
              }}
              placeholder="e.g., myScreen_copy"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* Validation Feedback */}
            {showError && (
              <p className="mt-1 text-sm text-red-400">
                ❌ {validation.errors[0]}
              </p>
            )}
            {!showError && validation.valid && (
              <p className="mt-1 text-sm text-green-400">
                ✓ Valid name
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-3">
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
            disabled={!validation.valid}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${validation.valid
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Copy Screen
          </button>
        </div>
      </div>
    </div>
  );
}