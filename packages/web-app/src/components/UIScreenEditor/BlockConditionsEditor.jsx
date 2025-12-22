// packages/web-app/src/components/UIScreenEditor/BlockConditionsEditor.jsx
// Inline conditions editor for UI validation blocks

import { useState } from "react";

const OPERATORS = [
  { value: "equals", label: "= Equals", icon: "=" },
  { value: "notEquals", label: "≠ Not Equals", icon: "≠" },
  { value: "contains", label: "⊃ Contains", icon: "⊃" },
  { value: "notContains", label: "⊅ Not Contains", icon: "⊅" },
  { value: "greaterThan", label: "> Greater Than", icon: ">" },
  { value: "lessThan", label: "< Less Than", icon: "<" },
  { value: "exists", label: "∃ Exists", icon: "∃" },
  { value: "notExists", label: "∄ Not Exists", icon: "∄" },
  { value: "truthy", label: "✓ Truthy", icon: "✓" },
  { value: "falsy", label: "✗ Falsy", icon: "✗" },
  { value: "toBeTrue", label: "is true", icon: "✔" }, 
  { value: "toBeFalse", label: "is false", icon: "✘" },
  { value: "in", label: "∈ In Array", icon: "∈" },
  { value: "startsWith", label: "⊢ Starts With", icon: "⊢" },
  { value: "endsWith", label: "⊣ Ends With", icon: "⊣" },
];

const NO_VALUE_OPERATORS = ["exists", "notExists", "truthy", "falsy", "toBeTrue", "toBeFalse"];

