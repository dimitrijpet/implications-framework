# @implications/core

Core utilities for the Implications Framework, including the State Registry system.

## Features

- **StateRegistry**: Maps short state names to full class names
- Three strategies: auto-discovery, pattern-based, explicit mappings
- Case-sensitive/insensitive resolution
- Conflict detection and warnings

## Installation
```bash
pnpm add @implications/core
```

## Usage

### Auto-Discovery Strategy
```javascript
import { StateRegistry } from '@implications/core';

const registry = new StateRegistry({
  stateRegistry: {
    strategy: 'auto',
    statusPrefixes: ['Accepted', 'Rejected', 'Pending']
  }
});

await registry.build(discoveryResult);

registry.resolve('accepted'); // → 'AcceptedBookingImplications'
```

### Pattern-Based Strategy
```javascript
const registry = new StateRegistry({
  stateRegistry: {
    strategy: 'pattern',
    pattern: '{Status}BookingImplications'
  }
});

await registry.build(discoveryResult);

registry.resolve('accepted'); // → 'AcceptedBookingImplications'
```

### Explicit Mappings
```javascript
const registry = new StateRegistry({
  stateRegistry: {
    strategy: 'explicit',
    mappings: {
      'accepted': 'AcceptedBookingImplications',
      'rejected': 'CustomRejectedClass'
    }
  }
});

await registry.build(discoveryResult);
```

## API

### `new StateRegistry(config)`

Create a new registry instance.

### `async build(discoveryResult)`

Build registry from discovery result.

### `resolve(stateName): string | null`

Resolve short name to full class name.

### `exists(stateName): boolean`

Check if state exists in registry.

### `getAllMappings(): Array<{shortName, fullClassName}>`

Get all registered mappings.

## License

MIT

// packages/core/README.md (ADD Section)

## State Registry

The State Registry maps short state names (like `'accepted'`) to full class names (like `'AcceptedBookingImplications'`).

### Usage
```javascript
import { StateRegistry } from '@implications/core/registry';

// Auto-discovery
const registry = new StateRegistry(config);
await registry.build(discoveryResult);

// Resolve state names
registry.resolve('accepted'); // → 'AcceptedBookingImplications'
registry.exists('pending'); // → true/false
```

### Configuration

Add to your `ai-testing.config.js`:
```javascript
module.exports = {
  stateRegistry: {
    strategy: 'auto', // or 'pattern' or 'explicit'
    pattern: '{Status}BookingImplications', // for pattern strategy
    mappings: { /* ... */ }, // for explicit strategy
    statusPrefixes: ['Accepted', 'Rejected', 'Pending'],
    caseSensitive: false
  }
};
```