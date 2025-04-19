// Storage abstraction layer for Component Scorecard

class Storage {
  constructor() {
    this.cache = {
      // Flattened structure with composite keys for easier querying
      // Format: { "componentId:category:rule": { checked: boolean, timestamp: string } }
      checkboxItems: null,
      
      // Component metadata with last modified dates
      componentMeta: null,
      
      // Map to track categories and rules for each component
      // Format: { componentId: { categories: Set<string>, rules: Set<string> } }
      componentStructure: null
    };
  }

  // Create a composite key for checkbox items
  _createKey(componentId, category, rule) {
    return `${componentId}:${category}:${rule}`;
  }
  
  // Parse a composite key into its parts
  _parseKey(key) {
    const [componentId, category, rule] = key.split(':');
    return { componentId, category, rule };
  }

  // Initialize storage with default values if empty
  async init() {
    // Try to load the new format first
    const [checkboxItems, componentMeta, componentStructure] = await Promise.all([
      figma.clientStorage.getAsync('checkboxItems'),
      figma.clientStorage.getAsync('componentMeta'),
      figma.clientStorage.getAsync('componentStructure')
    ]);
    
    // If new format exists, use it
    if (checkboxItems) {
      this.cache.checkboxItems = checkboxItems;
      this.cache.componentMeta = componentMeta || {};
      this.cache.componentStructure = componentStructure || {};
      return;
    }
    
    // Otherwise, try to migrate from old format
    const [oldCheckboxStates, oldModifiedDates] = await Promise.all([
      figma.clientStorage.getAsync('checkboxStates'),
      figma.clientStorage.getAsync('modifiedDates')
    ]);
    
    // Initialize with empty objects if nothing exists
    this.cache.checkboxItems = {};
    this.cache.componentMeta = {};
    this.cache.componentStructure = {};
    
    // Migrate data if old format exists
    if (oldCheckboxStates) {
      // Migrate checkboxStates to the new format
      for (const componentId in oldCheckboxStates) {
        if (!this.cache.componentStructure[componentId]) {
          this.cache.componentStructure[componentId] = { categories: new Set(), rules: new Set() };
        }
        
        for (const category in oldCheckboxStates[componentId]) {
          this.cache.componentStructure[componentId].categories.add(category);
          
          for (const rule in oldCheckboxStates[componentId][category]) {
            const state = oldCheckboxStates[componentId][category][rule];
            const key = this._createKey(componentId, category, rule);
            this.cache.checkboxItems[key] = state;
            this.cache.componentStructure[componentId].rules.add(rule);
          }
        }
      }
      
      // Migrate modified dates
      if (oldModifiedDates) {
        for (const componentId in oldModifiedDates) {
          if (!this.cache.componentMeta[componentId]) {
            this.cache.componentMeta[componentId] = {};
          }
          this.cache.componentMeta[componentId].lastModified = oldModifiedDates[componentId];
        }
      }
      
      // Save the migrated data
      await this.persist();
      
      // Clean up old format data
      await Promise.all([
        figma.clientStorage.setAsync('checkboxStates', null),
        figma.clientStorage.setAsync('modifiedDates', null)
      ]);
    }
  }

  // Get checkbox states for a component, reconstructed into the old format for compatibility
  async getComponentState(componentId) {
    if (!this.cache.checkboxItems) await this.init();
    
    // Reconstruct the old format for backward compatibility
    const result = {};
    
    // Get all keys for this component
    const keys = Object.keys(this.cache.checkboxItems)
      .filter(key => key.startsWith(`${componentId}:`));
    
    // Reconstruct the nested structure
    for (const key of keys) {
      const { category, rule } = this._parseKey(key);
      if (!result[category]) {
        result[category] = {};
      }
      result[category][rule] = this.cache.checkboxItems[key];
    }
    
    return result;
  }

