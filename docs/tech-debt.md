# State Management
 - Complete migration of all state to the state manager
 - Add proper undo/redo functionality
 - Improve performance for large component libraries
# Data Structure/data model/data layer
 - Add more advanced querying capabilities (e.g., by status, by category)
 - Cache intermediate results more aggressively
 - Implement more efficient querying patterns
 - Create a unified API for data access
 - Create a proper data model for components and their states
 - Implement proper caching for better performance
# Event-Driven Architecture
 - Use a message-based approach where each operation is separate and independent
 - Implement a state machine pattern for managing plugin workflow
 - Allow the UI to function independently of data loading
# UI Improvements
 - Cache DOM queries for frequently accessed elements
 - Implement virtualized lists for handling large component libraries
 - Optimize rendering by only updating changed components
 - Use event delegation for checkbox interactions instead of individual event listeners
# Code deduplication
 - Storage class exists in both code.js and storage.js
 - Exports in storage.js need to be properly utilized or removed
# QA
 - Need proper unit tests for score calculations
 - Need integration tests for state synchronization
 - Implement automated tests for the state manager
# Bugs
 - Deleting items in Figma should delete them from the list but doesn't
 - Some items are a bit spaced out and could look a bit more Figma-ish
 - Selection and hover colors are incorrect
 - When you draw a frame over 2 or more components, the frame subsumes them. In this situation the frame is selected. Our rules say that in this type of situation, the component list should update according to out rules about selections.
 - Danny’s learning
  - build
  - text
# Undone work
- make sure components deleted in figma are deleted in our list too, this should happen in realtime, maybe by implementing a message handler, this will ensure that the component list stays in sync with the actual Figma document
- make sure the toggle icon shows and hides the criteria
- completely removed the download data functionality (JSON and CSV export)
- change the main text color from #333 to #18191A
- Remove outdated references to storage.js from tech debt