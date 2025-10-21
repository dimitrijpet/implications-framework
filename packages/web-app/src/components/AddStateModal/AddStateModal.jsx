// packages/web-app/src/components/AddStateModal/AddStateModal.jsx (NEW FILE)

import { useState } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';

export default function AddStateModal({ onClose, onCreate, existingStates, projectPath, theme = defaultTheme }) {
  const [formData, setFormData] = useState({
    stateName: '',
    status: '',
    triggerButton: '',
    afterButton: '',
    previousButton: '',
    platform: 'mobile-manager',
    previousStatus: 'pending',
    requiredFields: ['dancerName', 'clubName', 'bookingTime', 'bookingType'],
    notificationKey: ''
  });
  
  const [creating, setCreating] = useState(false);
  const [fieldInput, setFieldInput] = useState('');
  
  const handleAddField = () => {
    if (fieldInput.trim() && !formData.requiredFields.includes(fieldInput.trim())) {
      setFormData({
        ...formData,
        requiredFields: [...formData.requiredFields, fieldInput.trim()]
      });
      setFieldInput('');
    }
  };
  
  const handleRemoveField = (field) => {
    setFormData({
      ...formData,
      requiredFields: formData.requiredFields.filter(f => f !== field)
    });
  };
  
  const handleCreate = async () => {
    // Validation
    if (!formData.stateName.trim()) {
      alert('State name is required');
      return;
    }
    
    if (!formData.status.trim()) {
      alert('Status is required');
      return;
    }
    
    if (!formData.triggerButton.trim()) {
      alert('Trigger button is required');
      return;
    }
    
    setCreating(true);
    
    try {
      await onCreate({
        ...formData,
        projectPath,
        notificationKey: formData.notificationKey || formData.status
      });
    } catch (error) {
      alert(`Failed to create state: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-50 overflow-y-auto backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="min-h-screen px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div 
            className="glass rounded-2xl p-8 border"
            style={{ 
              borderColor: theme.colors.border,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  ➕ Create New State
                </h2>
                <p className="text-sm" style={{ color: theme.colors.text.tertiary }}>
                  Define a new state in your implications system
                </p>
              </div>
              <button 
                onClick={onClose}
                className="text-red-400 hover:text-red-300 text-2xl font-bold px-3 py-1 rounded-lg hover:bg-red-900/20 transition"
              >
                ✕
              </button>
            </div>
            
            {/* Form */}
            <div className="space-y-6">
              
              {/* State Name & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
                    State Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Approved, Confirmed"
                    value={formData.stateName}
                    onChange={(e) => setFormData({ ...formData, stateName: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg font-semibold"
                    style={{
                      background: theme.colors.background.tertiary,
                      border: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
                    Status Label *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Approved, Confirmed"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg font-semibold"
                    style={{
                      background: theme.colors.background.tertiary,
                      border: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  />
                </div>
              </div>
              
              {/* Buttons */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
                    Trigger Button *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., APPROVE"
                    value={formData.triggerButton}
                    onChange={(e) => setFormData({ ...formData, triggerButton: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 rounded-lg font-mono font-semibold"
                    style={{
                      background: theme.colors.background.tertiary,
                      border: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
                    After Button
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., UNDO"
                    value={formData.afterButton}
                    onChange={(e) => setFormData({ ...formData, afterButton: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 rounded-lg font-mono"
                    style={{
                      background: theme.colors.background.tertiary,
                      border: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
                    Previous Button
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., PENDING"
                    value={formData.previousButton}
                    onChange={(e) => setFormData({ ...formData, previousButton: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 rounded-lg font-mono"
                    style={{
                      background: theme.colors.background.tertiary,
                      border: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  />
                </div>
              </div>
              
              {/* Platform & Previous Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
                    Platform *
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg font-semibold"
                    style={{
                      background: theme.colors.background.tertiary,
                      border: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  >
                    <option value="mobile-manager">📲 Manager App</option>
                    <option value="mobile-dancer">📱 Dancer App</option>
                    <option value="web">🌐 Web</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
                    Previous Status *
                  </label>
                  <select
                    value={formData.previousStatus}
                    onChange={(e) => setFormData({ ...formData, previousStatus: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg font-semibold"
                    style={{
                      background: theme.colors.background.tertiary,
                      border: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  >
                    <option value="">None (initial state)</option>
                    {existingStates.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Required Fields */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
                  Required Fields
                </label>
                
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Add field name..."
                    value={fieldInput}
                    onChange={(e) => setFieldInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddField();
                      }
                    }}
                    className="flex-1 px-4 py-2 rounded-lg font-mono text-sm"
                    style={{
                      background: theme.colors.background.tertiary,
                      border: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.primary
                    }}
                  />
                  <button
                    onClick={handleAddField}
                    className="px-4 py-2 rounded-lg font-semibold transition hover:brightness-110"
                    style={{
                      background: theme.colors.accents.green,
                      color: 'white'
                    }}
                  >
                    ➕ Add
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {formData.requiredFields.map((field, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg font-mono text-sm flex items-center gap-2"
                      style={{
                        background: `${theme.colors.accents.purple}40`,
                        color: theme.colors.accents.purple
                      }}
                    >
                      {field}
                      <button
                        onClick={() => handleRemoveField(field)}
                        className="hover:text-red-400 transition"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Notification Key */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.colors.text.secondary }}>
                  Notification Key
                  <span className="ml-2 text-xs" style={{ color: theme.colors.text.tertiary }}>
                    (defaults to Status if empty)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder={formData.status || "e.g., Approved"}
                  value={formData.notificationKey}
                  onChange={(e) => setFormData({ ...formData, notificationKey: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg"
                  style={{
                    background: theme.colors.background.tertiary,
                    border: `2px solid ${theme.colors.border}`,
                    color: theme.colors.text.primary
                  }}
                />
              </div>
              
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 px-6 py-3 rounded-lg font-bold transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: theme.colors.accents.green,
                  color: 'white'
                }}
              >
                {creating ? '⏳ Creating...' : '✅ Create State'}
              </button>
              <button
                onClick={onClose}
                disabled={creating}
                className="px-6 py-3 rounded-lg font-semibold transition hover:brightness-90 disabled:opacity-50"
                style={{
                  background: theme.colors.background.tertiary,
                  color: theme.colors.text.primary
                }}
              >
                ❌ Cancel
              </button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}