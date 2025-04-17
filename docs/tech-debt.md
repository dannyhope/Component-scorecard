
# Technical Debt

## Status Key
🟢 Fixed
🟡 In Progress
🔴 To Do

## Document and Memory Structure Issues

### Component State Management 🔴
- Component states are managed in multiple places leading to potential sync issues:
  - `checkboxStates` in both UI and plugin code
  - Component scores calculated in plugin but stored in UI's `allComponents`
  - No single source of truth for component state

### Data Persistence 🟢
- ~~Using Figma's client storage directly without abstraction~~ Fixed: Created Storage class for abstraction
- ~~State management is tightly coupled to Figma's storage API~~ Fixed: Storage operations now go through abstraction layer
- ~~No clear separation between persistence layer and application logic~~ Fixed: Clear separation with Storage class
- Added caching to reduce storage operations
- Simplified async/await usage throughout the codebase

### Memory Structure 🔴
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

### Component Score Calculation 🟢
- ~~Score calculation is split between plugin and UI~~ Fixed: Consolidated in `calculateComponentScore`
- ~~No clear ownership of score calculation logic~~ Fixed: Plugin code now owns score calculation
- ~~Updates require coordination between multiple parts of the codebase~~ Fixed: Single source of truth in plugin

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
