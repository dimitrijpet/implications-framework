# Visualization System - Complete Guide

## 🎨 Overview

The visualization system transforms discovered implication files into an interactive state machine graph with rich metadata display.

---

## 🏗️ Architecture
```
User Interaction → API Request → Discovery → Graph Building → Rendering
      ↓              ↓              ↓            ↓              ↓
  Visualizer.jsx  /api/scan  discoveryService  graphBuilder  StateGraph
```

---

## 📦 Component Structure

### 1. Main Page: `Visualizer.jsx`

**Location:** `packages/web-app/src/pages/Visualizer.jsx`

**Purpose:** Orchestrates the entire visualization flow

**Key Functions:**
```javascript
// Scan project and build graph
const handleScan = async () => {
  const response = await apiClient.post('/discovery/scan', { projectPath });
  const discovery = response.data.result;
  setDiscoveryResult(discovery);
  
  const graph = buildGraphFromDiscovery(discovery);
  setGraphData(graph);
};

// Handle node clicks
const handleNodeClick = (nodeData) => {
  // Find implication in discovery result
  const implication = discoveryResult.files.implications.find(...);
  
  // Build state object with full metadata
  const state = {
    name: nodeData.id,
    displayName: metadata.status,
    meta: { ...metadata },
    transitions: [...],
    files: { implication: '...', test: '...' },
    uiCoverage: metadata.uiCoverage
  };
  
  setSelectedState(state);
};
```

**State Management:**
- `projectPath` - User input
- `discoveryResult` - Raw API response
- `graphData` - Transformed Cytoscape data
- `selectedState` - Currently viewed state
- `loading` - Scan in progress

---

### 2. Graph Component: `StateGraph.jsx`

**Location:** `packages/web-app/src/components/StateGraph/StateGraph.jsx`

**Purpose:** Renders Cytoscape.js graph with custom styling

**Key Features:**
```javascript
// Initialize Cytoscape
const cy = cytoscape({
  container: containerRef.current,
  elements: {
    nodes: graphData.nodes,
    edges: graphData.edges
  },
  style: [
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'background-color': 'data(color)',
        'border-color': 'data(platformColor)',
        'border-width': 3
      }
    },
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'line-color': 'data(platformColor)'
      }
    }
  ],
  layout: {
    name: 'dagre',
    rankDir: 'LR',
    nodeSep: 100,
    rankSep: 150
  }
});

// Handle clicks
cy.on('tap', 'node', (event) => {
  onNodeClick(event.target.data());
});
```

**Layout Algorithm:** Dagre (hierarchical left-to-right)

**Styling:** Platform-based colors, status icons, dynamic borders

---

### 3. Detail Modal: `StateDetailModal.jsx`

**Location:** `packages/web-app/src/components/StateGraph/StateDetailModal.jsx`

**Purpose:** Full-screen modal showing complete state information

**Sections:**

#### A. Header
```javascript
<div className="flex items-start justify-between">
  <div className="flex items-center gap-4">
    <div className="text-6xl">{statusIcon}</div>
    <div>
      <h2>{state.displayName}</h2>
      <span className="status-badge">{state.name}</span>
    </div>
  </div>
  <button onClick={onClose}>✕</button>
</div>
```

