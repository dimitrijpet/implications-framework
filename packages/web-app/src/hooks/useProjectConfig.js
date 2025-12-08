// packages/web-app/src/hooks/useProjectConfig.js

import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000';

export default function useProjectConfig(projectPath) {
  const [config, setConfig] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [platformNames, setPlatformNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectPath) {
      setPlatforms([]);
      setPlatformNames([]);
      return;
    }

    const fetchPlatforms = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${API_URL}/api/config/platforms/${encodeURIComponent(projectPath)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setPlatforms(data.platforms || []);
            setPlatformNames(data.platformNames || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch platforms:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlatforms();
  }, [projectPath]);

  return { config, platforms, platformNames, loading, error };
}