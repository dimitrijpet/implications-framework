import { getPlatformStyle, getStatusColor, getStatusIcon, defaultTheme } from '../config/visualizerTheme';
import { getRequiresObjectColor, formatRequiresLabel } from './requiresColors.js';

/**
 * Build Cytoscape graph from discovery results
 */
/**
 * Build Cytoscape graph from discovery results
 */
export function buildGraphFromDiscovery(discoveryResult) {
  const { files, transitions } = discoveryResult;
  const implications = files.implications || [];
  const projectPath = discoveryResult.projectPath;
  
  const nodes = [];
  const edges = [];
  
  // Create a map of state names to class names
  const stateMap = new Map();
  
  // âœ… FILTER: Only use implications with xstateConfig
const statefulImplications = implications.filter(imp => 
  imp.metadata?.hasXStateConfig === true
);

console.log(`âœ… Filtered to ${statefulImplications.length} stateful implications (from ${implications.length} total)`);

// âœ… ADD THIS - Check what metadata we have
statefulImplications.forEach(imp => {
  console.log(`ðŸ“‹ ${imp.metadata.className}:`, {
    status: imp.metadata.status,
    triggerButton: imp.metadata.triggerButton,
    platform: imp.metadata.platform,
    setup: imp.metadata.setup,
  });
});
  
  // Create nodes from stateful implications only
  statefulImplications.forEach(imp => {
    const metadata = imp.metadata || {};
    const stateName = extractStateName(metadata.className);
    
    console.log(`📝 Creating node: className="${metadata.className}" → stateName="${stateName}"`);
    console.log(`   Also mapping status="${metadata.status}" if exists`);
    
    stateMap.set(metadata.className, stateName.toLowerCase());
    stateMap.set(stateName.toLowerCase(), stateName.toLowerCase());
    
    // ✅ CRITICAL: Also map the status field!
    if (metadata.status) {
      stateMap.set(metadata.status.toLowerCase(), stateName.toLowerCase());
      console.log(`   ✅ Mapped status: "${metadata.status}" → "${stateName.toLowerCase()}"`);
    }
    
    // Get platform styling
    const platform = metadata.setup?.platform || metadata.platform || 'web';
    const platformStyle = getPlatformStyle(platform, defaultTheme);
    const statusColor = getStatusColor(stateName, defaultTheme);
    const statusIcon = getStatusIcon(stateName, defaultTheme);
    
    // Determine if multi-platform
    const allPlatforms = metadata.platforms || [platform];
    const isMultiPlatform = allPlatforms.length > 1;
    
    nodes.push({
  data: {
    id: metadata.status.toLowerCase(),
    label: stateName,
    type: 'state',
    isStateful: metadata.isStateful,
    pattern: metadata.pattern,
    hasXState: metadata.hasXStateConfig,
    metadata: metadata,
    
    // âœ… ADD THIS - File paths!
    files: {
     implication: projectPath + '/' + imp.path,  // Make absolute!
  test: projectPath + '/' + (Array.isArray(metadata.setup) 
    ? metadata.setup[0]?.testFile 
    : metadata.setup?.testFile)
},
        
        // Visual styling data
        color: statusColor,
        icon: statusIcon,
        platform: platform,
        platformColor: platformStyle.color,
        allPlatforms: allPlatforms,
        borderStyle: isMultiPlatform ? 'multi' : 'solid',
        
        // Shadow properties
        shadowBlur: 20,
        shadowColor: platformStyle.color,
        shadowOpacity: 0.8,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
      },
      classes: metadata.pattern || 'default',
    });
  });
  
  // Create edges from transitions
  console.log(`🔗 Building edges from ${transitions?.length || 0} transitions...`);
  
// Create edges from transitions
  if (transitions && transitions.length > 0) {
    transitions.forEach(transition => {
      const fromState = extractStateName(transition.from).toLowerCase();
      const toState = transition.to.toLowerCase();
      
      // Only add edge if both nodes exist
      if (stateMap.has(fromState) && stateMap.has(toState)) {
        // Determine platform color for edge
        const sourceNode = nodes.find(n => n.data.id === fromState);
        const platformColor = sourceNode?.data.platformColor || defaultTheme.colors.accents.blue;
        
        // Build unique edge ID including requires if present
        const requiresKey = transition.requires 
          ? `-req:${Object.entries(transition.requires).map(([k,v]) => `${k}=${v}`).join(',')}`
          : '';
        const edgeId = `${fromState}-${toState}-${transition.event}${requiresKey}`;
        
  // Get requires color if present
        const requiresColor = transition.requires 
          ? getRequiresObjectColor(transition.requires)
          : null;
        const requiresLabel = transition.requires
          ? formatRequiresLabel(transition.requires)
          : '';
        
        edges.push({
          data: {
            id: edgeId,
            source: fromState,
            target: toState,
            label: transition.event,
            platformColor: platformColor,
            platform: sourceNode?.data.platform || 'web',
            platforms: transition.platforms || null,
            requires: transition.requires || null,
            hasRequires: !!(transition.requires && Object.keys(transition.requires).length > 0),
            requiresLabel: requiresLabel,      // ✅ NEW
            requiresColor: requiresColor       // ✅ NEW
          },
        });
      }
    });
  }
  
  console.log(`âœ… Built graph: ${nodes.length} nodes, ${edges.length} edges`);
  
  // CRITICAL FIX: Filter out edges that reference non-existent nodes
  const nodeIds = new Set(nodes.map(n => n.data.id));
  const validEdges = edges.filter(edge => {
    const hasSource = nodeIds.has(edge.data.source);
    const hasTarget = nodeIds.has(edge.data.target);
    
    if (!hasSource || !hasTarget) {
      console.warn(`REMOVED invalid edge: ${edge.data.source} to ${edge.data.target}`);
      return false;
    }
    return true;
  });
  
  console.log(`Valid edges: ${validEdges.length} (removed ${edges.length - validEdges.length} invalid)`);
  
  return { nodes, edges: validEdges };
}
/**
 * Extract state name from class name
 * "AcceptedBookingImplications" -> "accepted"
 */