#### B. Dynamic Metadata Grid
```javascript
<DynamicMetadataGrid metadata={state.meta} theme={theme} />

function DynamicMetadataGrid({ metadata, theme }) {
  // Group fields by category
  const fieldGroups = categorizeFields(metadata);
  
  return (
    <div className="space-y-6">
      {Object.entries(fieldGroups).map(([category, fields]) => (
        <div key={category}>
          <h4>{category}</h4>
          <div className="grid grid-cols-2 gap-4">
            {fields.map(([key, value]) => (
              <DynamicMetadataField key={key} fieldName={key} value={value} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Field Categories:**
- **Core:** status, triggerAction, statusCode, statusNumber
- **Buttons:** triggerButton, afterButton, previousButton
- **Platform:** platform, platforms, notificationKey
- **Setup:** setup, allSetups, actionName, requires, requiredFields
- **Other:** Everything else

#### C. Dynamic Field Renderer
```javascript
function renderValue(value, fieldName, theme, platformStyle) {
  // Null/undefined → Red warning
  if (value === null || value === undefined) {
    return <span style={{ color: red }}>⚠️ Not Set</span>;
  }
  
  // Arrays → Badges
  if (Array.isArray(value)) {
    return value.map(item => <span className="badge">{item}</span>);
  }
  
  // Objects → Nested display
  if (typeof value === 'object') {
    return Object.entries(value).map(([k, v]) => (
      <div>{k}: {String(v)}</div>
    ));
  }
  
  // Special styling for specific fields
  if (fieldName === 'platform') {
    return <span>{platformStyle.icon} {value}</span>;
  }
  
  if (fieldName.includes('Button')) {
    return <span className="button-badge">{value}</span>;
  }
  
  // Default: string
  return String(value);
}
```

#### D. Files Section
```javascript
<div className="mb-8">
  <h3>📂 Files</h3>
  <FileCard label="Implication File" path={state.files.implication} />
  <FileCard label="Test File" path={state.files.test} />
</div>
```

#### E. Transitions Section
```javascript
<div className="mb-8">
  <h3>🔄 Transitions ({state.transitions.length})</h3>
  {state.transitions.map(t => (
    <TransitionCard 
      key={t.event}
      transition={t}
      theme={theme}
    />
  ))}
</div>

function TransitionCard({ transition, theme }) {
  return (
    <div className="flex items-center gap-4">
      <span className="event-badge">{transition.event}</span>
      <span>→</span>
      <span className="target-state">{transition.target}</span>
    </div>
  );
}
```

#### F. UI Coverage Section
```javascript
<div className="mb-8">
  <h3>🖥️ UI Coverage ({state.uiCoverage.total} screens)</h3>
  {Object.entries(state.uiCoverage.platforms).map(([platformName, data]) => (
    <PlatformCard key={platformName} platformName={platformName} data={data} />
  ))}
</div>

function PlatformCard({ platformName, data, theme }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <div className="platform-card">
      {/* Collapsible header */}
      <div className="header" onClick={() => setIsExpanded(!isExpanded)}>
        <span>{platformStyle.icon} {platformStyle.name}</span>
        <span>({data.count} screens)</span>
        <span className="arrow">{isExpanded ? '▼' : '▶'}</span>
      </div>
      
      {/* Screens list */}
      {isExpanded && data.screens.map(screen => (
        <ScreenCard key={screen.name} screen={screen} theme={theme} />
      ))}
    </div>
  );
}

