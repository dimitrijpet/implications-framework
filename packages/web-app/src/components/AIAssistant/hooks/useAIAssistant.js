// packages/web-app/src/components/AIAssistant/hooks/useAIAssistant.js

import { useState, useCallback } from 'react';

const API_URL = 'http://localhost:3000';

export function useAIAssistant() {
  const [status, setStatus] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check API status
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/status`);
      const data = await response.json();
      setStatus(data);
      return data;
    } catch (err) {
      setError('Failed to connect to AI Assistant API');
      return null;
    }
  }, []);

  // Scan a URL
  const scanUrl = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);
    setScanResult(null);

    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/scan-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          generateLocators: options.generateLocators ?? true,
          generatePOM: options.generatePOM ?? true,
          generateTransitions: options.generateTransitions ?? true,
          platform: options.platform || 'web',
          screenName: options.screenName || ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Scan failed');
      }

      setScanResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Analyze uploaded screenshot
  const analyzeScreenshot = useCallback(async (base64Screenshot, options = {}) => {
    setLoading(true);
    setError(null);
    setScanResult(null);

    try {
      const response = await fetch(`${API_URL}/api/ai-assistant/analyze-screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot: base64Screenshot,
          generateLocators: options.generateLocators ?? true,
          generatePOM: options.generatePOM ?? true,
          generateTransitions: options.generateTransitions ?? true,
          platform: options.platform || 'web',
          screenName: options.screenName || '',
          pageTitle: options.pageTitle || '',
          pageUrl: options.pageUrl || ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setScanResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear results
  const clearResults = useCallback(() => {
    setScanResult(null);
    setError(null);
  }, []);

  return {
    status,
    scanResult,
    loading,
    error,
    checkStatus,
    scanUrl,
    analyzeScreenshot,
    clearResults
  };
}
