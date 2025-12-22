// packages/web-app/src/hooks/useNotes.js

import { useState, useEffect, useCallback } from 'react';

const API_URL = 'http://localhost:3000';

export function useNotes(projectPath) {
  const [notes, setNotes] = useState({ states: {}, transitions: {}, categories: {} });
  const [summary, setSummary] = useState({ states: {}, transitions: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadNotes = useCallback(async () => {
    if (!projectPath) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/notes?projectPath=${encodeURIComponent(projectPath)}`
      );

      if (!response.ok) {
        throw new Error('Failed to load notes');
      }

      const data = await response.json();
      
      if (data.success) {
        setNotes({
          states: data.notes.states || {},
          transitions: data.notes.transitions || {},
          categories: data.notes.categories || {}
        });
      }
    } catch (err) {
      console.error('❌ Error loading notes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  const loadSummary = useCallback(async () => {
    if (!projectPath) return;

    try {
      const response = await fetch(
        `${API_URL}/api/notes/summary?projectPath=${encodeURIComponent(projectPath)}`
      );

      if (!response.ok) return;

      const data = await response.json();
      
      if (data.success) {
        setSummary({
          states: data.summary.states || {},
          transitions: data.summary.transitions || {},
          categories: data.summary.categories || {}
        });
      }
    } catch (err) {
      console.error('❌ Error loading notes summary:', err);
    }
  }, [projectPath]);

  const getStateNotes = useCallback((stateName) => {
    return notes.states[stateName] || [];
  }, [notes.states]);

  const getTransitionNotes = useCallback((transitionKey) => {
    return notes.transitions[transitionKey] || [];
  }, [notes.transitions]);

  const getStateNoteCount = useCallback((stateName) => {
    return summary.states[stateName]?.total || 0;
  }, [summary.states]);

  const getTransitionNoteCount = useCallback((transitionKey) => {
    return summary.transitions[transitionKey]?.total || 0;
  }, [summary.transitions]);

  const hasActiveStateNotes = useCallback((stateName) => {
    const counts = summary.states[stateName];
    if (!counts) return false;
    return (counts.byStatus?.draft || 0) + (counts.byStatus?.['in-progress'] || 0) > 0;
  }, [summary.states]);

  const hasActiveTransitionNotes = useCallback((transitionKey) => {
    const counts = summary.transitions[transitionKey];
    if (!counts) return false;
    return (counts.byStatus?.draft || 0) + (counts.byStatus?.['in-progress'] || 0) > 0;
  }, [summary.transitions]);

  const buildTransitionKey = useCallback((source, event, target) => {
    return `${source}:${event}:${target}`;
  }, []);

  const refresh = useCallback(() => {
    loadNotes();
    loadSummary();
  }, [loadNotes, loadSummary]);

  useEffect(() => {
    loadNotes();
    loadSummary();
  }, [loadNotes, loadSummary]);

  return {
    notes,
    summary,
    loading,
    error,
    categories: notes.categories,
    refresh,
    getStateNotes,
    getTransitionNotes,
    getStateNoteCount,
    getTransitionNoteCount,
    hasActiveStateNotes,
    hasActiveTransitionNotes,
    buildTransitionKey
  };
}

export default useNotes;