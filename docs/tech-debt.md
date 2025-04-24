# Component Scorecard Plugin - Technical Debt

## Status Key
🟢 Fixed
🟡 In Progress
🔴 To Do
🔴🔴 Requires Build Process

### Architecture and Performance

#### 🔴 Structural Complexity
- Syntax errors in complex nested function blocks are difficult to debug

#### 🔴 Component State Management
- Component states are managed in multiple places leading to potential sync issues:
  - `checkboxStates` in both UI and plugin code
  - Component scores calculated in plugin but stored in UI's `allComponents`
  - No single source of truth for component state

#### 🔴 Memory Structure
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

### UI and Codebase Structure

#### Component Detection Issues (April 2025)
- The plugin doesn't reliably detect newly created components automatically:
  - The `documentchange` event doesn't consistently trigger for new component creation
  - We've tried using `findAllWithCriteria()` instead of `findAll()` but it's still unreliable
  - Added polling as a fallback, but it's not a perfect solution

**Current workaround:** Added a manual refresh button that users can click after creating new components. This sends a direct message to the plugin to refresh the component list.

#### 🟡 Temporary UI Hiding (April 2025)
- The following UI elements are currently hidden via CSS for interface simplification/testing:
  - The score count (e.g., (1/5)) next to each component name
  - The number of instances (e.g., "2 instances") next to each component name

This is done by setting `display: none` on the relevant CSS classes in `plugin/ui.html`. These changes are non-destructive and can be easily reverted by removing or commenting out the CSS rules.








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

### Architecture Improvements

#### Event-Driven Architecture
- Use a message-based approach where each operation is separate and independent
- Implement a state machine pattern for managing plugin workflow
- Allow the UI to function independently of data loading

#### Simplified Data Model
- Flatten dependency relationships to avoid deep traversals
- Cache intermediate results aggressively
- Use simpler data structures (arrays instead of nested maps)

#### Build Features
- Add build/version number in UI (mentioned in ideas.md)






## Pending Architecture Improvements

### 🟡 Progressive Loading Pattern
- 🔴 Show UI immediately with placeholder content

### 🟡 Robust Error Handling
- 🔴 Add automatic retry logic with backoff

## Implementation Strategy

### 🟡 Incremental Approach
- 🟡 Start with a minimalist core that displays basic component information
- 🟡 Add features incrementally, testing thoroughly after each addition
- 🔴 Implement a debug mode that provides visibility into internal operations
- 🔴 Use a modular design where components can be tested in isolation

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

## Completed Improvements

### Architecture and Performance

#### ✅ Structural Complexity
- ✅ Complex nested functions and recursive patterns → Flattened code structure and reduced nesting
- ✅ Deep call stacks for dependency tracking causing stack overflows → Replaced with iterative approaches

#### ✅ Performance Bottlenecks
- ✅ Recursive document traversal doesn't scale with large Figma files → Replaced with queue-based iteration
- ✅ Dependency tracking algorithm tries to do too much in a single pass → Implemented chunked processing
- ✅ No effective timeout mechanisms to prevent hanging → Added timeouts with graceful fallbacks

#### ✅ Error Handling
- ✅ Many operations lack proper try/catch blocks → Added comprehensive error handling
- ✅ No graceful fallbacks when primary approaches fail → Implemented fallback mechanisms
- ✅ UI gets stuck waiting for plugin responses that never come → Added timeout protection

#### ✅ Non-Recursive Algorithms
- ✅ Replace all recursive traversals with queue/stack-based iterations → Implemented queue-based traversal
- ✅ Set hard limits on processing depth and breadth → Added depth limits to prevent infinite loops
- ✅ Use timeouts and chunking for long operations → Implemented timeouts and chunked processing

#### ✅ Progressive Loading Pattern
- ✅ Load components in small batches with clear progress indicators → Implemented chunked loading with progress reporting
- ✅ Process one page at a time, updating the UI after each page → Implemented page-by-page processing

#### ✅ Robust Error Handling
- ✅ Implement error boundaries around each major function → Added try/catch blocks throughout
- ✅ Store partial results to avoid losing progress → Implemented partial result handling

#### ✅ Implementation Strategy
- ✅ Add comprehensive logging that can be enabled to trace issues → Added detailed logging throughout

### Code Organization and Cleanliness

#### ✅ Unused Code and Files
- ✅ Unused `getComponentUsage` function in code.js → Removed unused function
- ✅ Unused `event-bus.js` file that wasn't imported anywhere → Removed unused file
- ✅ Redundant `ui-message-handler.js` file with functionality duplicated in ui.html → Removed redundant file
- ✅ Various unused variables throughout the codebase → Removed unused variables

### Document and Memory Structure

#### ✅ Data Persistence
- ✅ Using Figma's client storage directly without abstraction → Created Storage class for abstraction
- ✅ State management is tightly coupled to Figma's storage API → Storage operations now go through abstraction layer
- ✅ No clear separation between persistence layer and application logic → Clear separation with Storage class
- ✅ Added caching to reduce storage operations
- ✅ Simplified async/await usage throughout the codebase

#### ✅ Component Score Calculation
- ✅ Score calculation is split between plugin and UI → Consolidated in `calculateComponentScore`
- ✅ No clear ownership of score calculation logic → Plugin code now owns score calculation
- ✅ Updates require coordination between multiple parts of the codebase → Single source of truth in plugin