  // Get all checkbox states reconstructed into old format for compatibility
  async getAllComponentStates() {
    if (!this.cache.checkboxItems) await this.init();
    
    // Group all checkbox items by component
    const components = {};
    
    for (const key in this.cache.checkboxItems) {
      const { componentId, category, rule } = this._parseKey(key);
      
      if (!components[componentId]) {
        components[componentId] = {};
      }
      
      if (!components[componentId][category]) {
        components[componentId][category] = {};
      }
      
      components[componentId][category][rule] = this.cache.checkboxItems[key];
    }
    
    return components;
  }

  // Update a single checkbox state
  async updateCheckboxState(componentId, category, rule, state) {
    if (!this.cache.checkboxItems) await this.init();
    
    // Create the composite key
    const key = this._createKey(componentId, category, rule);
    
    // Update the checkbox state
    this.cache.checkboxItems[key] = state;
    
    // Update component structure tracking
    if (!this.cache.componentStructure[componentId]) {
      this.cache.componentStructure[componentId] = { categories: new Set(), rules: new Set() };
    }
    this.cache.componentStructure[componentId].categories.add(category);
    this.cache.componentStructure[componentId].rules.add(rule);
    
    // Save to storage
    await this.persist();
    
    // Return all states for this component in the old format for compatibility
    return await this.getComponentState(componentId);
  }

  // Update multiple checkbox states at once (for "apply to all" feature)
  async updateMultipleCheckboxStates(updates) {
    if (!this.cache.checkboxItems) await this.init();
    
    for (const {componentId, category, rule, state} of updates) {
      // Create the composite key
      const key = this._createKey(componentId, category, rule);
      
      // Update the checkbox state
      this.cache.checkboxItems[key] = state;
      
      // Update component structure tracking
      if (!this.cache.componentStructure[componentId]) {
        this.cache.componentStructure[componentId] = { categories: new Set(), rules: new Set() };
      }
      this.cache.componentStructure[componentId].categories.add(category);
      this.cache.componentStructure[componentId].rules.add(rule);
    }
    
    await this.persist();
  }
  
  // Get checked counts for a component
  async getCheckedCounts(componentId) {
    if (!this.cache.checkboxItems) await this.init();
    
    // Count checked items for this component
    const keys = Object.keys(this.cache.checkboxItems)
      .filter(key => key.startsWith(`${componentId}:`));
    
    const checkedCount = keys.filter(key => this.cache.checkboxItems[key].checked).length;
    const totalCount = keys.length;
    
    return { checkedCount, totalCount };
  }

  // Get modification date for a component
  async getModifiedDate(componentId) {
    if (!this.cache.componentMeta) await this.init();
    return this.cache.componentMeta[componentId]?.lastModified || null;
  }

  // Update modification date for a component
  async updateModifiedDate(componentId, date) {
    if (!this.cache.componentMeta) await this.init();
    
    if (!this.cache.componentMeta[componentId]) {
      this.cache.componentMeta[componentId] = {};
    }
    
    this.cache.componentMeta[componentId].lastModified = date;
    await this.persist();
  }

  // Clear all data (useful for reset/debug)
  async clear() {
    this.cache.checkboxItems = {};
    this.cache.componentMeta = {};
    this.cache.componentStructure = {};
    await this.persist();
  }

  // Persist all changes to Figma storage
  async persist() {
    // Convert Sets to arrays for serialization
    const serializableStructure = {};
    for (const componentId in this.cache.componentStructure) {
      serializableStructure[componentId] = {
        categories: Array.from(this.cache.componentStructure[componentId].categories),
        rules: Array.from(this.cache.componentStructure[componentId].rules)
      };
    }
    
    await Promise.all([
      figma.clientStorage.setAsync('checkboxItems', this.cache.checkboxItems),
      figma.clientStorage.setAsync('componentMeta', this.cache.componentMeta),
      figma.clientStorage.setAsync('componentStructure', serializableStructure)
    ]);
  }
}

// Export a singleton instance
export const storage = new Storage();