function generateCheckId() {
  return `chk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

function generateBlockId() {
  return `cond_check_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

export default function BlockConditionsEditor({
  conditions,
  onChange,
  theme,
  availableFields = [],
  storedVariables = [],
  collapsed = true,
  editMode = true, // Add this prop with default
}) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);

  // Initialize conditions structure if needed
  // Initialize conditions structure if needed
  const currentConditions = conditions || { mode: "all", blocks: [] };
  const conditionBlocks = currentConditions.blocks || [];
  const checksCount = conditionBlocks.reduce(
    (sum, b) => sum + (b.data?.checks?.length || 0),
    0
  );

  // Combine available fields for autocomplete
  const allFields = [
    ...(availableFields || []).map((f) => ({
      name: f?.name || f,
      type: "testData",
    })),
    ...(storedVariables || []).map((v) => ({
      name: v?.name || v,
      type: "stored",
      keys: v?.keys,
    })),
  ];

  const handleModeChange = (newMode) => {
    onChange({
      ...currentConditions,
      mode: newMode,
    });
  };

  const handleAddCheck = () => {
    const newCheck = {
      id: generateCheckId(),
      field: "",
      operator: "equals",
      value: "",
      valueType: "string",
    };

    if (conditionBlocks.length === 0) {
      // Create first condition block
      onChange({
        mode: currentConditions.mode || "all",
        blocks: [
          {
            id: generateBlockId(),
            type: "condition-check",
            enabled: true,
            mode: "all",
            data: { checks: [newCheck] },
          },
        ],
      });
    } else {
      // Add to first block
      const updatedBlocks = [...conditionBlocks];
      updatedBlocks[0] = {
        ...updatedBlocks[0],
        data: {
          ...updatedBlocks[0].data,
          checks: [...(updatedBlocks[0].data?.checks || []), newCheck],
        },
      };
      onChange({ ...currentConditions, blocks: updatedBlocks });
    }
  };

  const handleUpdateCheck = (blockIndex, checkIndex, updates) => {
    const updatedBlocks = [...conditionBlocks];
    const checks = [...(updatedBlocks[blockIndex].data?.checks || [])];
    checks[checkIndex] = { ...checks[checkIndex], ...updates };
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      data: { ...updatedBlocks[blockIndex].data, checks },
    };
    onChange({ ...currentConditions, blocks: updatedBlocks });
  };

  const handleRemoveCheck = (blockIndex, checkIndex) => {
    const updatedBlocks = [...conditionBlocks];
    const checks = [...(updatedBlocks[blockIndex].data?.checks || [])];
    checks.splice(checkIndex, 1);

    if (checks.length === 0) {
      // Remove the entire block if no checks left
      updatedBlocks.splice(blockIndex, 1);
    } else {
      updatedBlocks[blockIndex] = {
        ...updatedBlocks[blockIndex],
        data: { ...updatedBlocks[blockIndex].data, checks },
      };
    }

    // If no blocks left, clear conditions
    if (updatedBlocks.length === 0) {
      onChange(null);
    } else {
      onChange({ ...currentConditions, blocks: updatedBlocks });
    }
  };

  const handleClearAll = () => {
    onChange(null);
  };

  return (
    <div
      className="mt-2 rounded-lg overflow-hidden"
      style={{
        border: `1px solid ${checksCount > 0 ? theme.colors.accents.purple + "50" : theme.colors.border}`,
        background:
          checksCount > 0 ? `${theme.colors.accents.purple}08` : "transparent",
      }}
    >
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-left transition hover:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <span style={{ color: theme.colors.accents.purple }}>
            {checksCount > 0 ? "🔒" : "🔓"}
          </span>
          <span
            className="text-xs font-semibold"
            style={{
              color:
                checksCount > 0
                  ? theme.colors.accents.purple
                  : theme.colors.text.tertiary,
            }}
          >
            Conditions
          </span>
          {checksCount > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: theme.colors.accents.purple + "30",
                color: theme.colors.accents.purple,
              }}
            >
              {checksCount} check{checksCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span style={{ color: theme.colors.text.tertiary }}>
          {isExpanded ? "▼" : "▶"}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Mode Selector (only show if multiple checks) */}
          {checksCount > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: theme.colors.text.tertiary }}>Match:</span>
              <button
                type="button"
                onClick={() => handleModeChange("all")}
                className="px-2 py-1 rounded transition"
                style={{
                  background:
                    currentConditions.mode === "all"
                      ? theme.colors.accents.purple + "30"
                      : theme.colors.background.tertiary,
                  color:
                    currentConditions.mode === "all"
                      ? theme.colors.accents.purple
                      : theme.colors.text.secondary,
                  border: `1px solid ${currentConditions.mode === "all" ? theme.colors.accents.purple : theme.colors.border}`,
                }}
              >
                ALL (AND)
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("any")}
                className="px-2 py-1 rounded transition"
                style={{
                  background:
                    currentConditions.mode === "any"
                      ? theme.colors.accents.purple + "30"
                      : theme.colors.background.tertiary,
                  color:
                    currentConditions.mode === "any"
                      ? theme.colors.accents.purple
                      : theme.colors.text.secondary,
                  border: `1px solid ${currentConditions.mode === "any" ? theme.colors.accents.purple : theme.colors.border}`,
                }}
              >
                ANY (OR)
              </button>
            </div>
          )}

          {/* Checks List */}
          {conditionBlocks.map((block, blockIndex) => (
            <div key={block.id || blockIndex} className="space-y-1.5">
              {(block.data?.checks || []).map((check, checkIndex) => (
                <div
                  key={check.id || checkIndex}
                  className="flex items-center gap-1.5 p-1.5 rounded"
                  style={{
                    background: theme.colors.background.secondary,
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  {/* Field Input */}
                  <input
                    type="text"
                    value={check.field || ""}
                    onChange={(e) =>
                      handleUpdateCheck(blockIndex, checkIndex, {
                        field: e.target.value,
                      })
                    }
                    placeholder="field.path"
                    className="px-2 py-1 rounded text-xs font-mono"
                    style={{
                      background: theme.colors.background.tertiary,
                      color: theme.colors.accents.yellow,
                      border: `1px solid ${theme.colors.border}`,
                      width: "140px",
                      minWidth: "100px",
                    }}
                    list={`field-suggestions-${block.id || blockIndex}-${checkIndex}`}
                  />
                  <datalist
                    id={`field-suggestions-${block.id || blockIndex}-${checkIndex}`}
                  >
                    {allFields.map((f, i) => (
                      <option key={i} value={f?.name || f} />
                    ))}
                  </datalist>

                  {/* Operator Select */}
                  <select
                    value={check.operator || "equals"}
                    onChange={(e) =>
                      handleUpdateCheck(blockIndex, checkIndex, {
                        operator: e.target.value,
                      })
                    }
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      background: theme.colors.background.primary,
                      color: theme.colors.accents.cyan,
                      WebkitTextFillColor: theme.colors.accents.cyan,
                      border: `1px solid ${theme.colors.accents.cyan}40`,
                      minWidth: "100px",
                    }}
                  >
                    {OPERATORS.map((op) => (
                      <option
                        key={op.value}
                        value={op.value}
                        style={{
                          background: "#1e1e2e",
                          color: "#a03573ff",
                        }}
                      >
                        {op.icon} {op.value}
                      </option>
                    ))}
                  </select>

                  {/* Value Input (hidden for certain operators) */}
                  {!NO_VALUE_OPERATORS.includes(check.operator) && (
                    <input
                      type="text"
                      value={check.value ?? ""}
                      onChange={(e) =>
                        handleUpdateCheck(blockIndex, checkIndex, {
                          value: e.target.value,
                        })
                      }
                      placeholder="value"
                      className="px-2 py-1 rounded text-xs font-mono"
                      style={{
                        background: theme.colors.background.tertiary,
                        color: theme.colors.accents.green,
                        border: `1px solid ${theme.colors.border}`,
                        width: "120px",
                        minWidth: "80px",
                      }}
                    />
                  )}

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveCheck(blockIndex, checkIndex)}
                    className="p-1 rounded transition hover:bg-red-500/20 ml-auto"
                    style={{ color: theme.colors.accents.red }}
                    title="Remove condition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ))}

          {/* Add/Clear Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddCheck}
              className="px-2 py-1 rounded text-xs font-semibold transition hover:brightness-110"
              style={{
                background: theme.colors.accents.purple + "20",
                color: theme.colors.accents.purple,
                border: `1px solid ${theme.colors.accents.purple}50`,
              }}
            >
              + Add Condition
            </button>

            {checksCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-1 rounded text-xs transition hover:bg-red-500/20"
                style={{ color: theme.colors.accents.red }}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Help Text */}
          {checksCount === 0 && (
            <p
              className="text-xs"
              style={{ color: theme.colors.text.tertiary }}
            >
              Add conditions to skip this block when data doesn't match
            </p>
          )}
        </div>
      )}
    </div>
  );
}
