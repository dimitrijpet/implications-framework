/**
 * Visualizer Theme Configuration
 * 
 * Customize colors, styles, and visual settings per project
 */

export const defaultTheme = {
  // Color scheme
  colors: {
    background: {
      primary: '#0f172a',
      secondary: '#1e293b',
      tertiary: '#334155',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
      tertiary: '#94a3b8',
    },
    border: '#475569',
    accents: {
      blue: '#3b82f6',
      purple: '#8b5cf6',
      green: '#10b981',
      red: '#ef4444',
      yellow: '#eab308',
      orange: '#f59e0b',
      pink: '#ec4899',
    }
  },
  
  // Platform styling (customize per project)
  platforms: {
    'mobile-dancer': {
      color: '#a855f7',
      shadow: '0 0 20px rgba(168, 85, 247, 0.8)',
      name: 'Dancer',
      icon: '📱'
    },
    'mobile-manager': {
      color: '#3b82f6',
      shadow: '0 0 20px rgba(59, 130, 246, 0.8)',
      name: 'Manager',
      icon: '📲'
    },
    'web': {
      color: '#f1f5f9',
      shadow: '0 0 20px rgba(241, 245, 249, 0.6)',
      name: 'Web',
      icon: '🌐'
    },
    'dancer': {
      color: '#a855f7',
      shadow: '0 0 20px rgba(168, 85, 247, 0.8)',
      name: 'Dancer',
      icon: '📱'
    },
    'clubApp': {
      color: '#3b82f6',
      shadow: '0 0 20px rgba(59, 130, 246, 0.8)',
      name: 'Manager',
      icon: '📲'
    }
  },
  
  // State status colors (customize per project)
  statusColors: {
    'created': '#6b7280',
    'pending': '#eab308',
    'invited': '#3b82f6',
    'accepted': '#10b981',
    'rejected': '#ef4444',
    'standby': '#f59e0b',
    'checked_in': '#8b5cf6',
    'checked_out': '#06b6d4'
  },
  
  // State status icons
  statusIcons: {
    'created': '📝',
    'pending': '⏳',
    'invited': '💌',
    'accepted': '✅',
    'rejected': '❌',
    'standby': '⏸️',
    'checked_in': '🎯',
    'checked_out': '✨'
  },
  
  // Graph settings
  graph: {
    nodeWidth: 80,
    nodeHeight: 80,
    borderWidth: 5,
    multiBorderWidth: 10,
    multiBorderColor: '#10b981',
    edgeWidth: 1.5,
    arrowSize: 3,
    shadowBlur: 20
  }
};

/**
 * Get platform style
 */
export function getPlatformStyle(platform, theme = defaultTheme) {
  return theme.platforms[platform] || {
    color: '#666',
    shadow: '0 0 15px rgba(102, 102, 102, 0.5)',
    name: 'Unknown',
    icon: '❓'
  };
}

/**
 * Get status color
 */
export function getStatusColor(status, theme = defaultTheme) {
  return theme.statusColors[status] || '#6b7280';
}

/**
 * Get status icon
 */
export function getStatusIcon(status, theme = defaultTheme) {
  return theme.statusIcons[status] || '📝';
}

/**
 * Load custom theme from config file (if exists)
 */
export async function loadProjectTheme(projectPath) {
  // TODO: Check if project has custom theme file
  // For now, return default
  return defaultTheme;
}