function ScreenCard({ screen, theme }) {
  return (
    <div className="screen-card">
      <div className="font-semibold">{screen.name}</div>
      {screen.description && <div className="italic">{screen.description}</div>}
      
      {/* Visible elements */}
      {screen.visible.length > 0 && (
        <div className="visible-section">
          <span>✅ Visible ({screen.visible.length}):</span>
          {screen.visible.map(el => <span className="element">{el}</span>)}
        </div>
      )}
      
      {/* Hidden elements */}
      {screen.hidden.length > 0 && (
        <div className="hidden-section">
          <span>❌ Hidden ({screen.hidden.length}):</span>
          {screen.hidden.map(el => <span className="element">{el}</span>)}
        </div>
      )}
      
      {/* Text checks */}
      {Object.keys(screen.checks.text).length > 0 && (
        <div className="text-checks-section">
          <span>📝 Text Checks:</span>
          {Object.entries(screen.checks.text).map(([el, val]) => (
            <div>{el} → "{val}"</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 🎨 Theme System

### Configuration Structure

**Location:** `packages/web-app/src/config/visualizerTheme.js`
```javascript
export const defaultTheme = {
  colors: {
    background: {
      primary: '#0a0e1a',    // Main background
      secondary: '#0f1419',  // Cards
      tertiary: '#1a1f2e'    // Input fields
    },
    text: {
      primary: '#e5e7eb',    // Main text
      secondary: '#9ca3af',  // Subdued text
      tertiary: '#6b7280'    // Disabled/hints
    },
    accents: {
      blue: '#3b82f6',       // Primary actions
      purple: '#8b5cf6',     // dancer
      green: '#10b981',      // Success
      red: '#ef4444',        // Errors
      yellow: '#f59e0b',     // Warnings
      pink: '#ec4899'        // UI coverage
    },
    border: '#1f2937',
    glass: 'rgba(255, 255, 255, 0.05)'
  },
  
  platforms: {
    'dancer': {
      color: '#8b5cf6',
      icon: '📱',
      name: 'Dancer App',
      description: 'Mobile app for dancers'
    },
    'manager': {
      color: '#3b82f6',
      icon: '📲',
      name: 'Manager App',
      description: 'Mobile app for club managers'
    },
    'clubApp': {
      color: '#3b82f6',
      icon: '📲',
      name: 'Club App',
      description: 'Club management app'
    },
    'web': {
      color: '#60a5fa',
      icon: '🌐',
      name: 'Web Platform',
      description: 'Web application'
    }
  },
  
  statusColors: {
    pending: '#f59e0b',      // Yellow
    accepted: '#10b981',     // Green
    rejected: '#ef4444',     // Red
    cancelled: '#6b7280',    // Gray
    completed: '#3b82f6',    // Blue
    standby: '#8b5cf6'       // Purple
  },
  
  statusIcons: {
    pending: '⏳',
    accepted: '✅',
    rejected: '❌',
    cancelled: '🚫',
    completed: '✔️',
    standby: '⏸️',
    created: '📝'
  }
};
```

### Helper Functions
```javascript
// Get platform styling
export function getPlatformStyle(platformName, theme = defaultTheme) {
  return theme.platforms[platformName] || {
    color: theme.colors.accents.blue,
    icon: '📱',
    name: platformName,
    description: 'Unknown platform'
  };
}

// Get status color
export function getStatusColor(statusName, theme = defaultTheme) {
  const normalized = statusName.toLowerCase();
  return theme.statusColors[normalized] || theme.colors.text.secondary;
}

// Get status icon
export function getStatusIcon(statusName, theme = defaultTheme) {
  const normalized = statusName.toLowerCase();
  return theme.statusIcons[normalized] || '📄';
}
```

### Usage in Components
```javascript
import { defaultTheme, getPlatformStyle, getStatusColor } from '../config/visualizerTheme';

function MyComponent({ stateName, platform }) {
  const theme = defaultTheme;
  const platformStyle = getPlatformStyle(platform, theme);
  const statusColor = getStatusColor(stateName, theme);
  
  return (
    <div style={{ 
      background: theme.colors.background.secondary,
      borderColor: platformStyle.color,
      color: statusColor
    }}>
      {platformStyle.icon} {stateName}
    </div>
  );
}
```

---

## 🔧 Graph Building Logic

### Graph Builder: `graphBuilder.js`

**Location:** `packages/web-app/src/utils/graphBuilder.js`
```javascript
export function buildGraphFromDiscovery(discoveryResult) {
  const { files, transitions } = discoveryResult;
  const implications = files.implications || [];
  
  const nodes = [];
  const edges = [];
  const stateMap = new Map();
  
  // ✅ FILTER: Only stateful implications
  const statefulImplications = implications.filter(imp => 
    imp.metadata?.hasXStateConfig === true
  );
  
  console.log(`Filtered to ${statefulImplications.length} stateful implications`);
  
  // Create nodes
  statefulImplications.forEach(imp => {
    const metadata = imp.metadata;
    const stateName = extractStateName(metadata.className);
    
    stateMap.set(metadata.className, stateName.toLowerCase());
    
    const platform = metadata.setup?.platform || metadata.platform || 'web';
    const platformStyle = getPlatformStyle(platform, defaultTheme);
    const statusColor = getStatusColor(stateName, defaultTheme);
    const statusIcon = getStatusIcon(stateName, defaultTheme);
    
    nodes.push({
      data: {
        id: stateName.toLowerCase(),
        label: stateName,
        type: 'state',
        isStateful: metadata.isStateful,
        pattern: metadata.pattern,
        metadata: metadata,
        
        // Visual styling
        color: statusColor,
        icon: statusIcon,
        platform: platform,
        platformColor: platformStyle.color
      }
    });
  });
  
  // Create edges from transitions
  transitions.forEach(transition => {
    const fromState = extractStateName(transition.from).toLowerCase();
    const toState = transition.to.toLowerCase();
    
    if (stateMap.has(fromState) && stateMap.has(toState)) {
      const sourceNode = nodes.find(n => n.data.id === fromState);
      const platformColor = sourceNode?.data.platformColor || defaultTheme.colors.accents.blue;
      
      edges.push({
        data: {
          id: `${fromState}-${toState}-${transition.event}`,
          source: fromState,
          target: toState,
          label: transition.event,
          platformColor: platformColor
        }
      });
    }
  });
  
  console.log(`Built graph: ${nodes.length} nodes, ${edges.length} edges`);
  
  return { nodes, edges };
}

// Extract clean state name from class name
function extractStateName(className) {
  return className
    .replace('BookingImplications', '')
    .replace('Implications', '')
    .toLowerCase();
}
```

---

## 🎭 CSS & Styling

### Glassmorphism Effects
```css
/* packages/web-app/src/index.css */

.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-light {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

### Animation Classes
```css
.detail-panel-enter {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Status Badges
```css
.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  display: inline-block;
}

.status-accepted {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.status-rejected {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}
```

---

## 🔍 Debugging Tips

### Enable Console Logs
```javascript
// In Visualizer.jsx
console.log('📦 Discovery result:', discoveryResult);
console.log('📦 First implication:', discoveryResult.files.implications[0]);
console.log('✅ Selected state with full metadata:', state);
console.log('🖥️ UI Coverage:', state.uiCoverage);
```

### Check Graph Data
```javascript
// In graphBuilder.js
console.log(`📋 ${imp.metadata.className}:`, {
  status: imp.metadata.status,
  triggerButton: imp.metadata.triggerButton,
  platform: imp.metadata.platform
});
```

### Verify API Response
```bash
# Manual API test
curl -X POST http://localhost:3000/api/discovery/scan \
  -H "Content-Type: application/json" \
  -d '{"projectPath":"/path/to/project"}'
```

---

## 📊 Performance Considerations

### Large Projects (1000+ files)
- Discovery takes 2-4 seconds
- Graph rendering is instant (<100ms)
- Modal rendering is instant

### Optimization Opportunities
- Cache discovery results
- Lazy load modal content
- Virtual scrolling for large lists
- Debounce search/filter inputs

---

## 🎯 Future Enhancements

### Planned Features
1. **Filters:** By platform, status, pattern
2. **Search:** Find states by name/metadata
3. **Zoom controls:** Better navigation of large graphs
4. **Export:** Save graph as image/PDF
5. **Comparison:** Side-by-side state comparison
6. **History:** Track changes over time

### UI Improvements
1. **Tooltips:** Hover to see quick info
2. **Mini-map:** Overview of full graph
3. **Breadcrumbs:** Navigation history
4. **Keyboard shortcuts:** Power user features
5. **Dark/Light toggle:** Theme switching

---

## 🐛 Common Issues

### Graph Not Showing
**Check:** Is `graphData` populated?
```javascript
console.log('Graph data:', graphData);
// Should have nodes and edges arrays
```

### Metadata Missing
**Check:** Did discovery extract it?
```javascript
console.log('Metadata:', imp.metadata);
// Should have status, triggerButton, etc.
```

### UI Coverage Empty
**Check:** Does file have `mirrorsOn.UI`?
```javascript
console.log('UI Coverage:', metadata.uiCoverage);
// Should have total > 0
```

---

This visualization system is **production-ready** for viewing. Editing features will be added in Session 2!