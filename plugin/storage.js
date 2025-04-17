// Storage abstraction layer for Component Scorecard

class Storage {
  constructor() {
    this.cache = {
      checkboxStates: null,
      modifiedDates: null
    };
  }

  // Initialize storage with default values if empty
  async init() {
    const [checkboxStates, modifiedDates] = await Promise.all([
      figma.clientStorage.getAsync('checkboxStates'),
      figma.clientStorage.getAsync('modifiedDates')
    ]);

    this.cache.checkboxStates = checkboxStates || {};
    this.cache.modifiedDates = modifiedDates || {};
  }

  // Get checkbox states for a component
  async getComponentState(componentId) {
    if (!this.cache.checkboxStates) await this.init();
    return this.cache.checkboxStates[componentId] || {};
  }

  // Get all checkbox states
  async getAllComponentStates() {
    if (!this.cache.checkboxStates) await this.init();
    return this.cache.checkboxStates;
  }

  // Update a single checkbox state
  async updateCheckboxState(componentId, category, rule, state) {
    if (!this.cache.checkboxStates) await this.init();
    
    // Initialize nested structure if needed
    if (!this.cache.checkboxStates[componentId]) {
      this.cache.checkboxStates[componentId] = {};
    }
    if (!this.cache.checkboxStates[componentId][category]) {
      this.cache.checkboxStates[componentId][category] = {};
    }

    // Update state
    this.cache.checkboxStates[componentId][category][rule] = state;
    
    // Save to storage
    await this.persist();
    
    return this.cache.checkboxStates[componentId];
  }

  // Update multiple checkbox states at once (for "apply to all" feature)
  async updateMultipleCheckboxStates(updates) {
    if (!this.cache.checkboxStates) await this.init();
    
    for (const {componentId, category, rule, state} of updates) {
      if (!this.cache.checkboxStates[componentId]) {
        this.cache.checkboxStates[componentId] = {};
      }
      if (!this.cache.checkboxStates[componentId][category]) {
        this.cache.checkboxStates[componentId][category] = {};
      }
      this.cache.checkboxStates[componentId][category][rule] = state;
    }
    
    await this.persist();
  }

  // Get modification date for a component
  async getModifiedDate(componentId) {
    if (!this.cache.modifiedDates) await this.init();
    return this.cache.modifiedDates[componentId];
  }

  // Update modification date for a component
  async updateModifiedDate(componentId, date) {
    if (!this.cache.modifiedDates) await this.init();
    this.cache.modifiedDates[componentId] = date;
    await this.persist();
  }

  // Clear all data (useful for reset/debug)
  async clear() {
    this.cache.checkboxStates = {};
    this.cache.modifiedDates = {};
    await this.persist();
  }

  // Persist all changes to Figma storage
  async persist() {
    await Promise.all([
      figma.clientStorage.setAsync('checkboxStates', this.cache.checkboxStates),
      figma.clientStorage.setAsync('modifiedDates', this.cache.modifiedDates)
    ]);
  }
}

// Export a singleton instance
export const storage = new Storage();
