import {
  getPlatformStyle,
  getStatusColor,
  getStatusIcon,
  defaultTheme,
} from "../config/visualizerTheme";
import {
  getRequiresObjectColor,
  formatRequiresLabel,
} from "./requiresColors.js";

/**
 * Normalize hex color - remove alpha channel if present (Cytoscape doesn't support 8-char hex)
 */
function normalizeHexColor(color) {
  if (!color) return "#8b5cf6";
  // Remove alpha channel from 8-char hex (e.g., #c746abff -> #c746ab)
  if (color.length === 9 && color.startsWith("#")) {
    return color.substring(0, 7);
  }
  return color;
}

// Default color configs (used if not in discovery result)
const DEFAULT_GRAPH_COLORS = {
  colorNodesBy: "platform",
  platforms: {
    web: "#3b82f6", // Blue
    "mobile-dancer": "#a855f7", // Purple
    "mobile-manager": "#06b6d4", // Cyan
    mobile: "#8b5cf6", // Purple
    _default: "#3b82f6", // Blue (was gray, now blue as fallback)
  },
  statuses: {
    pending: "#f59e0b",
    accepted: "#10b981",
    rejected: "#ef4444",
    cancelled: "#6b7280",
    completed: "#3b82f6",
    checked_in: "#8b5cf6",
    _default: "#8b5cf6",
  },
  patterns: {
    booking: "#3b82f6",
    cms: "#10b981",
    _default: "#8b5cf6",
  },
};

/**
 * Get node color based on config
 */
function getNodeColorFromConfig(metadata, graphColors) {
  const config = graphColors || DEFAULT_GRAPH_COLORS;
  const colorBy = config.colorNodesBy || "platform";

  let value, colorMap;

  switch (colorBy) {
    case "platform":
      value = metadata.platform || metadata.setup?.platform || "web";
      colorMap = config.platforms || DEFAULT_GRAPH_COLORS.platforms;
      break;
    case "status":
      value = metadata.status || "";
      colorMap = config.statuses || DEFAULT_GRAPH_COLORS.statuses;
      break;
    case "pattern":
      value = metadata.pattern || "";
      colorMap = config.patterns || DEFAULT_GRAPH_COLORS.patterns;
      break;
    default:
      value = metadata.platform || "web";
      colorMap = config.platforms || DEFAULT_GRAPH_COLORS.platforms;
  }

  const lookupValue = value ? value.toLowerCase() : "";
  const rawColor = colorMap[lookupValue] || colorMap["_default"] || "#3b82f6";
  const color = normalizeHexColor(rawColor); // Strip alpha if present

  // Debug logging
  console.log(
    `🎨 Node color: colorBy=${colorBy}, value="${value}", lookupValue="${lookupValue}", color=${color}`
  );

  return color;
}

/**
 * Build Cytoscape graph from discovery results
 */
