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

# QA
 - Need proper unit tests for score calculations
 - Need integration tests for state synchronization
 - Implement automated tests for the state manager

# Bugs
 - Danny’s learning
  - build
  - test
  - mcp service

# Undone work
- make sure components deleted in figma are deleted in our list too, this should happen in realtime, maybe by implementing a message handler, this will ensure that the component list stays in sync with the actual Figma document

# Persistent bugs
- Deleting items in Figma should delete them from the list but doesn't