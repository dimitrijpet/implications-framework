/**
 * DeleteConfirmDialog Component
 * 
 * Simple confirmation dialog for destructive actions
 * Used for confirming screen deletion
 */

import React, { useEffect } from 'react';

export default function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  screenName,
  platformDisplayName
}) {
  
  const handleConfirm = () => {
    onConfirm();
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
          <h2 className="text-xl font-semibold text-red-400">
            Delete Screen?
          </h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-300 mb-2">
            Are you sure you want to delete:
          </p>
          <p className="text-white font-semibold text-lg mb-2">
            "{screenName}"
          </p>
          <p className="text-sm text-gray-400 mb-4">
            from {platformDisplayName}
          </p>
          <p className="text-yellow-400 text-sm">
            ⚠️ This action cannot be undone.
          </p>
        </div>

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
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}