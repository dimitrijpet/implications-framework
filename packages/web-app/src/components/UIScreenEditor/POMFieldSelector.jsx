// packages/web-app/src/components/UIScreenEditor/POMFieldSelector.jsx
// ✨ ENHANCED: Screen dropdown + Auto-select current POM!

import { useState, useEffect } from 'react';
import { ChevronDown, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * POM Field Selector with autocomplete and validation
 * 
 * ENHANCEMENTS:
 * - Auto-selects POM if screen already has one
 * - Screen file dropdown (instead of manual typing)
 * - Better UX flow
 */
export default function POMFieldSelector({ 
  projectPath,
  selectedPOM,
  selectedInstance,
  platform,  // ✅ ADD THIS
  onPOMChange,
  onInstanceChange,
  editable = true,
  theme
}) {
  const [poms, setPoms] = useState([]);
  const [pomDetails, setPomDetails] = useState(null);
  const [availableScreens, setAvailableScreens] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // ✨ Initialize with selected values
  const [currentPOM, setCurrentPOM] = useState(selectedPOM || '');
  const [currentInstance, setCurrentInstance] = useState(selectedInstance || '');

 useEffect(() => {
    if (!projectPath) return;
    
    const fetchPOMs = async () => {
      try {
        // ✅ Pass platform filter to API
        let url = `/api/poms?projectPath=${encodeURIComponent(projectPath)}`;
        if (platform) {
          url += `&platform=${encodeURIComponent(platform)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
          setPoms(data.poms || []);
        }
      } catch (error) {
        console.error('Failed to fetch POMs:', error);
      }
    };
    
    fetchPOMs();
  }, [projectPath, platform]);  // ✅ Add platform to deps

  // Fetch POM details when POM selected
  useEffect(() => {
    if (!projectPath || !currentPOM) return;
    
    const fetchPOMDetails = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/poms/${currentPOM}?projectPath=${encodeURIComponent(projectPath)}`
        );
        const data = await response.json();
        
        if (data.success) {
          setPomDetails(data);
        }
      } catch (error) {
        console.error('Failed to fetch POM details:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPOMDetails();
  }, [projectPath, currentPOM]);

  const handlePOMChange = (newPOM) => {
    setCurrentPOM(newPOM);
    setCurrentInstance('');  // Reset instance when POM changes
    if (onPOMChange) {
      onPOMChange(newPOM, '');
    }
  };

  const handleInstanceChange = (newInstance) => {
    setCurrentInstance(newInstance);
    if (onInstanceChange) {
      onInstanceChange(newInstance);
    }
  };

  // ✨ Filter screens that match current POM
  const matchingScreens = availableScreens.filter(screen => {
    if (!currentPOM) return true;
    return screen.name.toLowerCase().includes(currentPOM.toLowerCase());
  });

  return (
    <div className="space-y-3">
      {/* POM Selector */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: theme?.colors?.text?.primary || '#000' }}>
          Page Object Model (POM)
        </label>
        <select
          value={currentPOM}
          onChange={(e) => handlePOMChange(e.target.value)}
          disabled={!editable}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: theme?.colors?.background?.primary || '#fff',
            borderColor: theme?.colors?.border || '#ccc',
            color: theme?.colors?.text?.primary || '#000'
          }}
        >
          <option value="">Select POM...</option>
          {poms.map(pom => (
            <option key={pom.path} value={pom.name}>
              {pom.name}
            </option>
          ))}
        </select>
      </div>

      {/* ✨ Screen File Dropdown */}
      {currentPOM && matchingScreens.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: theme?.colors?.text?.primary || '#000' }}>
            Screen File
            <span className="ml-2 text-xs" style={{ color: theme?.colors?.text?.tertiary || '#999' }}>
              (optional - for reference)
            </span>
          </label>
          <select
            value={currentPOM}
            onChange={(e) => handlePOMChange(e.target.value)}
            disabled={!editable}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            style={{
              background: theme?.colors?.background?.primary || '#fff',
              borderColor: theme?.colors?.border || '#ccc',
              color: theme?.colors?.text?.primary || '#000'
            }}
          >
            <option value={currentPOM}>{currentPOM}</option>
            {matchingScreens
              .filter(screen => screen.name !== currentPOM)
              .map(screen => (
                <option key={screen.path} value={screen.name}>
                  {screen.displayName} ({screen.path.split('/').slice(-2, -1)[0]})
                </option>
              ))
            }
          </select>
          <p className="mt-1 text-xs" style={{ color: theme?.colors?.text?.tertiary || '#999' }}>
            {matchingScreens.length} matching screen file(s)
          </p>
        </div>
      )}

      {/* Instance Selector - OPTIONAL */}
      {pomDetails && pomDetails.instances && pomDetails.instances.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: theme?.colors?.text?.primary || '#000' }}>
            Instance (optional)
          </label>
          <select
            value={currentInstance}
            onChange={(e) => handleInstanceChange(e.target.value)}
            disabled={!editable}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            style={{
              background: theme?.colors?.background?.primary || '#fff',
              borderColor: theme?.colors?.border || '#ccc',
              color: theme?.colors?.text?.primary || '#000'
            }}
          >
            <option value="">All fields (no filter)</option>
            {pomDetails.instances.map(inst => (
              <option key={inst.name} value={inst.name}>
                {inst.name} ({inst.className})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs" style={{ color: theme?.colors?.text?.tertiary || '#999' }}>
            Select an instance to filter fields, or leave empty to see all
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-sm animate-pulse" style={{ color: theme?.colors?.text?.tertiary || '#999' }}>
          Loading POM details...
        </div>
      )}
    </div>
  );
}