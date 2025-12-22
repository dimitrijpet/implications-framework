// packages/web-app/src/components/StateGraph/TransitionsPanel.jsx

import { useState } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';

/**
 * TransitionsPanel - Shows incoming and outgoing transitions for a state
 */
export default function TransitionsPanel({
  currentState,
  incomingTransitions = [],
  outgoingTransitions = [],
  allStates = {},
  projectPath,
  discoveryResult,
  theme = defaultTheme,
  isEditMode = false,
  onEditTransition,
  onDeleteTransition,
  onAddTransition,
}) {
  const [activeTab, setActiveTab] = useState('incoming');

  const stateName = currentState?.meta?.status || currentState?.name || 'Unknown';

  // Safe color accessors with fallbacks
  const colors = {
    cyan: theme?.colors?.accents?.cyan || '#06b6d4',
    green: theme?.colors?.accents?.green || '#10b981',
    blue: theme?.colors?.accents?.blue || '#3b82f6',
    purple: theme?.colors?.accents?.purple || '#8b5cf6',
    yellow: theme?.colors?.accents?.yellow || '#f59e0b',
    orange: theme?.colors?.accents?.orange || '#f97316',
    red: theme?.colors?.accents?.red || '#ef4444',
    textPrimary: theme?.colors?.text?.primary || '#ffffff',
    textSecondary: theme?.colors?.text?.secondary || '#9ca3af',
    textTertiary: theme?.colors?.text?.tertiary || '#6b7280',
    bgPrimary: theme?.colors?.background?.primary || '#111827',
    bgSecondary: theme?.colors?.background?.secondary || '#1f2937',
    bgTertiary: theme?.colors?.background?.tertiary || '#374151',
    border: theme?.colors?.border || '#4b5563',
  };

  // Get source file for a given state name
  const getStateFile = (stateNameToFind) => {
    if (!discoveryResult?.files?.implications) return null;
    
    const imp = discoveryResult.files.implications.find(imp => {
      const impStatus = imp.metadata?.status || imp.metadata?.xstateConfig?.id;
      return impStatus === stateNameToFind;
    });
    
    return imp ? `${projectPath}/${imp.path}` : null;
  };

  // Handle edit for incoming transition (needs source state's file)
  const handleEditIncoming = (transition, index) => {
    const sourceFile = getStateFile(transition.from);
    if (!sourceFile) {
      alert(`❌ Could not find source file for state "${transition.from}"`);
      return;
    }
    
    // Build transition data for edit modal
    const transitionData = {
      ...transition,
      event: transition.event,
      target: transition.to || stateName,
      sourceFile: sourceFile,
      sourceState: transition.from,
    };
    
    onEditTransition?.(transitionData, 'incoming', sourceFile, index);
  };

  // Handle delete for incoming transition
  const handleDeleteIncoming = async (transition, index) => {
    if (!window.confirm(`Delete incoming transition "${transition.event}" from "${transition.from}"?`)) {
      return;
    }
    
    const sourceFile = getStateFile(transition.from);
    if (!sourceFile) {
      alert(`❌ Could not find source file for state "${transition.from}"`);
      return;
    }
    
    onDeleteTransition?.(transition, 'incoming', sourceFile, index);
  };

  // Handle edit for outgoing transition
  const handleEditOutgoing = (transition, index) => {
    onEditTransition?.(transition, 'outgoing', currentState.files?.implication, index);
  };

  // Handle delete for outgoing transition
  const handleDeleteOutgoing = (transition, index) => {
    if (!window.confirm(`Delete outgoing transition "${transition.event}" to "${transition.target}"?`)) {
      return;
    }
    onDeleteTransition?.(transition, 'outgoing', currentState.files?.implication, index);
  };

  const renderTransitionBadges = (transition) => {
    const platforms = transition.platforms || (transition.platform ? [transition.platform] : []);
    const hasActionDetails = !!transition.actionDetails;
    const hasConditions = !!(transition.conditions?.blocks?.length > 0 || 
                            (transition.requires && Object.keys(transition.requires).length > 0));
    const isObserver = transition.isObserver || transition.mode === 'observer';
    const stepsCount = transition.actionDetails?.steps?.length || 0;

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Platform badges */}
        {platforms.map((p, i) => (
          <span
            key={i}
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: `${colors.blue}20`,
              color: colors.blue,
            }}
          >
            {p === 'web' ? '🌐' : '📱'} {p}
          </span>
        ))}

        {/* Has action details */}
        {hasActionDetails && (
          <span
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: `${colors.green}20`,
              color: colors.green,
            }}
            title={`${stepsCount} step${stepsCount !== 1 ? 's' : ''}`}
          >
            ⚡ {stepsCount} step{stepsCount !== 1 ? 's' : ''}
          </span>
        )}

        {/* Has conditions */}
        {hasConditions && (
          <span
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: `${colors.purple}20`,
              color: colors.purple,
            }}
            title="Has conditions/requires"
          >
            🔀 conditional
          </span>
        )}

        {/* Observer mode */}
        {isObserver && (
          <span
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: `${colors.cyan}20`,
              color: colors.cyan,
            }}
            title="Observer mode - validates but doesn't create state"
          >
            👁️ observer
          </span>
        )}
      </div>
    );
  };

  const renderIncomingTransition = (transition, index) => {
    const fromState = transition.from;
    
    return (
      <div
        key={`incoming-${index}`}
        className="p-3 rounded-lg group transition-all hover:brightness-105"
        style={{
          backgroundColor: colors.bgTertiary,
          border: `1px solid ${colors.cyan}30`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            {/* From state */}
            <span
              className="px-2 py-1 rounded text-sm font-semibold"
              style={{
                backgroundColor: `${colors.cyan}20`,
                color: colors.cyan,
              }}
            >
              {fromState}
            </span>

            {/* Arrow with event */}
            <div className="flex items-center" style={{ color: colors.textTertiary }}>
              <span>──</span>
              <span
                className="px-2 py-0.5 rounded text-xs font-mono mx-1"
                style={{
                  backgroundColor: colors.blue,
                  color: 'white',
                }}
              >
                {transition.event}
              </span>
              <span>──→</span>
            </div>

            {/* To state (current) */}
            <span
              className="px-2 py-1 rounded text-sm font-semibold"
              style={{
                backgroundColor: `${colors.green}20`,
                color: colors.green,
              }}
            >
              {stateName} (here)
            </span>
          </div>

          {/* Edit/Delete buttons */}
          {isEditMode && (
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleEditIncoming(transition, index)}
                className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
                style={{
                  backgroundColor: colors.blue,
                  color: 'white',
                }}
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => handleDeleteIncoming(transition, index)}
                className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
                style={{
                  backgroundColor: colors.red,
                  color: 'white',
                }}
              >
                🗑️
              </button>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="mt-2">
          {renderTransitionBadges(transition)}
        </div>

        {/* StoreAs variables from this transition */}
        {transition.actionDetails?.steps?.some(s => s.storeAs) && (
          <div
            className="mt-2 p-2 rounded text-xs"
            style={{
              backgroundColor: `${colors.yellow}10`,
              border: `1px solid ${colors.yellow}30`,
            }}
          >
            <span style={{ color: colors.yellow }}>💾 Produces: </span>
            {transition.actionDetails.steps
              .filter(s => s.storeAs)
              .map((s, i) => (
                <code
                  key={i}
                  className="px-1 rounded mx-0.5"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    color: colors.yellow,
                  }}
                >
                  {typeof s.storeAs === 'object' ? s.storeAs.key : s.storeAs}
                </code>
              ))}
          </div>
        )}
      </div>
    );
  };

  const renderOutgoingTransition = (transition, index) => {
    const toState = transition.target || transition.to;

    return (
      <div
        key={`outgoing-${index}`}
        className="p-3 rounded-lg group transition-all hover:brightness-105"
        style={{
          backgroundColor: colors.bgTertiary,
          border: `1px solid ${colors.green}30`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            {/* From state (current) */}
            <span
              className="px-2 py-1 rounded text-sm font-semibold"
              style={{
                backgroundColor: `${colors.cyan}20`,
                color: colors.cyan,
              }}
            >
              {stateName} (here)
            </span>

            {/* Arrow with event */}
            <div className="flex items-center" style={{ color: colors.textTertiary }}>
              <span>──</span>
              <span
                className="px-2 py-0.5 rounded text-xs font-mono mx-1"
                style={{
                  backgroundColor: colors.blue,
                  color: 'white',
                }}
              >
                {transition.event}
              </span>
              <span>──→</span>
            </div>

            {/* To state */}
            <span
              className="px-2 py-1 rounded text-sm font-semibold"
              style={{
                backgroundColor: `${colors.green}20`,
                color: colors.green,
              }}
            >
              {toState}
            </span>
          </div>

          {/* Edit/Delete buttons */}
          {isEditMode && (
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleEditOutgoing(transition, index)}
                className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
                style={{
                  backgroundColor: colors.blue,
                  color: 'white',
                }}
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => handleDeleteOutgoing(transition, index)}
                className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
                style={{
                  backgroundColor: colors.red,
                  color: 'white',
                }}
              >
                🗑️
              </button>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="mt-2">
          {renderTransitionBadges(transition)}
        </div>

        {/* StoreAs variables from this transition */}
        {transition.actionDetails?.steps?.some(s => s.storeAs) && (
          <div
            className="mt-2 p-2 rounded text-xs"
            style={{
              backgroundColor: `${colors.yellow}10`,
              border: `1px solid ${colors.yellow}30`,
            }}
          >
            <span style={{ color: colors.yellow }}>💾 Produces: </span>
            {transition.actionDetails.steps
              .filter(s => s.storeAs)
              .map((s, i) => (
                <code
                  key={i}
                  className="px-1 rounded mx-0.5"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    color: colors.yellow,
                  }}
                >
                  {typeof s.storeAs === 'object' ? s.storeAs.key : s.storeAs}
                </code>
              ))}
          </div>
        )}
      </div>
    );
  };

  const incomingCount = incomingTransitions.length;
  const outgoingCount = outgoingTransitions.length;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: colors.bgSecondary,
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Header with tabs */}
      <div
        className="flex items-center justify-between p-4 border-b flex-wrap gap-3"
        style={{ borderColor: colors.border }}
      >
        <h2
          className="text-xl font-bold"
          style={{ color: colors.textPrimary }}
        >
          🔄 Transitions
        </h2>

        {/* Tab buttons */}
        <div 
          className="flex rounded-lg overflow-hidden" 
          style={{ backgroundColor: colors.bgTertiary }}
        >
          <button
            onClick={() => setActiveTab('incoming')}
            className="px-4 py-2 text-sm font-semibold transition"
            style={{
              backgroundColor: activeTab === 'incoming' ? colors.cyan : 'transparent',
              color: activeTab === 'incoming' ? 'white' : colors.textSecondary,
            }}
          >
            ⬅️ Incoming ({incomingCount})
          </button>
          <button
            onClick={() => setActiveTab('outgoing')}
            className="px-4 py-2 text-sm font-semibold transition"
            style={{
              backgroundColor: activeTab === 'outgoing' ? colors.green : 'transparent',
              color: activeTab === 'outgoing' ? 'white' : colors.textSecondary,
            }}
          >
            ➡️ Outgoing ({outgoingCount})
          </button>
        </div>

        {/* Add button (only for outgoing, since incoming are added from other states) */}
        {isEditMode && activeTab === 'outgoing' && (
          <button
            onClick={onAddTransition}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition hover:brightness-110"
            style={{
              backgroundColor: colors.green,
              color: 'white',
            }}
          >
            ➕ Add
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {activeTab === 'incoming' ? (
          incomingCount === 0 ? (
            <div
              className="text-center py-8"
              style={{ color: colors.textTertiary }}
            >
              <div className="text-4xl mb-2">📭</div>
              <div className="font-semibold" style={{ color: colors.textSecondary }}>
                No Incoming Transitions
              </div>
              <div className="text-sm mt-1">
                No other states lead to "{stateName}"
              </div>
              {stateName === 'initial' && (
                <div
                  className="text-xs mt-2 px-3 py-1 rounded inline-block"
                  style={{
                    backgroundColor: `${colors.blue}20`,
                    color: colors.blue,
                  }}
                >
                  💡 This is the initial state - it has no predecessors
                </div>
              )}
            </div>
          ) : (
            incomingTransitions.map((t, i) => renderIncomingTransition(t, i))
          )
        ) : (
          outgoingCount === 0 ? (
            <div
              className="text-center py-8"
              style={{ color: colors.textTertiary }}
            >
              <div className="text-4xl mb-2">📭</div>
              <div className="font-semibold" style={{ color: colors.textSecondary }}>
                No Outgoing Transitions
              </div>
              <div className="text-sm mt-1">
                "{stateName}" doesn't lead to any other states
              </div>
              {isEditMode && (
                <button
                  onClick={onAddTransition}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold transition hover:brightness-110"
                  style={{
                    backgroundColor: colors.green,
                    color: 'white',
                  }}
                >
                  ➕ Add Transition
                </button>
              )}
            </div>
          ) : (
            outgoingTransitions.map((t, i) => renderOutgoingTransition(t, i))
          )
        )}
      </div>

      {/* Summary footer */}
      <div
        className="px-4 py-3 border-t flex items-center justify-between text-xs flex-wrap gap-2"
        style={{
          borderColor: colors.border,
          backgroundColor: colors.bgTertiary,
          color: colors.textTertiary,
        }}
      >
        <div className="flex items-center gap-4">
          <span>
            <span style={{ color: colors.cyan }}>⬅️ {incomingCount}</span> incoming
          </span>
          <span>
            <span style={{ color: colors.green }}>➡️ {outgoingCount}</span> outgoing
          </span>
        </div>
        <div>
          Total: {incomingCount + outgoingCount} transitions
        </div>
      </div>
    </div>
  );
}