# Component Scorecard Development Guide

This document provides an overview of the development infrastructure for the Component Scorecard Figma plugin, including state management, error handling, testing, and build processes.

## Table of Contents

1. [Project Structure](#project-structure)
2. [State Management](#state-management)
3. [Error Handling](#error-handling)
4. [Testing Framework](#testing-framework)
5. [Build System](#build-system)
6. [Development Workflow](#development-workflow)

## Project Structure

The Component Scorecard plugin is organized into the following directories:

- `/plugin/` - Core plugin code
  - `code.js` - Main plugin code (runs in Figma's plugin context)
  - `ui.html` - Plugin UI (runs in the iframe)
  - Various utility files (state-machine.js, error-manager.js, etc.)
- `/dist/` - Build outputs
  - `/dev/` - Development builds
  - `/production/` - Production builds
- `/docs/` - Documentation
- `/tests/` - Test files

## State Management

### State Machine

The plugin uses a state machine pattern to manage UI states and transitions.

**Key Files:**
- `plugin/state-machine.js` - Core state machine implementation
- `plugin/plugin-states.js` - Plugin-specific state definitions

**States:**
- `idle` - Default state when no operations are happening
- `loading` - Loading components from Figma
- `componentSelection` - User is selecting components
- `filtering` - Filtering component list
- `error` - Error state when something goes wrong
- `saving` - Saving data to storage

**Usage:**
```javascript
// Initialize state machine
const stateMachine = new StateMachine({
  states: {
    idle: { 
      enter: () => { /* Code to run when entering idle state */ }
    }
  },
  transitions: {
    idle: ['loading', 'error']
  },
  initialState: 'idle'
});

// Transition to a new state
stateMachine.transition('loading', { /* optional data */ });
```

### Storage Manager

Handles all persistent data storage for the plugin.

**Key Files:**
- `plugin/code.js` - Contains the StorageManager class
- `plugin/storage-error-integration.js` - Error handling for storage operations

**Features:**
- Caching for better performance
- Flattened data structure for simpler data access
- Error handling with retry mechanism
- Migration between data formats

**Usage:**
```javascript
// Get data
const data = await storageManager.get('key', defaultValue);

// Set data
await storageManager.set('key', value);

// Work with component data
const score = storageManager.calculateComponentScore(componentId, rules);
```

## Error Handling

A centralized error handling system ensures consistent error reporting and user feedback.

**Key Files:**
- `plugin/error-manager.js` - Core error handling
- `plugin/notification-manager.js` - User notifications

**Error Categories:**
- `STORAGE` - Storage-related errors
- `COMPONENT` - Component-related errors
- `PLUGIN` - Plugin lifecycle errors
- `UI` - UI-related errors
- `NETWORK` - Network request errors

**Severity Levels:**
- `CRITICAL` - Application can't continue
- `ERROR` - Feature is broken
- `WARNING` - Can continue with caution
- `INFO` - Informational only

**Usage:**
```javascript
// Report an error
errorManager.report(
  error,             // Error object or message
  'STORAGE',         // Category
  'ERROR',           // Severity
  { key: 'value' }   // Context object
);

// Try/catch with error reporting
try {
  // Risky operation
} catch (error) {
  errorManager.report(error, 'COMPONENT', 'ERROR', { componentId });
}
```

## Testing Framework

The plugin includes a built-in testing framework for automated testing.

**Key Files:**
- `plugin/test-framework.js` - Core testing utilities
- `plugin/test-ui.js` - Test UI implementation
- `plugin/tests/*.js` - Test suites
- `test-runner.js` - Headless test runner script

**Test Types:**
- Storage tests
- Error handling tests
- Data migration tests

**Running Tests:**
- **In-plugin:** Click "Run Tests" in the debug panel
- **Automated:** Run `npm test` from the command line

**Writing Tests:**
```javascript
// Creating a test suite
const myTests = {
  name: 'My Test Suite',
  
  setup(runner) {
    // Before all tests
    runner.beforeAll(() => {
      // Setup code
    });
    
    // Test case
    runner.test('should do something', () => {
      const result = doSomething();
      assert.isTrue(result, 'Expected true result');
    });
    
    // Skip a test
    runner.skip('not implemented yet', () => {
      // Test code
    });
  }
};
```

## Build System

The build system automates development, testing, and deployment tasks.

**Key Files:**
- `build-config.js` - Build configuration
- `build.js` - Build script
- `package.json` - npm scripts
- `test-runner.js` - Test automation script

**Build Modes:**
- **Development:**
  - Source maps enabled
  - No minification
  - Includes test files
  - Watch mode available
- **Production:**
  - Minified code
  - No source maps
  - No test files
  - JS bundling for performance

**npm Scripts:**
- `npm run dev` - Development build with watch mode
- `npm run build` - Development build
- `npm run build:prod` - Production build
- `npm run test` - Run automated tests
- `npm run deploy` - Build and deploy to Figma (requires path configuration)

## Development Workflow

### Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Start development mode:
   ```
   npm run dev
   ```

3. Make changes to source files

4. Test your changes:
   - Manual testing in Figma
   - Use the debug panel (click "Debug" in plugin footer)
   - Run automated tests with `npm test`

5. Build for production:
   ```
   npm run build:prod
   ```

### Debug Panel

The debug panel provides tools for debugging and testing:

- Access by clicking "Debug" in the plugin footer
- View current state and state history
- Toggle flattened data structure
- Run automated tests
- View build info

### Best Practices

1. **State Management:**
   - Use the state machine for UI state changes
   - Keep state transitions predictable
   - Document new states and transitions

2. **Error Handling:**
   - Always use the error manager for error reporting
   - Include context with errors for better debugging
   - Match error severity to the impact on users

3. **Testing:**
   - Write tests for new functionality
   - Test both success and failure cases
   - Use mocks for Figma API dependencies

4. **Build System:**
   - Use development mode during development
   - Test production builds before releasing
   - Don't edit files in the `dist/` directory directly

## Troubleshooting

### Common Issues

1. **Figma API Changes:**
   - Check the [Figma Plugin API documentation](https://www.figma.com/plugin-docs/)
   - Look for breaking changes in recent updates

2. **Build Errors:**
   - Ensure dependencies are installed (`npm install`)
   - Check syntax errors in source files
   - Verify build-config.js has the correct file paths

3. **Test Failures:**
   - Check test-logs.json for detailed error information
   - Verify that mocks correctly simulate Figma's behavior
   - Ensure tests are isolated from each other

## References

- [Figma Plugin API](https://www.figma.com/plugin-docs/)
- [State Machine Pattern](https://www.smashingmagazine.com/2018/01/rise-state-machines/)
- [Jest Testing](https://jestjs.io/docs/getting-started) (similar concepts to our custom test framework)
