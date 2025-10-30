// packages/web-app/src/components/CompositionViewer/CompositionViewer.jsx

import { useEffect, useState } from 'react';
import BaseClassCard from './BaseClassCard';
import BehaviorsSection from './BehaviorsSection';
import HelperUsageCard from './HelperUsageCard';

/**
 * CompositionViewer
 * 
 * Displays composition architecture in visual card layout
 * Shows base class, behaviors, and helper usage stats
 * 
 * Props:
 * - implicationPath: Path to the implication file
 * - theme: Visual theme object
 */
export default function CompositionViewer({ implicationPath, theme }) {
  const [composition, setComposition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (implicationPath) {
      loadComposition();
    }
  }, [implicationPath]);

  const loadComposition = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/implications/analyze-composition?filePath=${encodeURIComponent(implicationPath)}`
      );
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to analyze composition');
      }
      
      setComposition(data.composition);
    } catch (err) {
      console.error('Failed to load composition:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        <span className="ml-3 text-gray-400">Analyzing composition...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <div className="flex items-start">
          <span className="text-red-400 text-xl mr-3">⚠️</span>
          <div>
            <div className="font-semibold text-red-400 mb-1">Analysis Failed</div>
            <div className="text-sm text-red-300">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!composition) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-4xl mb-2">🧩</div>
        <div>No composition data available</div>
      </div>
    );
  }

  // Check if there's any composition to show
  const hasComposition = composition.baseClass || 
                         composition.behaviors.length > 0 || 
                         composition.helperUsage.totalMerges > 0;

  if (!hasComposition) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6 text-center">
        <div className="text-4xl mb-3">🎯</div>
        <div className="text-lg font-semibold text-gray-300 mb-2">
          Standalone Implication
        </div>
        <div className="text-sm text-gray-400">
          This file doesn't use base class extension or behavior composition
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Base Class Card */}
      {composition.baseClass && (
        <BaseClassCard baseClass={composition.baseClass} theme={theme} />
      )}
      
      {/* Behaviors Section */}
      {composition.behaviors.length > 0 && (
        <BehaviorsSection behaviors={composition.behaviors} theme={theme} />
      )}
      
      {/* Helper Usage Card */}
      {composition.helperUsage.totalMerges > 0 && (
        <HelperUsageCard usage={composition.helperUsage} theme={theme} />
      )}
    </div>
  );
}