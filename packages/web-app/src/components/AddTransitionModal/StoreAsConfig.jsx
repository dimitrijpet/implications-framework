import React from 'react';

/**
 * Reusable storeAs configuration component
 * 
 * Usage:
 *   <StoreAsConfig
 *     value={step.storeAs}
 *     onChange={(config) => updateStep({ ...step, storeAs: config })}
 *     entityScope="dancer"
 *   />
 */
const StoreAsConfig = ({ value, onChange, entityScope = null }) => {
  // Normalize value to object format
  const config = React.useMemo(() => {
    if (!value) return { key: '', persist: true, global: false };
    if (typeof value === 'string') return { key: value, persist: true, global: false };
    return { key: value.key || '', persist: value.persist !== false, global: value.global === true };
  }, [value]);

  const handleChange = (field, newValue) => {
    const updated = { ...config, [field]: newValue };
    
    // If simple config (defaults), just return string
    if (updated.persist && !updated.global && updated.key) {
      onChange(updated.key);
    } else if (updated.key) {
      onChange(updated);
    } else {
      onChange(null);
    }
  };

  // Calculate preview path
  const previewPath = React.useMemo(() => {
    if (!config.key) return null;
    if (config.global || !entityScope) return `ctx.data.${config.key}`;
    return `ctx.data.${entityScope}.${config.key}`;
  }, [config, entityScope]);

  return (
    <div className="space-y-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">💾</span>
        <span className="text-slate-200 text-sm font-medium">Store Return Value</span>
      </div>

      {/* Variable Name */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Variable Name</label>
        <input
          type="text"
          value={config.key}
          onChange={(e) => handleChange('key', e.target.value)}
          placeholder="e.g., flightData"
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Options */}
      {config.key && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.persist}
              onChange={(e) => handleChange('persist', e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-300">
              Persist to test data
              <span className="text-slate-500 text-xs ml-1">(available in next tests)</span>
            </span>
          </label>

          {entityScope && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.global}
                onChange={(e) => handleChange('global', e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-300">
                Store globally
                <span className="text-slate-500 text-xs ml-1">(ignore {entityScope} scope)</span>
              </span>
            </label>
          )}
        </div>
      )}

      {/* Preview */}
      {previewPath && (
        <div className="pt-2 border-t border-slate-700">
          <div className="flex items-start gap-2">
            <span className="text-blue-400">💡</span>
            <div className="text-xs">
              <div className="text-slate-300">
                Will store as: <code className="text-green-400">{previewPath}</code>
              </div>
              <div className="text-slate-500 mt-1">
                Available in: requires, args, template {'{{'}variables{'}}'}
              </div>
              {!config.persist && (
                <div className="text-amber-400 mt-1">
                  ⚠️ Won't persist to JSON (current test only)
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreAsConfig;