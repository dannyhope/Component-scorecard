/**
 * State Manager for Component Scorecard
 * 
 * This module provides a centralized state management system for the Component Scorecard plugin.
 * It creates a single source of truth for component states and provides a consistent API
 * for reading and writing state data.
 */

class StateManager {
  constructor() {
    // Private state storage
    this._state = {
      components: new Map(),
      checkboxStates: {},
      filters: {
        search: '',
        showChecked: true,
        showUnchecked: true,
        selectedComponentIds: []
      },
      ui: {
        loading: false,
        notifications: []
      }
    };

    // Event listeners
    this._listeners = {
      components: new Set(),
      checkboxes: new Set(),
      filters: new Set(),
      ui: new Set(),
      all: new Set()
    };

    // Storage manager reference (will be set during initialization)
    this._storage = null;
  }

  /**
   * Initialize the state manager with the storage manager
   * @param {Object} storageManager - The storage manager instance
   */
  initialize(storageManager) {
    this._storage = storageManager;
    console.log('StateManager initialized with storage manager');
  }

  /**
   * Load initial state from storage
   * @returns {Promise<void>}
   */
  async loadInitialState() {
    if (!this._storage) {
      throw new Error('StateManager not initialized with storage manager');
    }

    try {
      // Load checkbox states from storage
      const checkboxStates = await this._storage.getStorageWithFallback('checkboxStates', {});
      this._state.checkboxStates = checkboxStates;
      
      // Notify listeners
      this._notifyListeners('checkboxes');
      console.log('Initial state loaded from storage');
    } catch (error) {
      console.error('Error loading initial state:', error);
      throw error;
    }
  }

  /**
   * Get components state
   * @returns {Map} The components map
   */
  getComponents() {
    return new Map(this._state.components);
  }

  /**
   * Set components state
   * @param {Array|Map} components - The components to set
   */
  setComponents(components) {
    if (Array.isArray(components)) {
      // Convert array to Map for O(1) lookups
      const componentsMap = new Map();
      components.forEach(component => {
        componentsMap.set(component.id, component);
      });
      this._state.components = componentsMap;
    } else if (components instanceof Map) {
      this._state.components = new Map(components);
    } else {
      throw new Error('Components must be an array or Map');
    }
    
    this._notifyListeners('components');
  }

  /**
   * Get a component by ID
   * @param {string} componentId - The component ID
   * @returns {Object|undefined} The component or undefined if not found
   */
  getComponent(componentId) {
    return this._state.components.get(componentId);
  }

  /**
   * Update a component
   * @param {string} componentId - The component ID
   * @param {Object} updates - The updates to apply
   */
  updateComponent(componentId, updates) {
    const component = this._state.components.get(componentId);
    if (!component) {
      console.warn(`Component ${componentId} not found`);
      return;
    }

    this._state.components.set(componentId, { ...component, ...updates });
    this._notifyListeners('components');
  }

  /**
   * Get checkbox states
   * @returns {Object} The checkbox states
   */
  getCheckboxStates() {
    return { ...this._state.checkboxStates };
  }

  /**
   * Get checkbox state for a specific component, category, and rule
   * @param {string} componentId - The component ID
   * @param {string} category - The category
   * @param {string} ruleText - The rule text
   * @returns {Object|undefined} The checkbox state or undefined if not found
   */
  getCheckboxState(componentId, category, ruleText) {
    if (!this._state.checkboxStates[componentId]) return undefined;
    if (!this._state.checkboxStates[componentId][category]) return undefined;
    return this._state.checkboxStates[componentId][category][ruleText];
  }