export function buildGraphFromDiscovery(discoveryResult) {
  const { files, transitions } = discoveryResult;
  const implications = files.implications || [];
  const projectPath = discoveryResult.projectPath;

  // Get graph colors from config (passed from backend)
  const graphColors =
    discoveryResult.config?.graphColors || DEFAULT_GRAPH_COLORS;

  const nodes = [];
  const edges = [];
  const stateMap = new Map();
  const allTags = {};

  // Filter to stateful implications only
  const statefulImplications = implications.filter(
    (imp) => imp.metadata?.hasXStateConfig === true
  );

  console.log(
    `✅ Filtered to ${statefulImplications.length} stateful implications (from ${implications.length} total)`
  );

  // Log metadata for debugging
  statefulImplications.forEach((imp) => {
    console.log(`📋 ${imp.metadata.className}:`, {
      status: imp.metadata.status,
      triggerButton: imp.metadata.triggerButton,
      platform: imp.metadata.platform,
      setup: imp.metadata.setup,
    });
  });

  // Create nodes
  statefulImplications.forEach((imp) => {
    const metadata = imp.metadata || {};
    const stateName = extractStateName(metadata.className);

    console.log(
      `📝 Creating node: className="${metadata.className}" → stateName="${stateName}"`
    );

    stateMap.set(metadata.className, stateName.toLowerCase());
    stateMap.set(stateName.toLowerCase(), stateName.toLowerCase());

    if (metadata.status) {
      stateMap.set(metadata.status.toLowerCase(), stateName.toLowerCase());
      console.log(
        `   ✅ Mapped status: "${metadata.status}" → "${stateName.toLowerCase()}"`
      );
    }

    // Get platform for edge colors
    const platform = metadata.setup?.platform || metadata.platform || "web";
    const platformStyle = getPlatformStyle(platform, defaultTheme);
    const statusIcon = getStatusIcon(stateName, defaultTheme);

    // Get node color from config
    const nodeColor = getNodeColorFromConfig(metadata, graphColors);

    // Determine if multi-platform
    const allPlatforms = metadata.platforms || [platform];
    const isMultiPlatform = allPlatforms.length > 1;

    // Extract tags (don't auto-infer platform - let user control)
    const tags = extractTags(metadata, false);

    // Collect discovered tags
    Object.entries(tags).forEach(([category, value]) => {
      if (!allTags[category]) allTags[category] = new Set();
      if (Array.isArray(value)) {
        value.forEach((v) => allTags[category].add(v));
      } else if (value) {
        allTags[category].add(value);
      }
    });

    nodes.push({
      data: {
        id: metadata.status
          ? metadata.status.toLowerCase()
          : stateName.toLowerCase(),
        label: stateName,
        type: "state",
        status: metadata.status,
        isStateful: metadata.isStateful,
        pattern: metadata.pattern,
        hasXState: metadata.hasXStateConfig,
        metadata: metadata,
        tags: tags,

        files: {
          implication: projectPath + "/" + imp.path,
          test:
            projectPath +
            "/" +
            (Array.isArray(metadata.setup)
              ? metadata.setup[0]?.testFile
              : metadata.setup?.testFile),
        },

        // Visual styling - use config color
        color: nodeColor,
        icon: statusIcon,
        platform: platform,
        platformColor: platformStyle.color,
        allPlatforms: allPlatforms,
        borderStyle: isMultiPlatform ? "multi" : "solid",

        // Shadow properties
        shadowBlur: 20,
        shadowColor: platformStyle.color,
        shadowOpacity: 0.8,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
      },
      classes: metadata.pattern || "default",
    });
  });

  // Create edges from transitions
  console.log(
    `🔗 Building edges from ${transitions?.length || 0} transitions...`
  );

  if (transitions && transitions.length > 0) {
    transitions.forEach((transition) => {
      const fromState = extractStateName(transition.from).toLowerCase();
      const toState = transition.to.toLowerCase();

      // Only add edge if both nodes exist
      if (stateMap.has(fromState) && stateMap.has(toState)) {
        // Determine platform color for edge
        const sourceNode = nodes.find((n) => n.data.id === fromState);
        const platformColor =
          sourceNode?.data.platformColor || defaultTheme.colors.accents.blue;

        // Build unique edge ID including requires if present
        const requiresKey = transition.requires
          ? `-req:${Object.entries(transition.requires)
              .map(([k, v]) => `${k}=${v}`)
              .join(",")}`
          : "";
        const edgeId = `${fromState}-${toState}-${transition.event}${requiresKey}`;

        // ✅ Get requires color if present
        const requiresColor = transition.requires
          ? getRequiresObjectColor(transition.requires)
          : null;

        const requiresLabel = transition.requires
          ? formatRequiresLabel(transition.requires)
          : "";

   edges.push({
  data: {
    id: edgeId,
    source: fromState,
    target: toState,
    label: transition.isObserver
      ? `👁️ ${transition.event}`
      : transition.event,
    isObserver: transition.isObserver || false,
    mode: transition.mode,
    platformColor: platformColor,
    platform: sourceNode?.data.platform || "web",
    platforms: transition.platforms || null,

    // ✅ Requires/conditions data
    requires: transition.requires || null,
    hasRequires: !!(
      transition.requires && Object.keys(transition.requires).length > 0
    ),
    requiresLabel: requiresLabel,
    requiresColor: requiresColor,
    // ✅ Conditions data (block-based system)
    conditions: transition.conditions || null,
    hasConditions: !!(transition.conditions?.blocks?.length > 0),
    conditionsLabel:
      transition.conditions?.blocks?.length > 0
        ? `🔒 ${transition.conditions.blocks.length} condition${transition.conditions.blocks.length > 1 ? "s" : ""}`
        : "",
    
    // ✨ NEW: Regeneration indicator
    needsRegeneration: transition.needsRegeneration || false,
    regenerationReason: transition.regenerationReason || null,
    hasTestFile: transition.hasTestFile || false,
    testFile: transition.testFile || null,
  },
});
      }
    });
  }

  console.log(`✅ Built graph: ${nodes.length} nodes, ${edges.length} edges`);

  // Filter out edges that reference non-existent nodes
  const nodeIds = new Set(nodes.map((n) => n.data.id));
  const validEdges = edges.filter((edge) => {
    const hasSource = nodeIds.has(edge.data.source);
    const hasTarget = nodeIds.has(edge.data.target);

    if (!hasSource || !hasTarget) {
      console.warn(
        `REMOVED invalid edge: ${edge.data.source} to ${edge.data.target}`
      );
      return false;
    }
    return true;
  });

  console.log(
    `Valid edges: ${validEdges.length} (removed ${edges.length - validEdges.length} invalid)`
  );

  // Convert tag Sets to sorted arrays
  const discoveredTags = {};
  Object.entries(allTags).forEach(([category, values]) => {
    discoveredTags[category] = Array.from(values).sort();
  });

  console.log(`🏷️ Discovered tags:`, discoveredTags);

  return {
    nodes,
    edges: validEdges,
    discoveredTags,
    graphColors,
  };
}