function extractStateName(className) {
  if (!className) return 'Unknown';
  
  // ✅ CRITICAL FIX: Don't process if already snake_case!
  if (className.includes('_')) {
    // Already snake_case, just lowercase it
    return className.toLowerCase();
  }
  
  // Only process PascalCase names
  let name = className;
  
  // Remove "Implications" suffix
  name = name.replace(/Implications$/i, '');
  
  // Remove "Booking" prefix/suffix
  name = name.replace(/Booking$/i, '').replace(/^Booking/i, '');
  
  // Convert PascalCase to snake_case
  name = name.replace(/([A-Z])/g, (match, p1, offset) => {
    return offset > 0 ? '_' + p1.toLowerCase() : p1.toLowerCase();
  });
  
  return name || className;
}

/**
 * Build graph with sample data (for testing)
 */
export function buildSampleGraph() {
  const sampleNodes = [
    { 
      data: { 
        id: 'created', 
        label: 'Created',
        type: 'state',
        isStateful: true,
        pattern: 'booking',
        color: '#6b7280',
        icon: 'ðŸ“',
        platform: 'web',
        platformColor: '#f1f5f9',
        allPlatforms: ['web'],
        borderStyle: 'solid',
        shadowBlur: 20,
        shadowColor: '#f1f5f9',
        shadowOpacity: 0.8,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        metadata: {
          className: 'CreatedBookingImplications',
          isStateful: true,
          hasXStateConfig: true,
          hasMirrorsOn: true,
          pattern: 'booking',
        },
      },
      classes: 'booking',
    },
    { 
      data: { 
        id: 'pending', 
        label: 'Pending',
        type: 'state',
        isStateful: true,
        pattern: 'booking',
        color: '#eab308',
        icon: 'â³',
        platform: 'mobile-dancer',
        platformColor: '#a855f7',
        allPlatforms: ['mobile-dancer'],
        borderStyle: 'solid',
        shadowBlur: 20,
        shadowColor: '#a855f7',
        shadowOpacity: 0.8,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        metadata: {
          className: 'PendingBookingImplications',
          isStateful: true,
          hasXStateConfig: true,
          hasMirrorsOn: true,
          pattern: 'booking',
        },
      },
      classes: 'booking',
    },
    { 
      data: { 
        id: 'accepted', 
        label: 'Accepted',
        type: 'state',
        isStateful: true,
        pattern: 'booking',
        color: '#10b981',
        icon: 'âœ…',
        platform: 'mobile-manager',
        platformColor: '#3b82f6',
        allPlatforms: ['mobile-manager', 'web'],  // âœ… Multi-platform!
        borderStyle: 'multi',
        shadowBlur: 20,
        shadowColor: '#3b82f6',
        shadowOpacity: 0.8,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        metadata: {
          className: 'AcceptedBookingImplications',
          isStateful: true,
          hasXStateConfig: true,
          hasMirrorsOn: true,
          pattern: 'booking',
        },
      },
      classes: 'booking',
    },
    { 
      data: { 
        id: 'rejected', 
        label: 'Rejected',
        type: 'state',
        isStateful: true,
        pattern: 'booking',
        color: '#ef4444',
        icon: 'âŒ',
        platform: 'mobile-manager',
        platformColor: '#3b82f6',
        allPlatforms: ['mobile-manager'],
        borderStyle: 'solid',
        shadowBlur: 20,
        shadowColor: '#3b82f6',
        shadowOpacity: 0.8,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        metadata: {
          className: 'RejectedBookingImplications',
          isStateful: true,
          hasXStateConfig: true,
          hasMirrorsOn: true,
          pattern: 'booking',
        },
      },
      classes: 'booking',
    },
    { 
      data: { 
        id: 'checkedIn', 
        label: 'Checked In',
        type: 'state',
        isStateful: true,
        pattern: 'booking',
        color: '#8b5cf6',
        icon: 'ðŸŽ¯',
        platform: 'mobile-manager',
        platformColor: '#3b82f6',
        allPlatforms: ['mobile-manager'],
        borderStyle: 'solid',
        shadowBlur: 20,
        shadowColor: '#3b82f6',
        shadowOpacity: 0.8,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        metadata: {
          className: 'CheckedInBookingImplications',
          isStateful: true,
          hasXStateConfig: true,
          hasMirrorsOn: true,
          pattern: 'booking',
        },
      },
      classes: 'booking',
    },
  ];
  
  const sampleEdges = [
    { 
      data: { 
        source: 'created', 
        target: 'pending', 
        label: 'REQUEST',
        platformColor: '#f1f5f9',
        platform: 'web'
      } 
    },
    { 
      data: { 
        source: 'pending', 
        target: 'accepted', 
        label: 'ACCEPT',
        platformColor: '#3b82f6',
        platform: 'mobile-manager'
      } 
    },
    { 
      data: { 
        source: 'pending', 
        target: 'rejected', 
        label: 'REJECT',
        platformColor: '#3b82f6',
        platform: 'mobile-manager'
      } 
    },
    { 
      data: { 
        source: 'accepted', 
        target: 'checkedIn', 
        label: 'CHECK_IN',
        platformColor: '#3b82f6',
        platform: 'mobile-manager'
      } 
    },
    { 
      data: { 
        source: 'accepted', 
        target: 'pending', 
        label: 'UNDO',
        platformColor: '#3b82f6',
        platform: 'mobile-manager'
      } 
    },
  ];
  
  return { nodes: sampleNodes, edges: sampleEdges };
}