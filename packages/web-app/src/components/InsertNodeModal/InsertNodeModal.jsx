// packages/web-app/src/components/InsertNodeModal/InsertNodeModal.jsx
// ✨ Modal for inserting a node between two existing states in the graph

import { useState, useEffect, useMemo } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';

const API_URL = 'http://localhost:3000';

export default function InsertNodeModal({
  isOpen,
  onClose,
  onSuccess,
  projectPath,
  // Edge info (the transition we're inserting into)
  sourceState,      // e.g., "booking_created"
  targetState,      // e.g., "booking_pending"
  originalEvent,    // e.g., "REQUEST_BOOKING"
  originalPlatforms, // e.g., ["dancer"]
  // Node to insert (if pre-selected via drag)
  preSelectedNode = null,
  // Available orphan/unconnected nodes
  availableNodes = [],
  theme = defaultTheme,
}) {
  // Form state
  const [selectedNode, setSelectedNode] = useState(preSelectedNode || '');
  const [keepEventOn, setKeepEventOn] = useState('first'); // 'first' or 'second'
  const [newEventName, setNewEventName] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState(originalPlatforms || ['web']);
  const [copyActionDetails, setCopyActionDetails] = useState(true);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Available platforms from config
  const availablePlatforms = ['web', 'dancer', 'manager'];

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedNode(preSelectedNode || '');
      setKeepEventOn('first');
      setNewEventName('');
      setSelectedPlatforms(originalPlatforms || ['web']);
      setCopyActionDetails(true);
      setError(null);
    }
  }, [isOpen, preSelectedNode, originalPlatforms]);

  // Computed preview
  const preview = useMemo(() => {
    if (!selectedNode || !newEventName) return null;

    const firstEvent = keepEventOn === 'first' ? originalEvent : newEventName;
    const secondEvent = keepEventOn === 'first' ? newEventName : originalEvent;

    return {
      before: {
        from: sourceState,
        event: originalEvent,
        to: targetState
      },
      after: {
        first: {
          from: sourceState,
          event: firstEvent,
          to: selectedNode
        },
        second: {
          from: selectedNode,
          event: secondEvent,
          to: targetState
        }
      }
    };
  }, [selectedNode, keepEventOn, newEventName, sourceState, targetState, originalEvent]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors = [];
    
    if (!selectedNode) {
      errors.push('Please select a node to insert');
    }
    
    if (!newEventName) {
      errors.push('Please enter a name for the new transition');
    } else if (!/^[A-Z][A-Z0-9_]*$/.test(newEventName)) {
      errors.push('Event name must be UPPER_SNAKE_CASE (e.g., APPROVE_BOOKING)');
    } else if (newEventName === originalEvent) {
      errors.push('New event name must be different from the original');
    }
    
    if (selectedNode === sourceState) {
      errors.push('Cannot insert the source state');
    }
    
    if (selectedNode === targetState) {
      errors.push('Cannot insert the target state');
    }
    
    return errors;
  }, [selectedNode, newEventName, originalEvent, sourceState, targetState]);

  const isValid = validationErrors.length === 0;

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isValid) {
      setError(validationErrors[0]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔗 Inserting node between edges...');
      
      const response = await fetch(`${API_URL}/api/implications/graph/insert-node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          sourceState,
          targetState,
          insertState: selectedNode,
          originalEvent,
          keepEventOn,
          newEventName,
          platforms: selectedPlatforms,
          copyActionDetails
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to insert node');
      }

      console.log('✅ Node inserted successfully:', result);
      
      // Call success callback
      if (onSuccess) {
        onSuccess(result);
      }
      
      onClose();
      
    } catch (err) {
      console.error('❌ Insert node failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Platform toggle handler
  const togglePlatform = (platform) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platform)) {
        // Don't allow removing last platform
        if (prev.length === 1) return prev;
        return prev.filter(p => p !== platform);
      } else {
        return [...prev, platform];
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ 
          background: theme.colors.background.primary,
          border: `2px solid ${theme.colors.accents.blue}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div 
          className="sticky top-0 z-10 p-6 border-b"
          style={{ 
            background: `${theme.colors.accents.blue}15`,
            borderColor: theme.colors.accents.blue
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 
                className="text-2xl font-bold flex items-center gap-2"
                style={{ color: theme.colors.accents.blue }}
              >
                🔗 Insert Node Between States
              </h2>
              <p 
                className="text-sm mt-1"
                style={{ color: theme.colors.text.secondary }}
              >
                Insert a state between <strong>{sourceState}</strong> and <strong>{targetState}</strong>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition hover:brightness-110"
              style={{ 
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* CURRENT TRANSITION INFO */}
          <div 
            className="p-4 rounded-lg"
            style={{ 
              background: `${theme.colors.background.secondary}`,
              border: `1px solid ${theme.colors.border}`
            }}
          >
            <div 
              className="text-sm font-semibold mb-2"
              style={{ color: theme.colors.text.tertiary }}
            >
              📋 Current Transition
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                className="px-3 py-1 rounded-lg font-semibold"
                style={{ 
                  background: theme.colors.accents.purple,
                  color: 'white'
                }}
              >
                {sourceState}
              </span>
              <span style={{ color: theme.colors.text.secondary }}>──</span>
              <span 
                className="px-2 py-1 rounded text-sm font-mono"
                style={{ 
                  background: theme.colors.accents.blue,
                  color: 'white'
                }}
              >
                {originalEvent}
              </span>
              <span style={{ color: theme.colors.text.secondary }}>──▶</span>
              <span 
                className="px-3 py-1 rounded-lg font-semibold"
                style={{ 
                  background: theme.colors.accents.green,
                  color: 'white'
                }}
              >
                {targetState}
              </span>
            </div>
            {originalPlatforms && originalPlatforms.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span 
                  className="text-xs"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  Platforms:
                </span>
                {originalPlatforms.map(p => (
                  <span 
                    key={p}
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ 
                      background: `${theme.colors.accents.cyan}20`,
                      color: theme.colors.accents.cyan
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* SELECT NODE TO INSERT */}
          <div>
            <label 
              className="block text-sm font-semibold mb-2"
              style={{ color: theme.colors.text.primary }}
            >
              🎯 Node to Insert <span style={{ color: theme.colors.accents.red }}>*</span>
            </label>
            <select
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
              className="w-full p-3 rounded-lg"
              style={{
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`
              }}
            >
              <option value="">-- Select a state --</option>
              {availableNodes
                .filter(n => n.id !== sourceState && n.id !== targetState)
                .map(node => (
                  <option key={node.id} value={node.id}>
                    {node.label || node.id}
                  </option>
                ))
              }
            </select>
            <p 
              className="text-xs mt-1"
              style={{ color: theme.colors.text.tertiary }}
            >
              Select the state you want to insert between the current transition
            </p>
          </div>

          {/* EVENT PLACEMENT */}
          <div>
            <label 
              className="block text-sm font-semibold mb-2"
              style={{ color: theme.colors.text.primary }}
            >
              📍 Keep Original Event On <span style={{ color: theme.colors.accents.red }}>*</span>
            </label>
            
            <div className="space-y-2">
              {/* Option A: Keep on first segment */}
              <label 
                className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition"
                style={{ 
                  background: keepEventOn === 'first' 
                    ? `${theme.colors.accents.blue}15` 
                    : theme.colors.background.tertiary,
                  border: `2px solid ${keepEventOn === 'first' 
                    ? theme.colors.accents.blue 
                    : theme.colors.border}`
                }}
              >
                <input
                  type="radio"
                  name="keepEventOn"
                  value="first"
                  checked={keepEventOn === 'first'}
                  onChange={() => setKeepEventOn('first')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div 
                    className="font-semibold"
                    style={{ color: theme.colors.text.primary }}
                  >
                    First Segment
                  </div>
                  <div 
                    className="text-sm mt-1 flex items-center gap-1 flex-wrap"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    <span>{sourceState}</span>
                    <span>──</span>
                    <span 
                      className="px-1.5 py-0.5 rounded text-xs font-mono"
                      style={{ 
                        background: theme.colors.accents.blue,
                        color: 'white'
                      }}
                    >
                      {originalEvent}
                    </span>
                    <span>──▶</span>
                    <span style={{ color: theme.colors.accents.orange }}>{selectedNode || '?'}</span>
                    <span>──</span>
                    <span 
                      className="px-1.5 py-0.5 rounded text-xs font-mono"
                      style={{ 
                        background: theme.colors.accents.green,
                        color: 'white'
                      }}
                    >
                      {newEventName || 'NEW_EVENT'}
                    </span>
                    <span>──▶</span>
                    <span>{targetState}</span>
                  </div>
                </div>
              </label>

              {/* Option B: Keep on second segment */}
              <label 
                className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition"
                style={{ 
                  background: keepEventOn === 'second' 
                    ? `${theme.colors.accents.blue}15` 
                    : theme.colors.background.tertiary,
                  border: `2px solid ${keepEventOn === 'second' 
                    ? theme.colors.accents.blue 
                    : theme.colors.border}`
                }}
              >
                <input
                  type="radio"
                  name="keepEventOn"
                  value="second"
                  checked={keepEventOn === 'second'}
                  onChange={() => setKeepEventOn('second')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div 
                    className="font-semibold"
                    style={{ color: theme.colors.text.primary }}
                  >
                    Second Segment
                  </div>
                  <div 
                    className="text-sm mt-1 flex items-center gap-1 flex-wrap"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    <span>{sourceState}</span>
                    <span>──</span>
                    <span 
                      className="px-1.5 py-0.5 rounded text-xs font-mono"
                      style={{ 
                        background: theme.colors.accents.green,
                        color: 'white'
                      }}
                    >
                      {newEventName || 'NEW_EVENT'}
                    </span>
                    <span>──▶</span>
                    <span style={{ color: theme.colors.accents.orange }}>{selectedNode || '?'}</span>
                    <span>──</span>
                    <span 
                      className="px-1.5 py-0.5 rounded text-xs font-mono"
                      style={{ 
                        background: theme.colors.accents.blue,
                        color: 'white'
                      }}
                    >
                      {originalEvent}
                    </span>
                    <span>──▶</span>
                    <span>{targetState}</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* NEW EVENT NAME */}
          <div>
            <label 
              className="block text-sm font-semibold mb-2"
              style={{ color: theme.colors.text.primary }}
            >
              ✏️ New Transition Name <span style={{ color: theme.colors.accents.red }}>*</span>
            </label>
            <input
              type="text"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              placeholder="e.g., APPROVE_BOOKING"
              className="w-full p-3 rounded-lg font-mono"
              style={{
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${newEventName && !/^[A-Z][A-Z0-9_]*$/.test(newEventName) 
                  ? theme.colors.accents.red 
                  : theme.colors.border}`
              }}
            />
            <p 
              className="text-xs mt-1"
              style={{ color: theme.colors.text.tertiary }}
            >
              Must be UPPER_SNAKE_CASE (e.g., SUBMIT_FORM, APPROVE_REQUEST)
            </p>
          </div>

          {/* PLATFORMS */}
          <div>
            <label 
              className="block text-sm font-semibold mb-2"
              style={{ color: theme.colors.text.primary }}
            >
              🌐 Platforms for New Transition
            </label>
            <div className="flex gap-2 flex-wrap">
              {availablePlatforms.map(platform => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  className="px-4 py-2 rounded-lg font-semibold transition"
                  style={{
                    background: selectedPlatforms.includes(platform)
                      ? theme.colors.accents.blue
                      : theme.colors.background.tertiary,
                    color: selectedPlatforms.includes(platform)
                      ? 'white'
                      : theme.colors.text.secondary,
                    border: `1px solid ${selectedPlatforms.includes(platform)
                      ? theme.colors.accents.blue
                      : theme.colors.border}`
                  }}
                >
                  {platform === 'web' ? '🌐' : '📱'} {platform}
                </button>
              ))}
            </div>
          </div>

          {/* COPY ACTION DETAILS */}
          <div>
            <label 
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={copyActionDetails}
                onChange={(e) => setCopyActionDetails(e.target.checked)}
                className="w-5 h-5"
              />
              <div>
                <span 
                  className="font-semibold"
                  style={{ color: theme.colors.text.primary }}
                >
                  Copy action details to new transition
                </span>
                <p 
                  className="text-xs"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  If enabled, the new transition will inherit steps/actions from the original
                </p>
              </div>
            </label>
          </div>

          {/* PREVIEW */}
          {preview && (
            <div 
              className="p-4 rounded-lg"
              style={{ 
                background: `${theme.colors.accents.green}10`,
                border: `1px solid ${theme.colors.accents.green}`
              }}
            >
              <div 
                className="text-sm font-semibold mb-3 flex items-center gap-2"
                style={{ color: theme.colors.accents.green }}
              >
                ✅ Preview of Changes
              </div>
              
              {/* Before */}
              <div className="mb-3">
                <div 
                  className="text-xs font-semibold mb-1"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  Before:
                </div>
                <div 
                  className="text-sm font-mono p-2 rounded"
                  style={{ 
                    background: theme.colors.background.secondary,
                    color: theme.colors.text.secondary
                  }}
                >
                  {preview.before.from} ──{preview.before.event}──▶ {preview.before.to}
                </div>
              </div>
              
              {/* After */}
              <div>
                <div 
                  className="text-xs font-semibold mb-1"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  After:
                </div>
                <div 
                  className="text-sm font-mono p-2 rounded space-y-1"
                  style={{ 
                    background: theme.colors.background.secondary,
                    color: theme.colors.accents.green
                  }}
                >
                  <div>
                    {preview.after.first.from} ──
                    <span style={{ color: theme.colors.accents.blue }}>{preview.after.first.event}</span>
                    ──▶ <span style={{ color: theme.colors.accents.orange }}>{preview.after.first.to}</span>
                  </div>
                  <div>
                    <span style={{ color: theme.colors.accents.orange }}>{preview.after.second.from}</span> ──
                    <span style={{ color: theme.colors.accents.blue }}>{preview.after.second.event}</span>
                    ──▶ {preview.after.second.to}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ERROR MESSAGE */}
          {error && (
            <div 
              className="p-4 rounded-lg flex items-center gap-2"
              style={{ 
                background: `${theme.colors.accents.red}15`,
                border: `1px solid ${theme.colors.accents.red}`,
                color: theme.colors.accents.red
              }}
            >
              <span>❌</span>
              <span>{error}</span>
            </div>
          )}

          {/* ACTIONS */}
          <div 
            className="flex gap-3 pt-4 border-t"
            style={{ borderColor: theme.colors.border }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-lg font-semibold transition hover:brightness-110"
              style={{
                background: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                opacity: loading ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="flex-1 px-6 py-3 rounded-lg font-bold transition hover:brightness-110"
              style={{
                background: isValid ? theme.colors.accents.green : theme.colors.background.tertiary,
                color: isValid ? 'white' : theme.colors.text.tertiary,
                opacity: loading ? 0.6 : 1,
                cursor: isValid ? 'pointer' : 'not-allowed'
              }}
            >
              {loading ? '🔄 Inserting...' : '✅ Insert Node'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}