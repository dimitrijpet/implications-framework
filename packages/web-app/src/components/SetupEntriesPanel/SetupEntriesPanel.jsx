// packages/web-app/src/components/SetupEntriesPanel/SetupEntriesPanel.jsx
// UI for viewing and editing setup entries in implication files

import { useState, useEffect } from 'react';

export default function SetupEntriesPanel({ 
  filePath, 
  projectPath,
  theme,
  onRefresh 
}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    testFile: '',
    actionName: '',
    platform: 'web',
    previousStatus: '',
    requires: ''
  });

  // Load setup entries
  useEffect(() => {
    if (filePath) {
      loadEntries();
    }
  }, [filePath]);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `http://localhost:3000/api/implications/setup-entries?filePath=${encodeURIComponent(filePath)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load setup entries');
      }
      
      const data = await response.json();
      setEntries(data.setup || []);
    } catch (err) {
      console.error('Error loading setup entries:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (index) => {
    const entry = entries[index];
    setEditForm({
      testFile: entry.testFile || '',
      actionName: entry.actionName || '',
      platform: entry.platform || 'web',
      previousStatus: entry.previousStatus || '',
      requires: entry.requires ? JSON.stringify(entry.requires) : '',
      mode: entry.mode || ''
    });
    setEditingIndex(index);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    
    try {
      // Parse requires if provided
      let requires = null;
      if (editForm.requires && editForm.requires.trim()) {
        try {
          requires = JSON.parse(editForm.requires);
        } catch (e) {
          alert('Invalid JSON in requires field');
          setSaving(false);
          return;
        }
      }
      
      const updates = {
        testFile: editForm.testFile,
        actionName: editForm.actionName,
        platform: editForm.platform,
        previousStatus: editForm.previousStatus
      };
      
      if (requires) {
        updates.requires = requires;
      }
      
      if (editForm.mode) {
        updates.mode = editForm.mode;
      }
      
      const response = await fetch('http://localhost:3000/api/implications/update-setup-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          index: editingIndex,
          updates
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update');
      }
      
      await loadEntries();
      setEditingIndex(null);
      setEditForm({});
      
      if (onRefresh) onRefresh();
      
    } catch (err) {
      console.error('Error saving:', err);
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (index) => {
    const entry = entries[index];
    
    if (!window.confirm(`Delete setup entry for "${entry.previousStatus}"?`)) {
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3000/api/implications/delete-setup-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          index
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete');
      }
      
      await loadEntries();
      if (onRefresh) onRefresh();
      
    } catch (err) {
      console.error('Error deleting:', err);
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleAddEntry = async () => {
    setSaving(true);
    
    try {
      let requires = null;
      if (newEntry.requires && newEntry.requires.trim()) {
        try {
          requires = JSON.parse(newEntry.requires);
        } catch (e) {
          alert('Invalid JSON in requires field');
          setSaving(false);
          return;
        }
      }
      
      const entry = {
        testFile: newEntry.testFile,
        actionName: newEntry.actionName,
        platform: newEntry.platform,
        previousStatus: newEntry.previousStatus
      };
      
      if (requires) {
        entry.requires = requires;
      }
      
      const response = await fetch('http://localhost:3000/api/implications/add-setup-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, entry })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add');
      }
      
      await loadEntries();
      setShowAddForm(false);
      setNewEntry({
        testFile: '',
        actionName: '',
        platform: 'web',
        previousStatus: '',
        requires: ''
      });
      
      if (onRefresh) onRefresh();
      
    } catch (err) {
      console.error('Error adding:', err);
      alert(`Failed to add: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Detect potential issues with entries
  const detectIssues = (entry) => {
    const issues = [];
    
    // Check if testFile matches actionName pattern
    if (entry.testFile && entry.actionName) {
      const expectedInPath = entry.actionName.charAt(0).toUpperCase() + entry.actionName.slice(1);
      if (!entry.testFile.includes(expectedInPath.replace(/([A-Z])/g, '$1'))) {
        // More lenient check - just see if the path looks wrong
        const pathParts = entry.testFile.split('/').pop()?.split('-') || [];
        const actionParts = entry.actionName.split(/(?=[A-Z])/);
        
        // If actionName is "landingPageViaCookies" but testFile has "ViaAgencyPreffered"
        if (entry.actionName.includes('Via') && entry.testFile.includes('Via')) {
          const actionVia = entry.actionName.split('Via')[1];
          const pathMatch = entry.testFile.match(/Via([A-Za-z]+)-/);
          if (pathMatch && pathMatch[1] !== actionVia) {
            issues.push({
              type: 'mismatch',
              message: `testFile has "Via${pathMatch[1]}" but actionName has "Via${actionVia}"`
            });
          }
        }
      }
    }
    
    return issues;
  };

  if (loading) {
    return (
      <div 
        className="p-6 rounded-lg text-center"
        style={{ background: theme.colors.background.secondary }}
      >
        <div className="text-2xl mb-2">⏳</div>
        <div style={{ color: theme.colors.text.tertiary }}>Loading setup entries...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="p-6 rounded-lg text-center"
        style={{ background: theme.colors.background.secondary }}
      >
        <div className="text-2xl mb-2">❌</div>
        <div style={{ color: theme.colors.accents.red }}>{error}</div>
        <button
          onClick={loadEntries}
          className="mt-4 px-4 py-2 rounded-lg"
          style={{ background: theme.colors.accents.blue, color: 'white' }}
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span style={{ color: theme.colors.text.secondary }}>
            {entries.length} setup {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadEntries}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ 
              background: theme.colors.background.tertiary,
              color: theme.colors.text.secondary
            }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ 
              background: theme.colors.accents.green,
              color: 'white'
            }}
          >
            ➕ Add Entry
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div 
          className="p-4 rounded-lg border-2"
          style={{ 
            background: theme.colors.background.secondary,
            borderColor: theme.colors.accents.green
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h4 style={{ color: theme.colors.accents.green }} className="font-semibold">
              ➕ Add New Setup Entry
            </h4>
            <button
              onClick={() => setShowAddForm(false)}
              style={{ color: theme.colors.text.tertiary }}
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                Previous Status *
              </label>
              <input
                type="text"
                value={newEntry.previousStatus}
                onChange={e => setNewEntry(prev => ({ ...prev, previousStatus: e.target.value }))}
                placeholder="cookies"
                className="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              />
            </div>
            
            <div>
              <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                Platform
              </label>
              <select
                value={newEntry.platform}
                onChange={e => setNewEntry(prev => ({ ...prev, platform: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              >
                <option value="web">web</option>
                <option value="dancer">dancer</option>
                <option value="manager">manager</option>
                <option value="clubApp">clubApp</option>
              </select>
            </div>
            
            <div className="col-span-2">
              <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                Action Name *
              </label>
              <input
                type="text"
                value={newEntry.actionName}
                onChange={e => setNewEntry(prev => ({ ...prev, actionName: e.target.value }))}
                placeholder="landingPageViaCookies"
                className="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              />
            </div>
            
            <div className="col-span-2">
              <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                Test File *
              </label>
              <input
                type="text"
                value={newEntry.testFile}
                onChange={e => setNewEntry(prev => ({ ...prev, testFile: e.target.value }))}
                placeholder="tests/implications/bookings/status/LandingPageViaCookies-ACCEPT-Web-UNIT.spec.js"
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              />
            </div>
            
            <div className="col-span-2">
              <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                Requires (JSON, optional)
              </label>
              <input
                type="text"
                value={newEntry.requires}
                onChange={e => setNewEntry(prev => ({ ...prev, requires: e.target.value }))}
                placeholder='{"acceptCookies": true}'
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{
                  background: theme.colors.background.tertiary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.text.primary
                }}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg"
              style={{ 
                background: theme.colors.background.tertiary,
                color: theme.colors.text.secondary
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddEntry}
              disabled={saving || !newEntry.testFile || !newEntry.actionName || !newEntry.previousStatus}
              className="px-4 py-2 rounded-lg font-semibold"
              style={{ 
                background: theme.colors.accents.green,
                color: 'white',
                opacity: (!newEntry.testFile || !newEntry.actionName || !newEntry.previousStatus) ? 0.5 : 1
              }}
            >
              {saving ? '💾 Adding...' : '➕ Add Entry'}
            </button>
          </div>
        </div>
      )}

      {/* Entries List */}
      {entries.length === 0 ? (
        <div 
          className="p-6 rounded-lg text-center"
          style={{ background: theme.colors.background.secondary }}
        >
          <div className="text-2xl mb-2">📭</div>
          <div style={{ color: theme.colors.text.tertiary }}>No setup entries</div>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => {
            const issues = detectIssues(entry);
            const isEditing = editingIndex === index;
            
            return (
              <div
                key={index}
                className="p-4 rounded-lg border-2"
                style={{
                  background: theme.colors.background.secondary,
                  borderColor: issues.length > 0 
                    ? theme.colors.accents.red 
                    : isEditing 
                      ? theme.colors.accents.blue 
                      : theme.colors.border
                }}
              >
                {/* Issue Warning */}
                {issues.length > 0 && !isEditing && (
                  <div 
                    className="mb-3 px-3 py-2 rounded text-sm flex items-start gap-2"
                    style={{ 
                      background: `${theme.colors.accents.red}20`,
                      color: theme.colors.accents.red
                    }}
                  >
                    <span>⚠️</span>
                    <div>
                      <div className="font-semibold">Potential Issue Detected</div>
                      {issues.map((issue, i) => (
                        <div key={i}>{issue.message}</div>
                      ))}
                    </div>
                  </div>
                )}

                {isEditing ? (
                  /* Edit Form */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span 
                        className="text-sm font-semibold"
                        style={{ color: theme.colors.accents.blue }}
                      >
                        ✏️ Editing Entry #{index}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                          Previous Status
                        </label>
                        <input
                          type="text"
                          value={editForm.previousStatus}
                          onChange={e => setEditForm(prev => ({ ...prev, previousStatus: e.target.value }))}
                          className="w-full px-3 py-2 rounded text-sm"
                          style={{
                            background: theme.colors.background.tertiary,
                            border: `1px solid ${theme.colors.border}`,
                            color: theme.colors.text.primary
                          }}
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                          Platform
                        </label>
                        <select
                          value={editForm.platform}
                          onChange={e => setEditForm(prev => ({ ...prev, platform: e.target.value }))}
                          className="w-full px-3 py-2 rounded text-sm"
                          style={{
                            background: theme.colors.background.tertiary,
                            border: `1px solid ${theme.colors.border}`,
                            color: theme.colors.text.primary
                          }}
                        >
                          <option value="web">web</option>
                          <option value="dancer">dancer</option>
                          <option value="manager">manager</option>
                          <option value="clubApp">clubApp</option>
                        </select>
                      </div>
                      
                      <div className="col-span-2">
                        <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                          Action Name
                        </label>
                        <input
                          type="text"
                          value={editForm.actionName}
                          onChange={e => setEditForm(prev => ({ ...prev, actionName: e.target.value }))}
                          className="w-full px-3 py-2 rounded text-sm"
                          style={{
                            background: theme.colors.background.tertiary,
                            border: `1px solid ${theme.colors.border}`,
                            color: theme.colors.text.primary
                          }}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                          Test File
                        </label>
                        <input
                          type="text"
                          value={editForm.testFile}
                          onChange={e => setEditForm(prev => ({ ...prev, testFile: e.target.value }))}
                          className="w-full px-3 py-2 rounded text-sm font-mono"
                          style={{
                            background: theme.colors.background.tertiary,
                            border: `1px solid ${theme.colors.border}`,
                            color: theme.colors.text.primary
                          }}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                          Requires (JSON)
                        </label>
                        <input
                          type="text"
                          value={editForm.requires}
                          onChange={e => setEditForm(prev => ({ ...prev, requires: e.target.value }))}
                          placeholder='{"acceptCookies": true}'
                          className="w-full px-3 py-2 rounded text-sm font-mono"
                          style={{
                            background: theme.colors.background.tertiary,
                            border: `1px solid ${theme.colors.border}`,
                            color: theme.colors.text.primary
                          }}
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                          Mode (optional)
                        </label>
                        <select
                          value={editForm.mode || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, mode: e.target.value }))}
                          className="w-full px-3 py-2 rounded text-sm"
                          style={{
                            background: theme.colors.background.tertiary,
                            border: `1px solid ${theme.colors.border}`,
                            color: theme.colors.text.primary
                          }}
                        >
                          <option value="">Normal</option>
                          <option value="observer">Observer</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 rounded-lg"
                        style={{ 
                          background: theme.colors.background.tertiary,
                          color: theme.colors.text.secondary
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg font-semibold"
                        style={{ 
                          background: theme.colors.accents.green,
                          color: 'white'
                        }}
                      >
                        {saving ? '💾 Saving...' : '💾 Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display View */
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Header Row */}
                        <div className="flex items-center gap-2 mb-2">
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{
                              background: `${theme.colors.accents.purple}20`,
                              color: theme.colors.accents.purple
                            }}
                          >
                            #{index}
                          </span>
                          <span style={{ color: theme.colors.text.primary }} className="font-semibold">
                            {entry.previousStatus}
                          </span>
                          <span style={{ color: theme.colors.text.tertiary }}>→</span>
                          <span 
                            className="px-2 py-0.5 rounded text-xs"
                            style={{
                              background: `${theme.colors.accents.blue}20`,
                              color: theme.colors.accents.blue
                            }}
                          >
                            {entry.platform}
                          </span>
                          {entry.mode && (
                            <span 
                              className="px-2 py-0.5 rounded text-xs"
                              style={{
                                background: `${theme.colors.accents.orange}20`,
                                color: theme.colors.accents.orange
                              }}
                            >
                              👁️ {entry.mode}
                            </span>
                          )}
                        </div>
                        
                        {/* Action Name */}
                        <div className="mb-1">
                          <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                            actionName:{' '}
                          </span>
                          <code 
                            className="text-sm px-1.5 py-0.5 rounded"
                            style={{ 
                              background: theme.colors.background.tertiary,
                              color: theme.colors.accents.cyan
                            }}
                          >
                            {entry.actionName}
                          </code>
                        </div>
                        
                        {/* Test File */}
                        <div className="mb-1">
                          <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                            testFile:{' '}
                          </span>
                          <code 
                            className="text-xs px-1.5 py-0.5 rounded break-all"
                            style={{ 
                              background: theme.colors.background.tertiary,
                              color: theme.colors.text.secondary
                            }}
                          >
                            {entry.testFile}
                          </code>
                        </div>
                        
                        {/* Requires */}
                        {entry.requires && Object.keys(entry.requires).length > 0 && (
                          <div>
                            <span className="text-xs" style={{ color: theme.colors.text.tertiary }}>
                              requires:{' '}
                            </span>
                            <code 
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ 
                                background: `${theme.colors.accents.yellow}15`,
                                color: theme.colors.accents.yellow
                              }}
                            >
                              {JSON.stringify(entry.requires)}
                            </code>
                          </div>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-1 ml-4">
                        <button
                          onClick={() => handleEdit(index)}
                          className="p-2 rounded hover:brightness-110"
                          style={{ 
                            background: theme.colors.background.tertiary,
                            color: theme.colors.accents.blue
                          }}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(index)}
                          className="p-2 rounded hover:brightness-110"
                          style={{ 
                            background: theme.colors.background.tertiary,
                            color: theme.colors.accents.red
                          }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}