/**
 * Extract tags from implication metadata
 */
function extractTags(metadata, autoInfer = false) {
  let tags = {};

  // 1. Direct tags object in metadata
  if (metadata.tags && typeof metadata.tags === "object") {
    tags = { ...metadata.tags };
  }

  // 2. Tags in xstateConfig.meta
  if (metadata.xstateConfig?.meta?.tags) {
    tags = { ...tags, ...metadata.xstateConfig.meta.tags };
  }

  // 3. Entity from xstateConfig.meta or direct metadata
  const entity = metadata.xstateConfig?.meta?.entity || metadata.entity;
  if (entity) {
    tags.entity = entity;
  }

  // 4. Only auto-infer if requested (disabled by default)
  if (autoInfer) {
    if (!tags.platform && metadata.platform) {
      tags.platform = metadata.platform;
    }
    if (!tags.pattern && metadata.pattern) {
      tags.pattern = metadata.pattern;
    }
  }

  return tags;
}

/**
 * Extract state name from class name
 */
function extractStateName(className) {
  if (!className) return "Unknown";

  // Don't process if already snake_case
  if (className.includes("_")) {
    return className.toLowerCase();
  }

  // Only process PascalCase names
  let name = className;
  name = name.replace(/Implications$/i, "");
  name = name.replace(/Booking$/i, "").replace(/^Booking/i, "");
  name = name.replace(/([A-Z])/g, (match, p1, offset) => {
    return offset > 0 ? "_" + p1.toLowerCase() : p1.toLowerCase();
  });

  return name || className;
}

/**
 * Build sample graph for testing
 */
export function buildSampleGraph() {
  const sampleNodes = [
    {
      data: {
        id: "created",
        label: "Created",
        type: "state",
        color: "#6b7280",
        tags: { screen: "BookingScreen", flow: "creation" },
      },
      classes: "booking",
    },
    {
      data: {
        id: "pending",
        label: "Pending",
        type: "state",
        color: "#eab308",
        tags: { screen: "BookingScreen", flow: "review" },
      },
      classes: "booking",
    },
  ];

  const sampleEdges = [
    {
      data: {
        source: "created",
        target: "pending",
        label: "REQUEST",
        platformColor: "#f1f5f9",
      },
    },
  ];

  return {
    nodes: sampleNodes,
    edges: sampleEdges,
    discoveredTags: {
      screen: ["BookingScreen"],
      flow: ["creation", "review"],
    },
  };
}
