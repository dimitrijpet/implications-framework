// packages/web-app/src/components/AIAssistant/CreateStateForm.jsx

import { useState } from 'react';

const API_URL = 'http://localhost:3000';

export default function CreateStateForm({ 
  result, 
  projectPath, 
  theme,
  existingStates = [],
  onSuccess 
}) {
  const [formData, setFormData] = useState({
    screenName: result?.screenName || '',
    status: '',
    entity: '',
    platform: 'web',
    previousState: '',
    triggerEvent: '',
    tags: { screen: '', group: '' },
    outputPath: 'tests/implications'  // ADD THIS
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    if (!formData.screenName || !formData.status) {
      setError('Screen name and status are required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/create-implication`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectPath,
    screenName: formData.screenName,
    status: formData.status,
    elements: result.elements,
    platform: formData.platform,
    entity: formData.entity,
    previousState: formData.previousState,
    triggerEvent: formData.triggerEvent,
    tags: formData.tags,
    outputPath: formData.outputPath  // ADD THIS
  })
});

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Creation failed');
      }

      console.log('✅ Implication created:', data);
      
      if (onSuccess) {
        onSuccess(data);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div style={{
      padding: '16px',
      background: `${theme.colors.accents.purple}10`,
      border: `1px solid ${theme.colors.accents.purple}40`,
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      <h5 style={{
        margin: '0 0 16px 0',
        fontSize: '14px',
        fontWeight: 600,
        color: theme.colors.accents.purple
      }}>
        🔧 Create State Machine Implication
      </h5>

      <div style={{ display: 'grid', gap: '12px' }}>
        {/* Row 1: Screen Name & Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle(theme)}>Screen Name *</label>
            <input
              type="text"
              value={formData.screenName}
              onChange={(e) => updateField('screenName', e.target.value)}
              placeholder="LoginScreen"
              style={inputStyle(theme)}
            />
          </div>
          <div>
            <label style={labelStyle(theme)}>Status *</label>
            <input
              type="text"
              value={formData.status}
              onChange={(e) => updateField('status', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              placeholder="logged_in"
              style={inputStyle(theme)}
            />
          </div>
        </div>

        {/* Row 2: Entity & Platform */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle(theme)}>Entity</label>
            <input
              type="text"
              value={formData.entity}
              onChange={(e) => updateField('entity', e.target.value)}
              placeholder="user, booking, etc."
              style={inputStyle(theme)}
            />
          </div>
          <div>
            <label style={labelStyle(theme)}>Platform</label>
            <select
              value={formData.platform}
              onChange={(e) => updateField('platform', e.target.value)}
              style={inputStyle(theme)}
            >
              <option value="web">🌐 Web</option>
              <option value="mobile">📱 Mobile</option>
              <option value="dancer">💃 Dancer</option>
              <option value="manager">👔 Manager</option>
            </select>
          </div>
        </div>

        {/* Row 3: Previous State & Trigger Event */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle(theme)}>Previous State (requires)</label>
            <input
              type="text"
              list="existing-states"
              value={formData.previousState}
              onChange={(e) => updateField('previousState', e.target.value)}
              placeholder="initial, pending, etc."
              style={inputStyle(theme)}
            />
            <datalist id="existing-states">
              {existingStates.map((state, idx) => (
                <option key={idx} value={state} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={labelStyle(theme)}>Trigger Event</label>
            <input
              type="text"
              value={formData.triggerEvent}
              onChange={(e) => updateField('triggerEvent', e.target.value.toUpperCase())}
              placeholder="LOGIN, SUBMIT, etc."
              style={inputStyle(theme)}
            />
          </div>
        </div>

        {/* Row 4: Tags */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle(theme)}>Screen Tag</label>
            <input
              type="text"
              value={formData.tags.screen}
              onChange={(e) => updateField('tags', { ...formData.tags, screen: e.target.value })}
              placeholder="Auth, Dashboard, etc."
              style={inputStyle(theme)}
            />
          </div>
          <div>
            <label style={labelStyle(theme)}>Group Tag</label>
            <input
              type="text"
              value={formData.tags.group}
              onChange={(e) => updateField('tags', { ...formData.tags, group: e.target.value })}
              placeholder="login-flow, booking-flow"
              style={inputStyle(theme)}
            />
          </div>
        </div>
        {/* Output Path */}
<div style={{ marginTop: '12px' }}>
  <label style={labelStyle(theme)}>Output Folder</label>
  <input
    type="text"
    value={formData.outputPath}
    onChange={(e) => updateField('outputPath', e.target.value)}
    placeholder="tests/implications"
    style={inputStyle(theme)}
  />
  <div style={{ 
    marginTop: '4px', 
    fontSize: '11px', 
    color: theme.colors.text.tertiary 
  }}>
    File will be saved to: <code>{formData.outputPath}/{formData.screenName || '[ScreenName]'}Implications.js</code>
  </div>
</div>
      </div>

      {/* Elements Preview */}
      <div style={{
        marginTop: '12px',
        padding: '10px',
        background: theme.colors.background.tertiary,
        borderRadius: '6px',
        fontSize: '12px',
        color: theme.colors.text.secondary
      }}>
        <strong>Will include {result.elements?.length || 0} elements in mirrorsOn:</strong>
        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {result.elements?.slice(0, 8).map((el, idx) => (
            <span
              key={idx}
              style={{
                padding: '2px 6px',
                background: `${theme.colors.accents.blue}20`,
                borderRadius: '3px',
                fontSize: '11px'
              }}
            >
              {el.name}
            </span>
          ))}
          {result.elements?.length > 8 && (
            <span style={{ fontSize: '11px', color: theme.colors.text.tertiary }}>
              +{result.elements.length - 8} more
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: `${theme.colors.accents.red}20`,
          borderRadius: '6px',
          color: theme.colors.accents.red,
          fontSize: '13px'
        }}>
          ❌ {error}
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={handleCreate}
        disabled={creating || !formData.screenName || !formData.status}
        style={{
          marginTop: '16px',
          width: '100%',
          padding: '12px',
          background: creating || !formData.screenName || !formData.status
            ? theme.colors.background.tertiary
            : theme.colors.accents.purple,
          color: creating ? theme.colors.text.tertiary : 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '14px',
          cursor: creating ? 'not-allowed' : 'pointer'
        }}
      >
        {creating ? '⏳ Creating...' : '🔧 Create Implication'}
      </button>
    </div>
  );
}

// Styles
const labelStyle = (theme) => ({
  display: 'block',
  marginBottom: '4px',
  fontSize: '12px',
  color: theme.colors.text.secondary
});

const inputStyle = (theme) => ({
  width: '100%',
  padding: '8px 10px',
  background: theme.colors.background.secondary,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: '6px',
  color: theme.colors.text.primary,
  fontSize: '13px'
});