  /**
   * Set checkbox state
   * @param {string} componentId - The component ID
   * @param {string} category - The category
   * @param {string} ruleText - The rule text
   * @param {boolean} checked - Whether the checkbox is checked
   * @returns {Promise<void>}
   */
  async setCheckboxState(componentId, category, ruleText, checked) {
    // Create nested structure if it doesn't exist
    if (!this._state.checkboxStates[componentId]) {
      this._state.checkboxStates[componentId] = {};
    }
    
    if (!this._state.checkboxStates[componentId][category]) {
      this._state.checkboxStates[componentId][category] = {};
    }

    // Update state with timestamp
    const timestamp = checked ? new Date().toISOString() : null;
    this._state.checkboxStates[componentId][category][ruleText] = {
      checked,
      timestamp
    };

    // Notify listeners before storage operation
    this._notifyListeners('checkboxes');

    // Persist to storage
    if (this._storage) {
      try {
        await this._storage.set('checkboxStates', this._state.checkboxStates);
      } catch (error) {
        console.error('Error saving checkbox state:', error);
        throw error;
      }
    }
  }

  /**
   * Get filters
   * @returns {Object} The filters
   */
  getFilters() {
    return { ...this._state.filters };
  }

  /**
   * Set filters
   * @param {Object} filters - The filters to set
   */
  setFilters(filters) {
    this._state.filters = { ...this._state.filters, ...filters };
    this._notifyListeners('filters');
  }

  /**
   * Get UI state
   * @returns {Object} The UI state
   */
  getUIState() {
    return { ...this._state.ui };
  }

  /**
   * Set UI state
   * @param {Object} uiState - The UI state to set
   */
  setUIState(uiState) {
    this._state.ui = { ...this._state.ui, ...uiState };
    this._notifyListeners('ui');
  }

  /**
   * Calculate component score
   * @param {string} componentId - The component ID
   * @returns {Object} The score information { checked, total, percentage }
   */
  calculateComponentScore(componentId) {
    const componentState = this._state.checkboxStates[componentId];
    if (!componentState) {
      return { checked: 0, total: 0, percentage: 0 };
    }

    let checked = 0;
    let total = 0;

    // Count checked and total checkboxes
    Object.values(componentState).forEach(category => {
      Object.values(category).forEach(rule => {
        total++;
        if (rule.checked) {
          checked++;
        }
      });
    });

    const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { checked, total, percentage };
  }

  /**
   * Subscribe to state changes
   * @param {string} type - The type of state to subscribe to ('components', 'checkboxes', 'filters', 'ui', 'all')
   * @param {Function} listener - The listener function
   * @returns {Function} Unsubscribe function
   */
  subscribe(type, listener) {
    if (!this._listeners[type]) {
      throw new Error(`Invalid subscription type: ${type}`);
    }

    this._listeners[type].add(listener);

    // Return unsubscribe function
    return () => {
      this._listeners[type].delete(listener);
    };
  }

  /**
   * Notify listeners of state changes
   * @param {string} type - The type of state that changed
   * @private
   */
  _notifyListeners(type) {
    // Notify specific listeners
    if (this._listeners[type]) {
      this._listeners[type].forEach(listener => {
        try {
          listener(this._getStateForType(type));
        } catch (error) {
          console.error(`Error in ${type} listener:`, error);
        }
      });
    }

    // Notify 'all' listeners
    this._listeners.all.forEach(listener => {
      try {
        listener({
          components: this.getComponents(),
          checkboxStates: this.getCheckboxStates(),
          filters: this.getFilters(),
          ui: this.getUIState()
        });
      } catch (error) {
        console.error('Error in global listener:', error);
      }
    });
  }

  /**
   * Get state for a specific type
   * @param {string} type - The type of state
   * @returns {*} The state for the specified type
   * @private
   */
  _getStateForType(type) {
    switch (type) {
      case 'components':
        return this.getComponents();
      case 'checkboxes':
        return this.getCheckboxStates();
      case 'filters':
        return this.getFilters();
      case 'ui':
        return this.getUIState();
      default:
        return null;
    }
  }
}

// Create and export a singleton instance
const stateManager = new StateManager();
export default stateManager;
