import { getPlatformStyle, getStatusColor, getStatusIcon, defaultTheme } from '../config/visualizerTheme';

/**
 * Build Cytoscape graph from discovery results
 * ✨ Enhanced with screen grouping support and platform-specific transitions
 */
export function buildGraphFromDiscovery(discoveryResult) {
  const { files, transitions } = discoveryResult;
  const implications = files.implications || [];
  const projectPath = discoveryResult.projectPath;
  
  const nodes = [];
  const edges = [];  // ✅ Initialize empty, build AFTER nodes
  
  // Create a map of state names to class names
  const stateMap = new Map();
  
  // ✨ NEW: Track screens for grouping
  const screenGroups = {};
  
  // ✅ FILTER: Only use implications with xstateConfig
  const statefulImplications = implications.filter(imp => 
    imp.metadata?.hasXStateConfig === true
  );

  console.log(`✅ Filtered to ${statefulImplications.length} stateful implications (from ${implications.length} total)`);

  // ✅ Check what metadata we have
  statefulImplications.forEach(imp => {
    console.log(`📋 ${imp.metadata.className}:`, {
      status: imp.metadata.status,
      triggerButton: imp.metadata.triggerButton,
      platform: imp.metadata.platform,
      setup: imp.metadata.setup,
      screen: imp.metadata.screen,
    });
  });
  
  // Create nodes from stateful implications only
  statefulImplications.forEach(imp => {
    const metadata = imp.metadata || {};
    const stateName = extractStateName(metadata.className);
    
    stateMap.set(metadata.className, stateName.toLowerCase());
    stateMap.set(stateName.toLowerCase(), stateName.toLowerCase());
    
    // Get platform styling
    const platform = metadata.setup?.platform || metadata.platform || 'web';
    const platformStyle = getPlatformStyle(platform, defaultTheme);
    const statusColor = getStatusColor(stateName, defaultTheme);
    const statusIcon = getStatusIcon(stateName, defaultTheme);
    
    // Determine if multi-platform
    const allPlatforms = metadata.platforms || [platform];
    const isMultiPlatform = allPlatforms.length > 1;
    
    // ✨ NEW: Get screen from metadata
    const screen = metadata.screen || null;
    
    // ✨ NEW: Track screen grouping
    if (screen) {
      if (!screenGroups[screen]) {
        screenGroups[screen] = [];
      }
      screenGroups[screen].push(stateName.toLowerCase());
    }
    
    nodes.push({
      data: {
        id: stateName.toLowerCase(),
        label: stateName,
        type: 'state',
        isStateful: metadata.isStateful,
        pattern: metadata.pattern,
        hasXState: metadata.hasXStateConfig,
        metadata: metadata,
        
        // ✨ NEW: Screen information
        screen: screen,
        
        // File paths
        files: {
          implication: projectPath + '/' + imp.path,
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
  
  // ✅ NOW Build edges from transitions (AFTER nodes are built!)
  console.log(`🔗 Building edges from ${transitions?.length || 0} transitions...`);
  
// ✅ NOW Build edges from transitions (AFTER nodes are built!)
console.log(`🔗 Building edges from ${transitions?.length || 0} transitions...`);

if (transitions && transitions.length > 0) {
  transitions.forEach(transition => {
    console.log(`\n🔍 Processing transition:`, {
      from: transition.from,
      to: transition.to,
      event: transition.event,
      platforms: transition.platforms  // ✅ Debug: See what we got!
    });
    
    const fromState = extractStateName(transition.from).toLowerCase();
    const toState = transition.to.toLowerCase();
    
    // Only add edge if both nodes exist
    if (stateMap.has(fromState) && stateMap.has(toState)) {
      // ✅ FIX: Define sourceNode OUTSIDE if/else
      const sourceNode = nodes.find(n => n.data.id === fromState);
      let edgeColor;
      
      // ✅ Use transition's platforms if specified
      if (transition.platforms && transition.platforms.length > 0) {
        // Use first platform's color
        const platform = transition.platforms[0];
        edgeColor = getPlatformStyle(platform, defaultTheme).color;
        console.log(`   ✅ Using transition platform: ${platform} → ${edgeColor}`);
      } else {
        // Fallback: use source state's platform
        edgeColor = sourceNode?.data.platformColor || defaultTheme.colors.accents.blue;
        console.log(`   ⚠️ No platforms on transition, using source: ${sourceNode?.data.platform} → ${edgeColor}`);
      }
      
      edges.push({
        data: {
          id: `${fromState}-${toState}-${transition.event}`,
          source: fromState,
          target: toState,
          label: transition.event,
          platformColor: edgeColor,
          platforms: transition.platforms,  // ✅ Pass platforms for badges!
          platform: sourceNode?.data.platform || 'web'
        },
      });
      
      console.log(`   ✅ Edge added: ${edgeColor}`);
    } else {
      console.warn(`   ⚠️ Skipping edge: ${fromState}→${toState} (nodes not found)`);
    }
  });
}
  
  console.log(`✅ Built graph: ${nodes.length} nodes, ${edges.length} edges`);
  console.log(`📺 Screen groups:`, Object.keys(screenGroups).length, screenGroups);
  
  return { nodes, edges, screenGroups };
}

/**
 * Extract state name from class name
 * "AcceptedBookingImplications" -> "accepted"
 */
function extractStateName(className) {
  if (!className) return 'Unknown';
  
  // Remove "Implications" suffix
  let name = className.replace(/Implications$/i, '');
  
  // Remove "Booking" prefix/suffix
  // name = name.replace(/Booking$/i, '').replace(/^Booking/i, '');
  
  // Convert PascalCase to snake_case
  name = name.replace(/([A-Z])/g, (match, p1, offset) => {
    return offset > 0 ? '_' + p1.toLowerCase() : p1.toLowerCase();
  });
  
  return name || className;  // ✅ Fallback to className
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
        icon: '📝',
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
        icon: '⏳',
        platform: 'dancer',
        platformColor: '#a855f7',
        allPlatforms: ['dancer'],
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
        icon: '✅',
        platform: 'manager',
        platformColor: '#3b82f6',
        allPlatforms: ['manager', 'web'],  // ✅ Multi-platform!
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
        icon: '❌',
        platform: 'manager',
        platformColor: '#3b82f6',
        allPlatforms: ['manager'],
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
        icon: '🎯',
        platform: 'manager',
        platformColor: '#3b82f6',
        allPlatforms: ['manager'],
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
        platform: 'manager'
      } 
    },
    { 
      data: { 
        source: 'pending', 
        target: 'rejected', 
        label: 'REJECT',
        platformColor: '#3b82f6',
        platform: 'manager'
      } 
    },
    { 
      data: { 
        source: 'accepted', 
        target: 'checkedIn', 
        label: 'CHECK_IN',
        platformColor: '#3b82f6',
        platform: 'manager'
      } 
    },
    { 
      data: { 
        source: 'accepted', 
        target: 'pending', 
        label: 'UNDO',
        platformColor: '#3b82f6',
        platform: 'manager'
      } 
    },
  ];
  
  return { nodes: sampleNodes, edges: sampleEdges };
}