# Changelog

All notable changes to the Implications Framework.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.0] - 2025-10-21

### Added - Session 2
- **Parser Enhancement:** Full support for `ImplicationHelper.mergeWithBase()` pattern
- **Base File Caching:** Cache parsed base files for 3-5x performance improvement
- **Stats Dashboard:** 6-metric coverage dashboard with color-coded status
- **Documentation:** Complete session summaries, architecture docs, and guides
- Cache hit logging and performance metrics
- `StatsPanel` component with coverage calculations

### Changed
- Made `extractUIImplications()` async to support file operations
- Made `extractImplicationMetadata()` async to support UI extraction
- Made `classifyFile()` async to support metadata extraction
- Optimized discovery with base file caching (9 cache hits per scan)
- Improved UI data display (12/12 screens showing full data, was 1/12)

### Performance
- Discovery time: 10s → 2-3s (3-5x faster)
- Base file reads: 11 → 1 (plus 9 cache hits)
- UI accuracy: 8% → 100%
- Cache efficiency: 75% hit rate (9/12 lookups)

### Fixed
- Parser now handles `ImplicationHelper.mergeWithBase()` calls
- Array conflicts resolved (visible items removed from hidden)
- Graph nodes now show connections (transitions extracted correctly)
- Duplicate elements removed from visible/hidden arrays
- Async metadata extraction in transition loop

---

## [1.1.0] - 2025-10-20

### Added - Session 1
- Interactive state machine visualizer with Cytoscape.js
- Dark theme with glassmorphism effects and backdrop blur
- Platform-aware styling (purple/blue/white color coding)
- Full-screen detail modals for state inspection
- Dynamic metadata extraction from `xstateConfig.meta`
- UI coverage display from `mirrorsOn.UI` structure
- Collapsible platform sections in UI coverage
- Status-based node colors (green, red, yellow, etc.)
- Click-to-expand state details

### Technical
- React Router v6 integration
- Theme system with CSS variables
- Discovery API endpoint (`/api/discovery/scan`)
- Generic field rendering (works with any metadata structure)
- Red warnings for missing/null data fields

### UI Components
- `Visualizer.jsx` - Main visualization page
- `StateGraph.jsx` - Cytoscape graph component
- `StateDetailModal.jsx` - Full-screen modal
- `NodeDetails.jsx` - Side panel details
- `visualizerTheme.js` - Theme configuration

---

## [1.0.0] - 2025-10-19

### Added - Phase 1 & 2
- Monorepo structure with pnpm workspaces
- React web app (Vite + Tailwind CSS)
- Express API server with REST endpoints
- CLI tool skeleton (Commander.js)
- Core utilities package (shared code)
- File scanner with glob pattern matching
- AST parser using Babel parser + traverse
- Pattern detectors for:
  - Implications (`*Implications.js`)
  - Sections (`*Section.js`)
  - Screens (`*Screen.js`)
- XState transition extraction from `on:` configs
- Discovery result types and data structures

### Project Structure
```
implications-framework/
├── packages/
│   ├── web-app/      # React + Vite + Tailwind
│   ├── api-server/   # Express + Babel
│   ├── cli/          # Commander.js
│   └── core/         # Shared utilities
└── pnpm-workspace.yaml
```

### Technical Stack
- **Frontend:** React 18, Vite 5, Tailwind CSS 3, React Router 6
- **Backend:** Express 4, Babel Parser 7, Babel Traverse 7
- **Tooling:** pnpm 8, ESLint, Prettier
- **Visualization:** Cytoscape.js 3, dagre layout

---

## [0.1.0] - 2025-10-18

### Initial Concept
- Requirements gathering
- Architecture planning
- Tech stack selection
- Design system mockups

---

## Version Format

**[MAJOR.MINOR.PATCH]**
- **MAJOR:** Breaking changes (API changes, structure changes)
- **MINOR:** New features (new components, new capabilities)
- **PATCH:** Bug fixes, small improvements

---

## Categories

- **Added** - New features
- **Changed** - Changes to existing features
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security updates
- **Performance** - Performance improvements

---

## Upcoming (v1.3.0)

### Planned - Session 3
- [ ] Inline editing of metadata fields
- [ ] Create new states via UI
- [ ] File generation and saving
- [ ] Backup system before file writes
- [ ] Form validation for edits

### Future Sessions
- [ ] Test generation (UNIT + VALIDATION)
- [ ] Multi-project support
- [ ] Filter and search functionality
- [ ] Export/import configuration
- [ ] AI-assisted test generation

---

*Maintained by: Development Team*  
*Last Updated: October 21, 2025*