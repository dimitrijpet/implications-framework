# 🎯 Implications Framework

A standalone code generation system for creating implications-based tests.

## What is This?

The Implications Framework is a **code generator** (not a test framework) that:

- 🔍 Discovers patterns in your existing test code
- 📝 Generates implications, unit tests, and validations
- 🎨 Provides a beautiful web UI for visual editing
- 🤖 Supports both stateless (CMS) and stateful (Booking) testing patterns
- 📊 Visualizes state machines interactively

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Installation
```bash
# Clone the repository
git clone <repo-url>
cd implications-framework

# Install dependencies
pnpm install

# Start all services
pnpm dev
```

### Access Points

- **Web App**: http://localhost:5173
- **API Server**: http://localhost:3000
- **CLI**: `pnpm implications --help`

## Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web App   │────▶│  API Server │────▶│ Guest       │
│  (React)    │     │  (Express)  │     │ Project     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     CLI     │────▶│    Core     │────▶│  Templates  │
│ (Commander) │     │  (Shared)   │     │ (Handlebars)│
└─────────────┘     └─────────────┘     └─────────────┘
```

## Packages

- **`web-app`**: React UI for visual implication building
- **`api-server`**: Express API for discovery and generation
- **`cli`**: Command-line tool for quick operations
- **`core`**: Shared utilities and types

## Usage

### Initialize a Guest Project
```bash
cd /path/to/your/project
pnpm implications init
```

### Generate Code
```bash
# Discover patterns
pnpm implications discover

# Generate implication
pnpm implications generate:implication StayCards

# Generate full suite
pnpm implications generate:suite StayCards
```

### Web UI
```bash
pnpm dev:web
# Open http://localhost:5173
```

## Development
```bash
# Start all services in watch mode
pnpm dev

# Start individual services
pnpm dev:web      # Web app only
pnpm dev:api      # API server only
pnpm dev:cli      # CLI only

# Build for production
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Architecture](./docs/architecture.md)
- [Templates](./docs/templates.md)
- [API Reference](./docs/api-reference.md)

## Examples

See the `examples/` directory for:

- CMS project setup
- Booking system setup
- Custom patterns

## License

MIT