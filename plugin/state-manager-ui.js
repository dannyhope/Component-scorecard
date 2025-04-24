/**
 * UI Integration for State Manager
 * 
 * This module provides UI-specific functionality for integrating with the state manager.
 * It handles subscribing to state changes and updating the UI accordingly.
 */

// We'll use this as a module that will be imported in the UI
const stateManagerUI = {
  // Reference to the parent plugin (will be set during initialization)
  parent: null,
  
  // Cache for DOM elements to avoid repeated queries
  domCache: {},
  
  /**
   * Initialize the UI integration
   * @param {Object} parent - The parent window object
   */
  initialize(parent) {
    this.parent = parent;
    console.log('StateManagerUI initialized');
    
    // Send ready message to plugin
    this.sendMessage({
      type: 'uiReady'
    });
  },
  
  /**
   * Send a message to the plugin
   * @param {Object} message - The message to send
   */
  sendMessage(message) {
    if (!this.parent) {
      console.error('StateManagerUI not initialized');
      return;
    }
    
    this.parent.postMessage({ pluginMessage: message }, '*');
  },
  
  /**
   * Handle incoming messages from the plugin
   * @param {Object} message - The message from the plugin
   */
  handleMessage(message) {
    console.log(`Handling message of type: ${message.type}`);
    
    switch (message.type) {
      case 'componentsLoaded':
        this.handleComponentsLoaded(message.components);
        break;
      case 'checkboxStatesLoaded':
        this.handleCheckboxStatesLoaded(message.checkboxStates);
        break;
      case 'scoreUpdated':
        this.handleScoreUpdated(message.componentId, message.checkedCount, message.totalRules);
        break;
      case 'filtersUpdated':
        this.handleFiltersUpdated(message.filters);
        break;
      // Add more message handlers as needed
    }
  },
  
  /**
   * Handle components loaded message
   * @param {Array} components - The loaded components
   */
  handleComponentsLoaded(components) {
    // Store components in local state
    window.allComponents = components;
    
    // Build component list
    this.buildComponentList(components);
    
    // Update component count
    this.updateComponentCount();
    
    console.log(`Loaded ${components.length} components`);
  },
  
  /**
   * Handle checkbox states loaded message
   * @param {Object} checkboxStates - The loaded checkbox states
   */
  handleCheckboxStatesLoaded(checkboxStates) {
    // Store checkbox states in local state
    window.checkboxStates = checkboxStates;
    
    // Update checkboxes in the UI
    this.updateCheckboxes(checkboxStates);
    
    console.log('Checkbox states loaded');
  },
  
  /**
   * Handle score updated message
   * @param {string} componentId - The component ID
   * @param {number} checkedCount - The number of checked items
   * @param {number} totalRules - The total number of rules
   */
  handleScoreUpdated(componentId, checkedCount, totalRules) {
    // Update component score in local state
    const component = window.allComponents.find(c => c.id === componentId);
    if (component) {
      component.checkedCount = checkedCount;
      component.totalCategories = totalRules;
      
      // Update score in UI
      this.updateScore(componentId, checkedCount);
      
      // Refresh the component count
      this.updateComponentCount();
    }
  },
  
  /**
   * Handle filters updated message
   * @param {Object} filters - The updated filters
   */
  handleFiltersUpdated(filters) {
    // Update filters in local state
    window.filters = { ...window.filters, ...filters };
    
    // Update UI to reflect filters
    this.applyFilters();
  },
  
  /**
   * Set checkbox state
   * @param {string} componentId - The component ID
   * @param {string} category - The category
   * @param {string} ruleText - The rule text
   * @param {boolean} checked - Whether the checkbox is checked
   */
  setCheckboxState(componentId, category, ruleText, checked) {
    // Send message to plugin
    this.sendMessage({
      type: 'setCheckboxState',
      componentId,
      category,
      ruleText,
      checked
    });
    
    // Update local state immediately for responsive UI
    if (!window.checkboxStates[componentId]) {
      window.checkboxStates[componentId] = {};
    }
    
    if (!window.checkboxStates[componentId][category]) {
      window.checkboxStates[componentId][category] = {};
    }
    
    window.checkboxStates[componentId][category][ruleText] = {
      checked,
      timestamp: new Date().toISOString()
    };
  },
  
  /**
   * Set filter
   * @param {string} filterName - The filter name
   * @param {any} value - The filter value
   */
  setFilter(filterName, value) {
    // Send message to plugin
    this.sendMessage({
      type: 'setFilter',
      filterName,
      value
    });
    
    // Update local state immediately for responsive UI
    window.filters[filterName] = value;
    
    // Apply filters
    this.applyFilters();
  },
  
  /**
   * Select a component
   * @param {string} componentId - The component ID
   * @param {boolean} fromFigma - Whether the selection is from Figma
   */
  selectComponent(componentId, fromFigma = false) {
    // Update UI selection
    this.updateSelection(componentId);
    
    // Only send message to Figma if not already from Figma
    if (!fromFigma) {
      this.sendMessage({
        type: 'selectComponent',
        componentId
      });
    }
  },
  
  /**
   * Build component list
   * @param {Array} components - The components to build
   */
  buildComponentList(components) {
    // Implementation will be integrated with existing UI code
    console.log('Building component list');
    
    // This function will be implemented in the UI HTML
    if (window.buildComponentList) {
      window.buildComponentList(components);
    }
  },
  
  /**
   * Update checkboxes in the UI
   * @param {Object} checkboxStates - The checkbox states
   */
  updateCheckboxes(checkboxStates) {
    // Implementation will be integrated with existing UI code
    console.log('Updating checkboxes');
    
    // This function will be implemented in the UI HTML
    if (window.updateCheckboxes) {
      window.updateCheckboxes(checkboxStates);
    }
  },
  
  /**
   * Update score in the UI
   * @param {string} componentId - The component ID
   * @param {number} checkedCount - The number of checked items
   */
  updateScore(componentId, checkedCount) {
    // Implementation will be integrated with existing UI code
    console.log(`Updating score for ${componentId}`);
    
    // This function will be implemented in the UI HTML
    if (window.updateScore) {
      window.updateScore(componentId, checkedCount);
    }
  },
  
  /**
   * Update component count in the UI
   */
  updateComponentCount() {
    // Implementation will be integrated with existing UI code
    console.log('Updating component count');
    
    // This function will be implemented in the UI HTML
    if (window.updateComponentCount) {
      window.updateComponentCount();
    }
  },
  
  /**
   * Apply filters to components
   */
  applyFilters() {
    // Implementation will be integrated with existing UI code
    console.log('Applying filters');
    
    // This function will be implemented in the UI HTML
    if (window.applyFilters) {
      window.applyFilters();
    }
  },
  
  /**
   * Update selection in the UI
   * @param {string} componentId - The component ID
   */
  updateSelection(componentId) {
    // Implementation will be integrated with existing UI code
    console.log(`Updating selection to ${componentId}`);
    
    // This function will be implemented in the UI HTML
    if (window.updateSelection) {
      window.updateSelection(componentId);
    }
  }
};

// Export the module
export default stateManagerUI;
