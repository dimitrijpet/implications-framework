// packages/web-app/src/components/AIAssistant/CreateStateForm.jsx

import { useState, useMemo } from 'react';

const API_URL = 'http://localhost:3000';

export default function CreateStateForm({ 
  result, 
  projectPath, 
  theme,
  existingStates = [],
  existingEntities = [],
  existingTags = { screen: [], group: [] },
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
    outputPath: 'tests/implications'
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Extract status list from existing states
  const existingStatuses = useMemo(() => {
    return existingStates
      .map(s => s.status || s.id)
      .filter(Boolean)
      .sort();
  }, [existingStates]);

  // Check for duplicate status
  const isDuplicateStatus = useMemo(() => {
    if (!formData.status) return false;
    return existingStatuses.includes(formData.status);
  }, [formData.status, existingStatuses]);

  // Auto-generate status from screenName
  const suggestedStatus = useMemo(() => {
    if (!formData.screenName) return '';
    return formData.screenName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/_+/g, '_');
  }, [formData.screenName]);

  // Find states that could transition TO this new state
  const potentialPreviousStates = useMemo(() => {
    return existingStates
      .filter(s => s.status !== formData.status)
      .map(s => ({
        status: s.status || s.id,
        label: s.statusLabel || s.status || s.id,
        platforms: s.platforms || [s.platform]
      }));
  }, [existingStates, formData.status]);

  const handleCreate = async () => {
    // Validation
    const newWarnings = [];
    
    if (!formData.screenName || !formData.status) {
      setError('Screen name and status are required');
      return;
    }

    if (isDuplicateStatus) {
      setError(`Status "${formData.status}" already exists! Choose a different name.`);
      return;
    }

    if (!formData.previousState) {
      newWarnings.push('No previous state set - this will be an entry point');
    }

    if (!formData.entity) {
      newWarnings.push('No entity specified - consider adding one for better organization');
    }

    setWarnings(newWarnings);
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
          outputPath: formData.outputPath
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Creation failed');
      }

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
    setError(null); // Clear error on change
  };

  // Auto-suggest status when screenName changes
  const handleScreenNameChange = (value) => {
    updateField('screenName', value);
    // Auto-fill status if empty
    if (!formData.status) {
      const suggested = value
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '')
        .replace(/_+/g, '_');
      updateField('status', suggested);
    }
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
              onChange={(e) => handleScreenNameChange(e.target.value)}
              placeholder="LoginScreen"
              style={inputStyle(theme)}
            />
          </div>
          <div>
            <label style={labelStyle(theme)}>
              Status * 
              {isDuplicateStatus && (
                <span style={{ color: theme.colors.accents.red, marginLeft: '8px' }}>
                  ⚠️ Already exists!
                </span>
              )}
            </label>
            <input
              type="text"
              value={formData.status}
              onChange={(e) => updateField('status', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              placeholder={suggestedStatus || 'logged_in'}
              style={{
                ...inputStyle(theme),
                borderColor: isDuplicateStatus ? theme.colors.accents.red : theme.colors.border
              }}
              list="existing-statuses"
            />
            <datalist id="existing-statuses">
              {existingStatuses.slice(0, 20).map((s, idx) => (
                <option key={idx} value={s} />
              ))}
            </datalist>
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
              list="existing-entities"
              style={inputStyle(theme)}
            />
            <datalist id="existing-entities">
              {existingEntities.map((e, idx) => (
                <option key={idx} value={e} />
              ))}
            </datalist>
            {existingEntities.length > 0 && !formData.entity && (
              <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {existingEntities.slice(0, 5).map((e, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateField('entity', e)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      background: `${theme.colors.accents.blue}20`,
                      border: `1px solid ${theme.colors.accents.blue}40`,
                      borderRadius: '4px',
                      color: theme.colors.accents.blue,
                      cursor: 'pointer'
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
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

        {/* Row 3: Previous State (with smart suggestions) */}
        <div>
          <label style={labelStyle(theme)}>
            Previous State (requires)
            <span style={{ 
              marginLeft: '8px', 
              fontSize: '10px', 
              color: theme.colors.text.tertiary 
            }}>
              Which state transitions to this one?
            </span>
          </label>
          <input
            type="text"
            list="previous-states"
            value={formData.previousState}
            onChange={(e) => updateField('previousState', e.target.value)}
            placeholder="initial, pending, etc."
            style={inputStyle(theme)}
          />
          <datalist id="previous-states">
            <option value="initial">initial (entry point)</option>
            {potentialPreviousStates.map((s, idx) => (
              <option key={idx} value={s.status}>
                {s.status} ({s.platforms?.join(', ')})
              </option>
            ))}
          </datalist>
          
          {/* Quick-pick buttons for common previous states */}
          {potentialPreviousStates.length > 0 && !formData.previousState && (
            <div style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '11px', color: theme.colors.text.tertiary, marginRight: '8px' }}>
                Quick pick:
              </span>
              <button
                type="button"
                onClick={() => updateField('previousState', 'initial')}
                style={quickPickStyle(theme)}
              >
                initial
              </button>
              {potentialPreviousStates.slice(0, 4).map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => updateField('previousState', s.status)}
                  style={quickPickStyle(theme)}
                >
                  {s.status}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 4: Trigger Event */}
        <div>
          <label style={labelStyle(theme)}>
            Trigger Event
            <span style={{ 
              marginLeft: '8px', 
              fontSize: '10px', 
              color: theme.colors.text.tertiary 
            }}>
              What action leads to this state?
            </span>
          </label>
          <input
            type="text"
            value={formData.triggerEvent}
            onChange={(e) => updateField('triggerEvent', e.target.value.toUpperCase().replace(/\s+/g, '_'))}
            placeholder="LOGIN, SUBMIT_FORM, CLICK_BUTTON"
            style={inputStyle(theme)}
          />
          {/* Suggest events based on detected buttons */}
          {result.elements?.filter(e => e.type === 'button').length > 0 && !formData.triggerEvent && (
            <div style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '11px', color: theme.colors.text.tertiary, marginRight: '8px' }}>
                From detected buttons:
              </span>
              {result.elements
                .filter(e => e.type === 'button')
                .slice(0, 4)
                .map((btn, idx) => {
                  const event = `CLICK_${btn.name.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => updateField('triggerEvent', event)}
                      style={quickPickStyle(theme)}
                    >
                      {event}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {/* Row 5: Tags */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle(theme)}>Screen Tag</label>
            <input
              type="text"
              value={formData.tags.screen}
              onChange={(e) => updateField('tags', { ...formData.tags, screen: e.target.value })}
              placeholder="Auth, Dashboard"
              list="screen-tags"
              style={inputStyle(theme)}
            />
            <datalist id="screen-tags">
              {existingTags.screen?.map((t, idx) => (
                <option key={idx} value={t} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={labelStyle(theme)}>Group Tag</label>
            <input
              type="text"
              value={formData.tags.group}
              onChange={(e) => updateField('tags', { ...formData.tags, group: e.target.value })}
              placeholder="login-flow, checkout"
              list="group-tags"
              style={inputStyle(theme)}
            />
            <datalist id="group-tags">
              {existingTags.group?.map((t, idx) => (
                <option key={idx} value={t} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Output Path */}
        <div>
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
            📁 {formData.outputPath}/{formData.screenName || '[ScreenName]'}Implications.js
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

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: `${theme.colors.accents.yellow}15`,
          borderRadius: '6px',
          fontSize: '12px',
          color: theme.colors.accents.yellow
        }}>
          {warnings.map((w, idx) => (
            <div key={idx}>⚠️ {w}</div>
          ))}
        </div>
      )}

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
        disabled={creating || !formData.screenName || !formData.status || isDuplicateStatus}
        style={{
          marginTop: '16px',
          width: '100%',
          padding: '12px',
          background: creating || !formData.screenName || !formData.status || isDuplicateStatus
            ? theme.colors.background.tertiary
            : theme.colors.accents.purple,
          color: creating || isDuplicateStatus ? theme.colors.text.tertiary : 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '14px',
          cursor: creating || isDuplicateStatus ? 'not-allowed' : 'pointer'
        }}
      >
        {creating ? '⏳ Creating...' : isDuplicateStatus ? '⚠️ Status Already Exists' : '🔧 Create Implication'}
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

const quickPickStyle = (theme) => ({
  padding: '2px 8px',
  fontSize: '10px',
  background: `${theme.colors.accents.green}20`,
  border: `1px solid ${theme.colors.accents.green}40`,
  borderRadius: '4px',
  color: theme.colors.accents.green,
  cursor: 'pointer',
  marginRight: '4px'
});