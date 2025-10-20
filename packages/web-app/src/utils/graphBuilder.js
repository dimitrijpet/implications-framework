/**
 * Build Cytoscape graph from discovery results
 */
export function buildGraphFromDiscovery(discoveryResult) {
  const { files } = discoveryResult;
  const implications = files.implications || [];
  
  const nodes = [];
  const edges = [];
  
  // Create nodes from implications
  implications.forEach(imp => {
    const metadata = imp.metadata || {};
    
    nodes.push({
      data: {
        id: metadata.className || imp.className,
        label: extractStateName(metadata.className),
        type: 'state',
        isStateful: metadata.isStateful,
        pattern: metadata.pattern,
        hasXState: metadata.hasXStateConfig,
        // Store full metadata for details panel
        metadata: metadata,
      },
      classes: metadata.pattern || 'default',
    });
  });
  
  // TODO: Extract transitions from xstateConfig
  // For now, we'll create edges manually or in Phase 2.5
  
  return { nodes, edges };
}

/**
 * Extract state name from class name
 * "AcceptedBookingImplications" -> "Accepted"
 */
function extractStateName(className) {
  if (!className) return 'Unknown';
  
  // Remove "Implications" suffix
  let name = className.replace(/Implications$/i, '');
  
  // Remove "Booking" prefix/suffix
  name = name.replace(/Booking$/i, '').replace(/^Booking/i, '');
  
  return name || className;
}

/**
 * Build graph with sample data (for testing)
 */
export function buildSampleGraph() {
  return {
    nodes: [
      { 
        data: { 
          id: 'created', 
          label: 'Created',
          type: 'state',
          isStateful: true,
          pattern: 'booking',
          metadata: {
            className: 'CreatedBookingImplications',
            isStateful: true,
            hasXStateConfig: true,
            hasMirrorsOn: true,
            pattern: 'booking',
            staticProperties: ['xstateConfig', 'mirrorsOn', 'statusData'],
            staticMethods: ['validateTestData', 'createTestData'],
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
          metadata: {
            className: 'PendingBookingImplications',
            isStateful: true,
            hasXStateConfig: true,
            hasMirrorsOn: true,
            pattern: 'booking',
            staticProperties: ['xstateConfig', 'mirrorsOn'],
            staticMethods: ['validateTestData'],
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
          metadata: {
            className: 'AcceptedBookingImplications',
            isStateful: true,
            hasXStateConfig: true,
            hasMirrorsOn: true,
            pattern: 'booking',
            staticProperties: ['xstateConfig', 'mirrorsOn', 'triggeredBy'],
            staticMethods: ['validateTestData', 'createTestData'],
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
          metadata: {
            className: 'RejectedBookingImplications',
            isStateful: true,
            hasXStateConfig: true,
            hasMirrorsOn: true,
            pattern: 'booking',
            staticProperties: ['xstateConfig', 'mirrorsOn'],
            staticMethods: [],
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
          metadata: {
            className: 'CheckedInBookingImplications',
            isStateful: true,
            hasXStateConfig: true,
            hasMirrorsOn: true,
            pattern: 'booking',
            staticProperties: ['xstateConfig', 'mirrorsOn'],
            staticMethods: ['createTestData'],
          },
        },
        classes: 'booking',
      },
    ],
    edges: [
      { data: { source: 'created', target: 'pending', label: 'REQUEST' } },
      { data: { source: 'pending', target: 'accepted', label: 'ACCEPT' } },
      { data: { source: 'pending', target: 'rejected', label: 'REJECT' } },
      { data: { source: 'accepted', target: 'checkedIn', label: 'CHECK_IN' } },
      { data: { source: 'accepted', target: 'pending', label: 'UNDO' } },
    ],
  };
}