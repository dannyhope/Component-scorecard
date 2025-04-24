## Status Key
🟢 easy
🟡 medium
🔴 hard

## Architecture

### Structural Complexity
- Syntax errors in complex nested function blocks are difficult to debug

### Component State Management
- Component states are managed in multiple places leading to potential sync issues:
  - `checkboxStates` in both UI and plugin code
  - Component scores calculated in plugin but stored in UI's `allComponents`
  - No single source of truth for component state

#### Memory Structure
- Checkbox states are stored in a nested object structure that's hard to maintain:
  ```javascript
  checkboxStates = {
    componentId: {
      category: {
        ruleText: {
          checked: boolean,
          timestamp: string
        }
      }
    }
  }
  ```
- This structure makes it difficult to:
  - Query all checked items
  - Track state changes
  - Implement undo/redo
  - Add new metadata to checkboxes





## UI Simplification (April 2025)
- The following UI elements have been completely removed to simplify the codebase:
  - Score count (e.g., (1/5)) next to each component name
  - Instance count (e.g., "2 instances") next to each component name
  - Instance selection functionality

This simplification makes the UI cleaner and the codebase smaller and easier to maintain.








## 🔴 Requires Build Process to be Setup

### UI Modernization

#### UI Code Organization
- All UI code is in a single HTML file with embedded JavaScript
- No separation of concerns between UI components
- Large, monolithic functions like `buildComponentList` with excessive nesting
- Direct DOM manipulation instead of using a template system

#### Frontend Performance
- Inefficient component filtering that rebuilds the entire list on each keystroke
- Repeated DOM queries that could be cached
- Potential performance issues when handling large component libraries
- Missing throttling/debouncing for some UI interactions

#### Code Duplication
- Storage class exists in both code.js and storage.js
- Redundant code for managing component state 
- Exports in storage.js aren't being used


## Architecture

### Event-Driven Architecture
- Use a message-based approach where each operation is separate and independent
- Implement a state machine pattern for managing plugin workflow
- Allow the UI to function independently of data loading

### Simplified Data Model
- Flatten dependency relationships to avoid deep traversals
- Cache intermediate results aggressively
- Use simpler data structures (arrays instead of nested maps)

### Build Features
- Add build/version number in UI (mentioned in ideas.md)

### Progressive Loading Pattern
- Show UI immediately with placeholder content

### Robust Error Handling
- Add automatic retry logic with backoff

## Implementation Strategy

### Incremental Approach
- Start with a minimalist core that displays basic component information
- Add features incrementally, testing thoroughly after each addition
- Implement a debug mode that provides visibility into internal operations
- Use a modular design where components can be tested in isolation

## Suggested Improvements

1. **State Management**
   - Implement a proper state management system
   - Create a single source of truth for component states
   - Add proper state update events/hooks

2. **Data Layer**
   - Abstract storage operations behind a data access layer
   - Create a proper data model for components and their states
   - Implement proper caching and state synchronization

3. **Component Architecture**
   - Separate UI components from state management
   - Create clear boundaries between plugin and UI code
   - Implement proper event handling for state updates

4. **Testing**
   - Current structure makes it difficult to test state changes
   - Need proper unit tests for score calculations
   - Need integration tests for state synchronization