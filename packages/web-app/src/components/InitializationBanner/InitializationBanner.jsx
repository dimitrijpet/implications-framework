import { useState } from 'react';
import apiClient from '../../api/client';

/**
 * Banner that shows when guest project needs initialization
 * Detects missing TestContext.js, ExpectImplication.js, ai-testing.config.js
 */
export default function InitializationBanner({ projectPath, onInitComplete, theme }) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initResult, setInitResult] = useState(null);
  const [error, setError] = useState(null);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      console.log('🚀 Initializing project:', projectPath);
      
      const response = await apiClient.post('/init/setup', {
        projectPath,
        force: false // Don't overwrite if exists
      });

      const result = response.data;
      console.log('✅ Initialization complete:', result);
      
      setInitResult(result);
      
      // Notify parent component
      if (onInitComplete) {
        onInitComplete(result);
      }

      // Auto-close success message after 3 seconds
      setTimeout(() => {
        setInitResult(null);
      }, 5000);

    } catch (err) {
      console.error('❌ Initialization failed:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  // Success state
  if (initResult?.success) {
    return (
      <div 
        className="glass rounded-xl p-6 mb-6 border-2"
        style={{ 
          borderColor: theme.colors.accents.green,
          backgroundColor: `${theme.colors.accents.green}15`
        }}
      >
        <div className="flex items-start gap-4">
          <div className="text-4xl">✅</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2" style={{ color: theme.colors.accents.green }}>
              Setup Complete!
            </h3>
            <p className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
              Your project is now ready for test generation and management.
            </p>
            
            <div className="space-y-1">
              <p className="text-xs font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                Created Files:
              </p>
              {initResult.files?.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs" style={{ color: theme.colors.accents.green }}>
                  <span>✅</span>
                  <code className="font-mono">{file}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className="glass rounded-xl p-6 mb-6 border-2"
        style={{ 
          borderColor: theme.colors.accents.red,
          backgroundColor: `${theme.colors.accents.red}15`
        }}
      >
        <div className="flex items-start gap-4">
          <div className="text-4xl">❌</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2" style={{ color: theme.colors.accents.red }}>
              Initialization Failed
            </h3>
            <p className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
              {error}
            </p>
            <button
              onClick={handleInitialize}
              className="px-4 py-2 rounded-lg font-semibold text-sm"
              style={{
                backgroundColor: theme.colors.accents.red,
                color: 'white'
              }}
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal state - needs initialization
  return (
    <div 
      className="glass rounded-xl p-6 mb-6 border-2 border-dashed"
      style={{ 
        borderColor: theme.colors.accents.yellow,
        backgroundColor: `${theme.colors.accents.yellow}10`
      }}
    >
      <div className="flex items-start gap-4">
        <div className="text-4xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-2" style={{ color: theme.colors.accents.yellow }}>
            Project Setup Required
          </h3>
          <p className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
            This project needs core utilities to support test generation and management.
          </p>
          
          <div className="space-y-2 mb-4">
            <p className="text-xs font-semibold" style={{ color: theme.colors.text.primary }}>
              What will be created:
            </p>
            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-xs" style={{ color: theme.colors.text.secondary }}>
                <span>📄</span>
                <code className="font-mono">tests/implications/utils/TestContext.js</code>
                <span className="text-xs opacity-60">- Data management</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: theme.colors.text.secondary }}>
                <span>📄</span>
                <code className="font-mono">tests/implications/utils/ExpectImplication.js</code>
                <span className="text-xs opacity-60">- Validation engine</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: theme.colors.text.secondary }}>
                <span>⚙️</span>
                <code className="font-mono">ai-testing.config.js</code>
                <span className="text-xs opacity-60">- Configuration</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleInitialize}
            disabled={isInitializing}
            className="px-6 py-3 rounded-lg font-bold text-sm transition-all"
            style={{
              backgroundColor: isInitializing ? theme.colors.background.tertiary : theme.colors.accents.blue,
              color: 'white',
              cursor: isInitializing ? 'not-allowed' : 'pointer',
              opacity: isInitializing ? 0.6 : 1
            }}
          >
            {isInitializing ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Initializing Project...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>🚀</span>
                Initialize Project
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}