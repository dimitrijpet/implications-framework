// packages/web-app/src/components/StatsPanel/StatsPanel.jsx

import { defaultTheme } from '../../config/visualizerTheme';

export default function StatsPanel({ discoveryResult, theme = defaultTheme }) {
  if (!discoveryResult) {
    return null;
  }
  
  // Calculate stats
  const stats = calculateStats(discoveryResult);
  
  return (
    <div 
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6"
    >
      <StatCard
        icon="📊"
        label="Total States"
        value={stats.totalStates}
        color={theme.colors.accents.blue}
        theme={theme}
      />
      
      <StatCard
        icon="⚙️"
        label="Stateful"
        value={stats.statefulStates}
        subtitle={`${stats.statefulPercent}%`}
        color={theme.colors.accents.purple}
        theme={theme}
      />
      
      <StatCard
        icon="🔗"
        label="Transitions"
        value={stats.totalTransitions}
        subtitle={`${stats.avgTransitions} avg`}
        color={theme.colors.accents.green}
        theme={theme}
      />
      
      <StatCard
        icon="🖥️"
        label="UI Screens"
        value={stats.totalScreens}
        subtitle={`${stats.platformCount} platforms`}
        color={theme.colors.accents.yellow}
        theme={theme}
      />
      
      <StatCard
        icon="📱"
        label="Platforms"
        value={stats.platformCount}
        subtitle={stats.platformNames}
        color={theme.colors.accents.pink}
        theme={theme}
      />
      
      <StatCard
        icon="✅"
        label="Coverage"
        value={`${stats.coveragePercent}%`}
        subtitle={stats.coverageStatus}
        color={stats.coverageColor}
        theme={theme}
        highlight={true}
      />
    </div>
  );
}

function StatCard({ icon, label, value, subtitle, color, theme, highlight = false }) {
  return (
    <div 
      className="glass-light p-4 rounded-xl border transition hover:scale-105"
      style={{ 
        borderColor: highlight ? color : theme.colors.border,
        borderWidth: highlight ? '2px' : '1px',
        boxShadow: highlight ? `0 0 20px ${color}40` : 'none'
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-3xl">{icon}</span>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide" style={{ color: theme.colors.text.tertiary }}>
            {label}
          </div>
          <div 
            className="text-2xl font-bold"
            style={{ color: color }}
          >
            {value}
          </div>
        </div>
      </div>
      
      {subtitle && (
        <div 
          className="text-xs mt-1"
          style={{ color: theme.colors.text.secondary }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

function calculateStats(discoveryResult) {
  const implications = discoveryResult.files?.implications || [];
  const transitions = discoveryResult.transitions || [];
  
  // Total states
  const totalStates = implications.length;
  
  // Stateful states (have xstateConfig)
  const statefulStates = implications.filter(
    imp => imp.metadata?.hasXStateConfig
  ).length;
  
  const statefulPercent = totalStates > 0 
    ? Math.round((statefulStates / totalStates) * 100)
    : 0;
  
  // Transitions
  const totalTransitions = transitions.length;
  const avgTransitions = statefulStates > 0
    ? (totalTransitions / statefulStates).toFixed(1)
    : '0';
  
  // UI Screens
  const totalScreens = implications.reduce(
    (sum, imp) => sum + (imp.metadata?.uiCoverage?.total || 0),
    0
  );
  
  // Platforms
  const platformsSet = new Set();
  implications.forEach(imp => {
    if (imp.metadata?.uiCoverage?.platforms) {
      Object.keys(imp.metadata.uiCoverage.platforms).forEach(p => platformsSet.add(p));
    }
  });
  
  const platformCount = platformsSet.size;
  const platformNames = Array.from(platformsSet).join(', ');
  
  // Coverage calculation
  // States with UI implications / total stateful states
  const statesWithUI = implications.filter(
    imp => imp.metadata?.hasXStateConfig && 
           imp.metadata?.uiCoverage?.total > 0
  ).length;
  
  const coveragePercent = statefulStates > 0
    ? Math.round((statesWithUI / statefulStates) * 100)
    : 0;
  
  let coverageStatus = 'No Data';
  let coverageColor = defaultTheme.colors.text.tertiary;
  
  if (coveragePercent >= 80) {
    coverageStatus = 'Excellent';
    coverageColor = defaultTheme.colors.accents.green;
  } else if (coveragePercent >= 60) {
    coverageStatus = 'Good';
    coverageColor = defaultTheme.colors.accents.yellow;
  } else if (coveragePercent >= 40) {
    coverageStatus = 'Fair';
    coverageColor = defaultTheme.colors.accents.orange || '#f97316';
  } else if (coveragePercent > 0) {
    coverageStatus = 'Low';
    coverageColor = defaultTheme.colors.accents.red;
  }
  
  return {
    totalStates,
    statefulStates,
    statefulPercent,
    totalTransitions,
    avgTransitions,
    totalScreens,
    platformCount,
    platformNames,
    coveragePercent,
    coverageStatus,
    coverageColor
  };
}