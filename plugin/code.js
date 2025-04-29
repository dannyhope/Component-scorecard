/**
 * StorageManager - Handles all storage operations for the Component Scorecard plugin
 * Provides caching, error handling, and a clean API for data access
 */

// Error handling categories and severities for consistent reporting
const errorCategories = {
  STORAGE: 'storage',
  COMPONENT: 'component',
  PLUGIN: 'plugin',
  UI: 'ui',
  NETWORK: 'network',
  UNKNOWN: 'unknown'
};

const errorSeverity = {
  CRITICAL: 'critical', // App can't continue
  ERROR: 'error',       // Feature broken
  WARNING: 'warning',   // Can continue with caution
  INFO: 'info'          // Informational only
};

/**
 * Report an error to the UI's error manager
 * @param {Error|string} error - The error object or message
 * @param {string} category - Error category
 * @param {string} severity - Error severity
 * @param {Object} context - Additional context
 */
function reportError(error, category, severity, context = {}) {
  try {
    figma.ui.postMessage({
      type: 'reportError',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      category: errorCategories[category] || errorCategories.UNKNOWN,
      severity: errorSeverity[severity] || errorSeverity.ERROR,
      context: JSON.parse(JSON.stringify(context)) // Ensure serializable
    });
  } catch (e) {
    console.error('Error reporting error:', e);
    console.error('Original error:', error);
  }
}

/**
 * Safely execute a function with error reporting
 * @param {Function} fn - Function to try
 * @param {string} category - Error category
 * @param {string} severity - Error severity 
 * @param {Object} context - Error context
 * @returns {Promise} Promise resolving with result or rejecting with error
 */
async function safeExec(fn, category, severity, context = {}) {
  try {
    return await fn();
  } catch (error) {
    reportError(error, category, severity, context);
    throw error; // Re-throw for caller to handle
  }
}
class StorageManager {
  constructor() {
    this.cache = {
      checkboxStates: null,
      modifiedDates: null,
      viewStates: null,
      userPreferences: null,
      customRules: null,
      // New flattened data structure
      flatCheckboxItems: null
    };
    this.initialized = false;
    this.initPromise = null;
    this.pendingOperations = [];
    this.isProcessingOperations = false;
    this.useFlattened = false; // Feature flag to control whether to use flattened structure
  }

  /**
   * Initialize the storage by loading all data from Figma's client storage
   */
  async init() {
    // Prevent multiple simultaneous initialization
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('Initializing storage...');
        
        // Add timeout protection for storage operations
        const storageTimeout = setTimeout(() => {
          reject(new Error('Storage initialization timed out after 5000ms'));
        }, 5000);
        
        const [checkboxStates, modifiedDates, viewStates, userPreferences, customRules, flatCheckboxItems] = await Promise.all([
          this.getStorageWithFallback('checkboxStates', {}),
          this.getStorageWithFallback('modifiedDates', {}),
          this.getStorageWithFallback('viewStates', {}),
          this.getStorageWithFallback('userPreferences', { hideCompleted: false }),
          this.getStorageWithFallback('customRules', null),
          this.getStorageWithFallback('flatCheckboxItems', null)
        ]);
        
        clearTimeout(storageTimeout);
        
        this.cache.checkboxStates = checkboxStates;
        this.cache.modifiedDates = modifiedDates;
        this.cache.viewStates = viewStates;
        this.cache.userPreferences = userPreferences;
        this.cache.customRules = customRules;
        
        // Initialize flattened structure if it doesn't exist
        if (!flatCheckboxItems) {
          console.log('Flattened data structure not found, creating from nested structure...');
          this.cache.flatCheckboxItems = this.migrateToFlatStructure();
          // Save the flattened structure
          await figma.clientStorage.setAsync('flatCheckboxItems', this.cache.flatCheckboxItems);
        } else {
          this.cache.flatCheckboxItems = flatCheckboxItems;
        }
        
        this.initialized = true;
        console.log('Storage initialization complete');
        resolve();
      } catch (error) {
        console.error('Error initializing storage:', error);
        // Initialize with empty values in case of failure
        this.cache.checkboxStates = {};
        this.cache.modifiedDates = {};
        this.cache.viewStates = {};
        this.cache.userPreferences = { hideCompleted: false };
        this.cache.customRules = null;
        this.cache.flatCheckboxItems = [];
        
        this.initialized = true; // Still mark as initialized so we don't keep retrying
        figma.ui.postMessage({
          type: 'storageError',
          error: 'Failed to load stored data: ' + error.message
        });
        resolve(); // Resolve anyway to allow the plugin to function
      } finally {
        this.initPromise = null;
      }
    });
    
    return this.initPromise;
  }
  
  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - The function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in ms
   * @param {Function} onRetry - Called when a retry happens
   * @returns {Promise<any>} - Result of the function
   */
  async retryWithBackoff(fn, maxRetries = 3, baseDelay = 300, onRetry = null) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // If this was the last attempt, don't wait
        if (attempt === maxRetries) break;
        
        // Calculate delay with exponential backoff and jitter
        const delay = baseDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
        
        // Log retry attempt
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
        
        // Call onRetry callback if provided
        if (onRetry) onRetry(attempt, delay, error);
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // If we got here, all retries failed
    throw lastError;
  }
  
  /**
   * Generic method to get a value from storage with fallback
   */
  async getStorageWithFallback(key, defaultValue) {
    try {
      const value = await this.retryWithBackoff(
        () => figma.clientStorage.getAsync(key),
        3,
        300,
        (attempt) => console.log(`Retry ${attempt + 1} getting ${key} from storage`)
      );
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      console.error(`Error getting ${key} from storage after retries:`, error);
      return defaultValue;
    }
  }

  /**
   * Ensure storage is initialized before performing operations
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Generic method to get any value from storage
   */
  async get(key, defaultValue = null) {
    await this.ensureInitialized();
    
    if (this.cache[key] !== undefined) {
      return this.cache[key];
    }
    
    try {
      const value = await this.getStorageWithFallback(key, defaultValue);
      this.cache[key] = value;
      return value;
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Set a value in storage with retry
   */
  async set(key, value) {
    await this.ensureInitialized();
    
    try {
      // Update cache immediately
      this.cache[key] = value;
      
      // Attempt to persist with retry
      await this.retryWithBackoff(
        () => figma.clientStorage.setAsync(key, value),
        3,
        300,
        (attempt, delay, error) => {
          // Notify UI of retry attempt
          figma.ui.postMessage({
            type: 'storageRetry',
            key: key,
            attempt: attempt + 1,
            maxRetries: 3,
            delay: Math.round(delay),
            error: error.message
          });
        }
      );
      
      return true;
    } catch (error) {
      console.error(`Error setting ${key} after retries:`, error);
      
      // Notify UI of final failure
      figma.ui.postMessage({
        type: 'storageError',
        error: `Failed to save ${key} after multiple attempts: ${error.message}`,
        key: key
      });
      
      return false;
    }
  }

  /**
   * Get component state for a specific component
   */
  async getComponentState(componentId) {
    try {
      await this.ensureInitialized();
      return this.cache.checkboxStates[componentId] || {};
    } catch (error) {
      console.error(`Error getting component state for ${componentId}:`, error);
      return {};
    }
  }

  /**
   * Get all component states
   */
  async getAllComponentStates() {
    try {
      await this.ensureInitialized();
      return this.cache.checkboxStates;
    } catch (error) {
      console.error('Error getting all component states:', error);
      return {};
    }
  }
  
  /**
   * Get all components with their states
   * @returns {Promise<Array>} Array of components with their states
   */
  async getComponentsWithStates() {
    try {
      await this.ensureInitialized();
      const states = this.cache.checkboxStates || {};
      const modifiedDates = this.cache.modifiedDates || {};
      const viewStates = this.cache.viewStates || {};
      
      // Convert the object structure to an array of components
      const components = Object.keys(states).map(componentId => {
        return {
          id: componentId,
          states: states[componentId] || {},
          modifiedDate: modifiedDates[componentId] || null,
          viewState: viewStates[componentId] || { collapsed: false, userToggled: false }
        };
      });
      
      return components;
    } catch (error) {
      console.error('Error getting components with states:', error);
      return [];
    }
  }
  
  /**
   * Get a component with all its data
   * @param {string} componentId - The ID of the component
   * @returns {Promise<Object>} Component with its data
   */
  async getComponentWithData(componentId) {
    try {
      await this.ensureInitialized();
      
      const componentData = {
        id: componentId,
        states: this.cache.checkboxStates[componentId] || {},
        modifiedDate: this.cache.modifiedDates[componentId] || null,
        viewState: this.cache.viewStates[componentId] || { collapsed: false, userToggled: false }
      };
      
      // Calculate the score
      const score = await this.calculateComponentScore(componentId);
      componentData.checkedCount = score.checkedCount;
      componentData.totalRules = score.totalRules;
      
      return componentData;
    } catch (error) {
      console.error(`Error getting component data for ${componentId}:`, error);
      return {
        id: componentId,
        states: {},
        modifiedDate: null,
        viewState: { collapsed: false, userToggled: false },
        checkedCount: 0,
        totalRules: 0
      };
    }
  }
  
  /**
   * Calculate a component's score
   * @param {string} componentId - The ID of the component
   * @returns {Promise<Object>} Object with checkedCount and totalRules
   */
  async calculateComponentScore(componentId) {
    try {
      const componentState = await this.getComponentState(componentId);
      
      if (Object.keys(componentState).length === 0) {
        return { checkedCount: 0, totalRules: 0 };
      }

      const checkedCount = Object.values(componentState)
        .flatMap(categoryState => Object.values(categoryState))
        .filter(state => state && state.checked === true).length;

      // Count total rules from component state
      let totalRules = Object.values(componentState)
        .flatMap(categoryState => Object.values(categoryState))
        .length;
        
      return { checkedCount, totalRules };
    } catch (error) {
      console.error(`Error calculating score for ${componentId}:`, error);
      return { checkedCount: 0, totalRules: 0 };
    }
  }
  
  /**
   * Check if a component is fully completed
   * @param {string} componentId - The ID of the component
   * @returns {Promise<boolean>} True if all checkboxes are checked
   */
  async isComponentCompleted(componentId) {
    try {
      const score = await this.calculateComponentScore(componentId);
      return score.totalRules > 0 && score.checkedCount === score.totalRules;
    } catch (error) {
      console.error(`Error checking if component ${componentId} is completed:`, error);
      return false;
    }
  }

  /**
   * Update checkbox state for a specific component, category, and rule
   */
  async updateCheckboxState(componentId, category, rule, state) {
    try {
      await this.ensureInitialized();
      
      if (!this.cache.checkboxStates[componentId]) {
        this.cache.checkboxStates[componentId] = {};
      }
      if (!this.cache.checkboxStates[componentId][category]) {
        this.cache.checkboxStates[componentId][category] = {};
      }

      this.cache.checkboxStates[componentId][category][rule] = state;
      
      // If using flattened structure, update it as well
      if (this.useFlattened) {
        await this.updateFlatCheckboxItem(componentId, category, rule, state);
      }
      
      await this.persist();
      
      return this.cache.checkboxStates[componentId];
    } catch (error) {
      console.error(`Error updating checkbox state for ${componentId}:`, error);
      figma.ui.postMessage({
        type: 'saveError',
        error: 'Failed to save checkbox state: ' + error.message,
        componentId
      });
      return this.cache.checkboxStates[componentId] || {};
    }
  }

  /**
   * Persist all cached data to storage
   */
  async persist() {
    try {
      // Batch all storage operations together
      this.pendingOperations.push({
        type: 'persist',
        timestamp: Date.now()
      });
      
      // Process operations with debouncing
      this._processOperations();
      
      return true;
    } catch (error) {
      console.error('Error scheduling persist operation:', error);
      return false;
    }
  }
  
  /**
   * Process pending storage operations with retry
   * @private
   */
  async _processOperations() {
    if (this.isProcessingOperations) return;
    
    this.isProcessingOperations = true;
    
    // Wait a bit to batch operations (300ms debounce)
    setTimeout(async () => {
      try {
        // Use retry with backoff for bulk operations
        await this.retryWithBackoff(
          async () => {
            const storageOperations = [
              figma.clientStorage.setAsync('checkboxStates', this.cache.checkboxStates),
              figma.clientStorage.setAsync('modifiedDates', this.cache.modifiedDates),
              figma.clientStorage.setAsync('viewStates', this.cache.viewStates),
              figma.clientStorage.setAsync('userPreferences', this.cache.userPreferences),
              figma.clientStorage.setAsync('customRules', this.cache.customRules)
            ];
            
            // Add flattened structure to storage operations if it exists
            if (this.cache.flatCheckboxItems) {
              storageOperations.push(figma.clientStorage.setAsync('flatCheckboxItems', this.cache.flatCheckboxItems));
            }
            
            await Promise.all(storageOperations);
          },
          3,  // max retries
          500, // base delay (slightly longer for bulk operations)
          (attempt, delay, error) => {
            // Notify UI of retry attempt
            figma.ui.postMessage({
              type: 'bulkStorageRetry',
              attempt: attempt + 1,
              maxRetries: 3,
              delay: Math.round(delay),
              error: error.message
            });
          }
        );
        
        console.log('Storage persisted successfully');
        this.pendingOperations = [];
      } catch (error) {
        console.error('Error persisting storage after retries:', error);
        figma.ui.postMessage({
          type: 'storageError',
          error: 'Failed to save data after multiple attempts: ' + error.message,
          isBulkOperation: true
        });
      } finally {
        this.isProcessingOperations = false;
        
        // If more operations were added while processing, process them too
        if (this.pendingOperations.length > 0) {
          this._processOperations();
        }
      }
    }, 300);
  }

  /**
   * Update modified date for a component
   */
  async updateModifiedDates(componentId, timestamp) {
    try {
      await this.ensureInitialized();
      this.cache.modifiedDates[componentId] = timestamp;
      await this.persist();
    } catch (error) {
      console.error(`Error updating modified date for ${componentId}:`, error);
      // Non-critical operation, can continue without throwing
    }
  }

  /**
   * Get modified date for a component
   */
  async getModifiedDates(componentId) {
    try {
      await this.ensureInitialized();
      return this.cache.modifiedDates[componentId] || null;
    } catch (error) {
      console.error(`Error getting modified date for ${componentId}:`, error);
      return null;
    }
  }
  
  /**
   * Get all modified dates
   */
  async getAllModifiedDates() {
    try {
      await this.ensureInitialized();
      return this.cache.modifiedDates;
    } catch (error) {
      console.error('Error getting all modified dates:', error);
      return {};
    }
  }

  /**
   * Get view state for a component
   */
  async getViewState(componentId) {
    try {
      await this.ensureInitialized();
      return this.cache.viewStates[componentId] || null;
    } catch (error) {
      console.error(`Error getting view state for ${componentId}:`, error);
      return null;
    }
  }

  /**
   * Get all view states
   */
  async getAllViewStates() {
    try {
      await this.ensureInitialized();
      return this.cache.viewStates;
    } catch (error) {
      console.error('Error getting all view states:', error);
      return {};
    }
  }

  /**
   * Update view state for a component
   */
  async updateViewState(componentId, isCollapsed, userToggled = true) {
    try {
      await this.ensureInitialized();
      
      this.cache.viewStates[componentId] = {
        collapsed: isCollapsed,
        userToggled: userToggled
      };
      
      await this.persist();
      return this.cache.viewStates[componentId];
    } catch (error) {
      console.error(`Error updating view state for ${componentId}:`, error);
      return {
        collapsed: isCollapsed,
        userToggled: userToggled
      };
    }
  }
  
  /**
   * Get user preferences
   */
  async getUserPreferences() {
    try {
      await this.ensureInitialized();
      return this.cache.userPreferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return { hideCompleted: false };
    }
  }
  
  /**
   * Update user preferences
   */
  async updateUserPreferences(preferences) {
    try {
      await this.ensureInitialized();
      
      // Update only the provided preferences, keeping the rest intact
      this.cache.userPreferences = Object.assign({}, this.cache.userPreferences, preferences);
      
      await this.persist();
      return this.cache.userPreferences;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      figma.ui.postMessage({
        type: 'saveError',
        error: 'Failed to save preferences: ' + error.message
      });
      return this.cache.userPreferences;
    }
  }
  
  /**
   * Get custom rules
   */
  async getCustomRules() {
    try {
      await this.ensureInitialized();
      return this.cache.customRules;
    } catch (error) {
      console.error('Error getting custom rules:', error);
      return null;
    }
  }
  
  /**
   * Save custom rules
   */
  async saveCustomRules(customRules) {
    try {
      await this.ensureInitialized();
      this.cache.customRules = customRules;
      await this.persist();
      return this.cache.customRules;
    } catch (error) {
      console.error('Error saving custom rules:', error);
      figma.ui.postMessage({
        type: 'saveError',
        error: 'Failed to save custom rules: ' + error.message
      });
      return this.cache.customRules;
    }
  }
  
  /**
   * Migrate from nested structure to flat structure
   * @returns {Array} Array of flat checkbox items
   */
  migrateToFlatStructure() {
    try {
      const flatItems = [];
      const checkboxStates = this.cache.checkboxStates || {};
      
      // Iterate through all components
      Object.keys(checkboxStates).forEach(componentId => {
        const componentState = checkboxStates[componentId] || {};
        
        // Iterate through all categories
        Object.keys(componentState).forEach(category => {
          const categoryState = componentState[category] || {};
          
          // Iterate through all rules
          Object.keys(categoryState).forEach(rule => {
            const state = categoryState[rule];
            
            // Create a flat item
            const flatItem = {
              id: `${componentId}-${category}-${rule}`,
              componentId: componentId,
              category: category,
              ruleText: rule,
              checked: state ? state.checked : false,
              timestamp: state ? state.timestamp : null
            };
            
            flatItems.push(flatItem);
          });
        });
      });
      
      console.log(`Migrated ${flatItems.length} checkbox items to flat structure`);
      return flatItems;
    } catch (error) {
      console.error('Error migrating to flat structure:', error);
      return [];
    }
  }
  
  /**
   * Get all checkbox items in flat structure
   * @returns {Promise<Array>} Array of flat checkbox items
   */
  async getFlatCheckboxItems() {
    try {
      await this.ensureInitialized();
      
      if (!this.cache.flatCheckboxItems) {
        this.cache.flatCheckboxItems = this.migrateToFlatStructure();
      }
      
      return this.cache.flatCheckboxItems;
    } catch (error) {
      console.error('Error getting flat checkbox items:', error);
      return [];
    }
  }
  
  /**
   * Get flat checkbox items for a specific component
   * @param {string} componentId - The ID of the component
   * @returns {Promise<Array>} Array of flat checkbox items for the component
   */
  async getFlatCheckboxItemsForComponent(componentId) {
    try {
      const allItems = await this.getFlatCheckboxItems();
      return allItems.filter(item => item.componentId === componentId);
    } catch (error) {
      console.error(`Error getting flat checkbox items for component ${componentId}:`, error);
      return [];
    }
  }
  
  /**
   * Update a flat checkbox item
   * @param {string} componentId - The ID of the component
   * @param {string} category - The category
   * @param {string} rule - The rule text
   * @param {Object} state - The state object with checked and timestamp
   * @returns {Promise<Object>} The updated item
   */
  async updateFlatCheckboxItem(componentId, category, rule, state) {
    try {
      await this.ensureInitialized();
      
      if (!this.cache.flatCheckboxItems) {
        this.cache.flatCheckboxItems = this.migrateToFlatStructure();
      }
      
      const itemId = `${componentId}-${category}-${rule}`;
      let itemIndex = this.cache.flatCheckboxItems.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1) {
        // Item doesn't exist, create it
        const newItem = {
          id: itemId,
          componentId: componentId,
          category: category,
          ruleText: rule,
          checked: state.checked,
          timestamp: state.timestamp
        };
        
        this.cache.flatCheckboxItems.push(newItem);
        return newItem;
      } else {
        // Update existing item
        this.cache.flatCheckboxItems[itemIndex].checked = state.checked;
        this.cache.flatCheckboxItems[itemIndex].timestamp = state.timestamp;
        return this.cache.flatCheckboxItems[itemIndex];
      }
    } catch (error) {
      console.error(`Error updating flat checkbox item for ${componentId}:`, error);
      return null;
    }
  }
  
  /**
   * Set whether to use the flattened structure
   * @param {boolean} useFlattened - Whether to use the flattened structure
   */
  setUseFlattenedStructure(useFlattened) {
    this.useFlattened = useFlattened;
    console.log(`Using flattened structure: ${useFlattened}`);
    
    // If enabling flattened structure and it doesn't exist, create it
    if (useFlattened && !this.cache.flatCheckboxItems) {
      this.cache.flatCheckboxItems = this.migrateToFlatStructure();
    }
  }
}

// Create storage instance
const storage = new StorageManager();

// Function to load components and send data to the UI
async function loadComponents(skipCache = false) {
  // Set up loading timeout
  let loadingCompleted = false;
  const loadingTimeout = setTimeout(() => {
    if (!loadingCompleted) {
      console.error('Component loading timed out after 15 seconds');
      figma.ui.postMessage({
        type: 'loadError',
        error: 'Loading components timed out. Your document may be too large or complex.',
        partial: true // Indicate this is a timeout, not a complete failure
      });
    }
  }, 15000); // 15 seconds timeout

  try {
    console.log('Loading components...');
    console.log('Document name:', figma.root.name);
    console.log('Number of pages:', figma.root.children.length);
    console.log('Current page name:', figma.currentPage.name);
    
    // Make sure all pages are loaded
    try {
      const pageLoadTimeout = setTimeout(() => {
        throw new Error('Loading pages timed out after 5 seconds');
      }, 5000);
      
      await figma.loadAllPagesAsync();
      clearTimeout(pageLoadTimeout);
      console.log('All pages loaded successfully');
    } catch (pageLoadError) {
      console.error('Error loading pages:', pageLoadError);
      // Continue with currently loaded pages
      figma.ui.postMessage({
        type: 'loadWarning',
        warning: 'Some pages could not be loaded. Only currently loaded pages will be processed.'
      });
    }
    
    // Find all components across all pages in the document
    let allComponents = [];
    for (const page of figma.root.children) {
      try {
        console.log(`Searching for components on page: ${page.name}`);
        const pageComponents = page.findAllWithCriteria({
          types: ['COMPONENT']
        });
        console.log(`Found ${pageComponents.length} components on page ${page.name}`);
        allComponents = allComponents.concat(pageComponents);
      } catch (pageError) {
        console.error(`Error searching for components on page ${page.name}:`, pageError);
        // Continue with next page
        figma.ui.postMessage({
          type: 'loadWarning',
          warning: `Could not search for components on page "${page.name}". This page will be skipped.`
        });
      }
    }
    
    console.log('Found components across all pages:', allComponents.length);
    
    // Filter out components in component sets (variants) and deduplicate by ID
    const componentMap = new Map();
    
    try {
      // First pass - filter out variants and collect components
      allComponents
        .filter(component => !component.parent || component.parent.type !== 'COMPONENT_SET')
        .forEach(component => {
          // Only add this component if we haven't seen its ID before
          if (!componentMap.has(component.id)) {
            componentMap.set(component.id, component);
          }
        });
    } catch (filterError) {
      console.error('Error filtering components:', filterError);
      // Continue with potentially incomplete filtered components
    }
      
    // Convert back to array
    const components = Array.from(componentMap.values());
    
    console.log(`Found ${allComponents.length} total components, ${components.length} unique main components`);
    if (components.length > 0) {
      console.log('Component IDs:', components.map(c => c.id));
    } else {
      console.warn('No components found in the document. This might be because:');
      console.warn('1. There are no components in the document');
      console.warn('2. The plugin doesn\'t have access to the components');
      console.warn('3. The components are in a library and not in the document');
    }

    // Set up storage data with fallbacks for failures
    let states = {}, viewStates = {}, userPreferences = { hideCompleted: false }, customRules = null;
    let usageCounts = new Map(), dependencyCounts = new Map();
    let modifiedDates = {};
    
    try {
      // Get all component states from storage
      states = await storage.getAllComponentStates();
      
      // Get all view states and user preferences
      viewStates = await storage.getAllViewStates();
      userPreferences = await storage.getUserPreferences();
      customRules = await storage.getCustomRules();
    } catch (storageError) {
      console.error('Error getting data from storage:', storageError);
      // Will continue with empty defaults set above
      figma.ui.postMessage({
        type: 'loadWarning',
        warning: 'Could not load saved data. Starting with empty data.'
      });
    }

    try {
      // Get component usage and dependency counts with a timeout
      const analysisPromise = analyzeComponents();
      const analysisResult = await Promise.race([
        analysisPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Dependency analysis timed out')), 8000))
      ]);
      
      usageCounts = analysisResult.usageCounts;
      dependencyCounts = analysisResult.dependencyCounts;
    } catch (analysisError) {
      console.error('Error analyzing component dependencies:', analysisError);
      // Continue with empty dependency data
      figma.ui.postMessage({
        type: 'loadWarning',
        warning: 'Could not analyze component dependencies. Usage counts may be inaccurate.'
      });
    }

    // First get all the modification dates at once
    try {
      modifiedDates = await storage.getAllModifiedDates();
    } catch (datesError) {
      console.error('Error getting modification dates:', datesError);
      // Continue with empty dates
    }
    
    // Update modification dates in chunks to avoid hanging
    const CHUNK_SIZE = 10;
    let updatedModifiedDates = Object.assign({}, modifiedDates);
    
    try {
      if (components.length > 0) {
        for (let i = 0; i < components.length; i += CHUNK_SIZE) {
          const chunk = components.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunk.map(async component => {
            try {
              // Only set lastModified for new components that don't have a date yet
              // Don't update existing dates during loading - they should only change when scorecard data changes
              if (!modifiedDates[component.id]) {
                // Initial timestamp for tracking - this is when the component was first seen by the plugin
                const timestamp = new Date().toISOString();
                await storage.updateModifiedDates(component.id, timestamp);
                updatedModifiedDates[component.id] = timestamp;
              }
            } catch (dateUpdateError) {
              console.warn(`Could not update modified date for component ${component.id}:`, dateUpdateError);
              // Continue with next component
            }
          }));
        }
      }
    } catch (updateDatesError) {
      console.error('Error updating modification dates:', updateDatesError);
      // Continue with existing dates
    }
    
    let componentData = [];
    try {
      componentData = components.map(component => {
        try {
          // Get the checked count using the storage states
          const componentState = states[component.id] || {};
          const checkedCount = Object.values(componentState).reduce((sum, category) => {
            try {
              return sum + Object.values(category).filter(state => state && state.checked).length;
            } catch (categoryError) {
              console.warn(`Error calculating checked count for category in component ${component.id}:`, categoryError);
              return sum; // Return current sum without adding
            }
          }, 0);

          return {
            id: component.id,
            name: component.name,
            checkedCount,
            lastModified: updatedModifiedDates[component.id] || null,
            usageCount: usageCounts.get(component.id) || 0,
            dependencyCount: dependencyCounts.get(component.id) || 0
          };
        } catch (componentError) {
          console.warn(`Error creating data for component ${component.id}:`, componentError);
          // Return minimal valid component data
          return {
            id: component.id,
            name: component.name || 'Unknown Component',
            checkedCount: 0,
            lastModified: null,
            usageCount: 0,
            dependencyCount: 0
          };
        }
      });
    } catch (mapError) {
      console.error('Error mapping component data:', mapError);
      // Create minimal component data
      componentData = components.map(component => ({
        id: component.id,
        name: component.name || 'Unknown Component',
        checkedCount: 0,
        lastModified: null,
        usageCount: 0,
        dependencyCount: 0
      }));
    }

    // Get currently selected component if any
    let selectedComponentId = null;
    try {
      const selectedNodes = figma.currentPage.selection;
      selectedComponentId = selectedNodes.length === 1 && 
                            selectedNodes[0].type === 'COMPONENT' ? 
                            selectedNodes[0].id : null;
      
      if (selectedComponentId) {
        console.log('Currently selected component:', selectedComponentId);
      }
    } catch (selectionError) {
      console.error('Error getting selection:', selectionError);
      // Leave selectedComponentId as null
    }

    // Signal that loading is complete before sending data
    loadingCompleted = true;
    clearTimeout(loadingTimeout);

    // Send data to the UI
    try {
      figma.ui.postMessage({
        type: 'loadComponents',
        viewStates,
        components: componentData,
        checkboxStates: states,
        selectedComponentId,
        userPreferences,
        customRules
      });
      console.log('Component data sent to UI successfully');
    } catch (postError) {
      console.error('Error sending data to UI:', postError);
      figma.ui.postMessage({
        type: 'loadError',
        error: 'Error sending component data to UI: ' + postError.message
      });
    }
  } catch (error) {
    console.error('Critical error loading components:', error);
    // Ensure timeout is cleared
    loadingCompleted = true;
    clearTimeout(loadingTimeout);
    
    // Send a detailed error message to the UI
    try {
      figma.ui.postMessage({
        type: 'loadError',
        error: 'Failed to load components: ' + error.message,
        details: error.stack
      });
    } catch (msgError) {
      console.error('Could not send error message to UI:', msgError);
    }
  }
}


async function main() {
  try {
    // Set a global timeout for the entire plugin initialization
    const initTimeout = setTimeout(() => {
      console.error('Plugin initialization timed out after 30 seconds');
      figma.ui.postMessage({
        type: 'criticalError',
        error: 'Plugin initialization timed out. Please try restarting the plugin.'
      });
    }, 30000); // 30 second timeout for the entire initialization process
    
    // Initialize storage with error handling
    try {
      await storage.init();
      storage.setUseFlattenedStructure(false); // Temporarily disable flattened structure
    } catch (storageError) {
      console.error('Storage initialization failed:', storageError);
      // Continue anyway - the storage class has internal fallbacks
      figma.ui.postMessage({
        type: 'loadWarning',
        warning: 'Could not load saved preferences. Starting with default settings.'
      });
    }
    
    // Show the UI
    try {
      figma.showUI(__html__, { width: 400, height: 600 });
    } catch (uiError) {
      console.error('Failed to show UI:', uiError);
      // This is a critical error - can't continue without UI
      throw new Error('Failed to initialize plugin UI: ' + uiError.message);
    }
    
    // Make sure all pages are loaded first with timeout
    console.log('Loading all pages...');
    try {
      const pageLoadingPromise = figma.loadAllPagesAsync();
      await Promise.race([
        pageLoadingPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Page loading timed out')), 10000))
      ]);
    } catch (pageError) {
      console.error('Error loading all pages:', pageError);
      // Continue with currently loaded pages
      figma.ui.postMessage({
        type: 'loadWarning',
        warning: 'Could not load all document pages. Some components may not be visible.'
      });
    }
    
    // Initial component load with clean state
    console.log('Initial component load...');
    try {
      await loadComponents(true); // Force a refresh on startup
      console.log('Initial component load successful');
    } catch (error) {
      console.error('Error during initial component load:', error);
      figma.ui.postMessage({
        type: 'loadError',
        error: 'Failed to load components: ' + error.message
      });
    }
    
    // Clear the initialization timeout
    clearTimeout(initTimeout);
  } catch (criticalError) {
    console.error('Critical error during plugin initialization:', criticalError);
    // Try to notify the user
    try {
      figma.ui.postMessage({
        type: 'criticalError',
        error: 'Failed to initialize plugin: ' + criticalError.message,
        details: criticalError.stack
      });
    } catch (e) {
      // At this point we can't do much
      console.error('Could not send error message to UI');
    }
  }
  
  // Function to detect deleted components by comparing stored components to what's in the document
  async function detectDeletedComponents() {
    try {
      console.log('Running component deletion check...');
      
      // Get all component IDs from storage
      const storedComponentStates = await storage.getAllComponentStates();
      const storedComponentIds = Object.keys(storedComponentStates || {});
      
      if (storedComponentIds.length === 0) {
        console.log('No stored components to check for deletions');
        return [];
      }
      
      console.log(`Checking ${storedComponentIds.length} stored components against document...`);
      
      // Get all current components in the document
      // Load all pages first to ensure we have access to all components
      try {
        await figma.loadAllPagesAsync();
      } catch (err) {
        console.warn('Error loading all pages:', err);
        // Continue with currently loaded pages
      }
      
      // Find all current components across all pages
      const currentComponentIds = new Set();
      for (const page of figma.root.children) {
        try {
          // Find all components on this page
          const pageComponents = page.findAllWithCriteria({
            types: ['COMPONENT']
          });
          
          pageComponents.forEach(comp => {
            currentComponentIds.add(comp.id);
          });
        } catch (pageError) {
          console.warn(`Error finding components on page ${page.name}:`, pageError);
        }
      }
      
      console.log(`Found ${currentComponentIds.size} components in document`);
      
      // Find deleted components (in storage but not in document)
      const deletedComponents = [];
      for (const storedId of storedComponentIds) {
        if (!currentComponentIds.has(storedId)) {
          console.log('Deleted component detected:', storedId);
          deletedComponents.push(storedId);
        }
      }
      
      return deletedComponents;
    } catch (error) {
      console.error('Error in detectDeletedComponents:', error);
      return [];
    }
  }
  
  // Improved document change handler with real-time component deletion detection
  figma.on('documentchange', async (event) => {
    console.log('Document changed (enhanced handler):', event);
    
    // Check if any components were modified in this change
    if (event && event.documentChanges) {
      for (const change of event.documentChanges) {
        // If a node was modified and it's a component
        if (change.type === 'PROPERTY_CHANGE' && change.node && change.node.type === 'COMPONENT') {
          console.log('Component modified:', change.node.name);
          // We no longer update lastModified here, as property changes in Figma
          // don't change the scorecard data itself
        }
        
        // If a component was deleted, handle it immediately
        if (change.type === 'DELETE' && change.node && change.node.type === 'COMPONENT') {
          console.log('Component deleted immediately detected:', change.node.id);
          const deletedId = change.node.id;
          
          // Clean up storage for the deleted component
          try {
            await cleanupDeletedComponent(deletedId);
            
            // Notify UI about the deletion
            figma.ui.postMessage({
              type: 'componentsDeleted',
              componentIds: [deletedId]
            });
          } catch (error) {
            console.error(`Error handling immediate component deletion ${deletedId}:`, error);
          }
        }
      }
    }
    
    // Run the component deletion check after any document change to catch any missed deletions
    try {
      const deletedComponents = await detectDeletedComponents();
      if (deletedComponents.length > 0) {
        console.log(`Deletion check found ${deletedComponents.length} deleted components`);
        
        // Clean up storage for each deleted component
        for (const componentId of deletedComponents) {
          await cleanupDeletedComponent(componentId);
        }
        
        // Notify UI about deletions
        figma.ui.postMessage({
          type: 'componentsDeleted',
          componentIds: deletedComponents
        });
      }
    } catch (error) {
      console.error('Error in deletion detection:', error);
    }
    
    // Reload components to reflect any changes
    try {
      await loadComponents();
    } catch (error) {
      console.error('Error reloading components after document change:', error);
    }
  });
  
  // Helper function to clean up a deleted component
  async function cleanupDeletedComponent(componentId) {
    try {
      console.log(`Cleaning up deleted component: ${componentId}`);
      
      // Remove component state from checkboxStates
      const checkboxStates = await storage.getAllComponentStates();
      if (checkboxStates && checkboxStates[componentId]) {
        delete checkboxStates[componentId];
        await storage.set('checkboxStates', checkboxStates);
      }
      
      // Remove component from modified dates
      const modifiedDates = await storage.getAllModifiedDates();
      if (modifiedDates && modifiedDates[componentId]) {
        delete modifiedDates[componentId];
        await storage.set('modifiedDates', modifiedDates);
      }
      
      // Remove component from view states
      const viewStates = await storage.getAllViewStates();
      if (viewStates && viewStates[componentId]) {
        delete viewStates[componentId];
        await storage.set('viewStates', viewStates);
      }
      
      // If using flattened structure, clean up flat items too
      if (storage.useFlattened) {
        const flatItems = await storage.getFlatCheckboxItems() || [];
        const filteredItems = flatItems.filter(item => item.componentId !== componentId);
        await storage.set('flatCheckboxItems', filteredItems);
      }
      
      console.log(`Successfully cleaned up deleted component: ${componentId}`);
      return true;
    } catch (error) {
      console.error(`Error cleaning up deleted component ${componentId}:`, error);
      throw error;
    }
  }
  
  // Listen for selection changes
  figma.on('selectionchange', async () => {
    console.log('Selection changed, checking relevant components...');
    await handleSelectionChange();
  });
  
  // Set up periodic check for deleted components
  // This ensures that even if document change events miss deletions, we'll catch them
  const componentCheckInterval = setInterval(async () => {
    try {
      // Only run the check if the plugin has been open for a while (avoid startup conflicts)
      const deletedComponents = await detectDeletedComponents();
      
      if (deletedComponents.length > 0) {
        console.log(`Periodic check found ${deletedComponents.length} deleted components`);
        
        // Clean up storage for each deleted component
        for (const componentId of deletedComponents) {
          try {
            // Remove component state from checkboxStates
            const checkboxStates = await storage.getAllComponentStates();
            if (checkboxStates && checkboxStates[componentId]) {
              delete checkboxStates[componentId];
              await storage.set('checkboxStates', checkboxStates);
            }
            
            // Remove component from modified dates
            const modifiedDates = await storage.getAllModifiedDates();
            if (modifiedDates && modifiedDates[componentId]) {
              delete modifiedDates[componentId];
              await storage.set('modifiedDates', modifiedDates);
            }
            
            // Remove component from view states
            const viewStates = await storage.getAllViewStates();
            if (viewStates && viewStates[componentId]) {
              delete viewStates[componentId];
              await storage.set('viewStates', viewStates);
            }
            
            // If using flattened structure, clean up flat items too
            if (storage.useFlattened) {
              const flatItems = await storage.getFlatCheckboxItems() || [];
              const filteredItems = flatItems.filter(item => item.componentId !== componentId);
              await storage.set('flatCheckboxItems', filteredItems);
            }
            
            console.log(`Cleaned up deleted component: ${componentId}`);
          } catch (componentError) {
            console.error(`Error cleaning up deleted component ${componentId}:`, componentError);
          }
        }
        
        // Notify UI about deletions
        figma.ui.postMessage({
          type: 'componentsDeleted',
          componentIds: deletedComponents
        });
        
        // Reload components to reflect any changes
        try {
          await loadComponents();
        } catch (error) {
          console.error('Error reloading components after deletion cleanup:', error);
        }
      }
    } catch (error) {
      console.error('Error in periodic component deletion check:', error);
    }
  }, 15000); // Check every 15 seconds
  
  // Function to handle selection changes and filter components accordingly
  async function handleSelectionChange() {
    const selection = figma.currentPage.selection;
    
    // Debug info for selection
    console.log(`Selection changed: ${selection.length} items selected`);
    selection.forEach((node, index) => {
      console.log(`  Selection ${index}: ${node.type} ${node.name || '(unnamed)'}`);
    });
    
    // If nothing is selected, show all components
    if (selection.length === 0) {
      console.log('Nothing selected, showing all components');
      figma.ui.postMessage({
        type: 'filterBySelection',
        selectedComponentIds: null // null means show all
      });
      return;
    }
    
    // Case 1: Two or more components are directly selected
    const selectedComponents = selection.filter(node => node.type === 'COMPONENT');
    if (selectedComponents.length >= 2) {
      console.log(`${selectedComponents.length} components directly selected`);
      const componentIds = selectedComponents.map(comp => comp.id);
      figma.ui.postMessage({
        type: 'filterBySelection',
        selectedComponentIds: componentIds
      });
      return;
    }
    
    // Case 2 & 3: Section, Frame or Group containing components is selected
    const containedComponentIds = [];
    
    // Process each selected node
    for (const node of selection) {
      // Check containers: SECTION, FRAME, GROUP, or any node with children
      if (node.children) {
        console.log(`Checking children of ${node.type} '${node.name || '(unnamed)'}' for components...`);
        
        // Find all components within this node
        const findComponents = (parent) => {
          if (!parent.children) return;
          
          for (const child of parent.children) {
            if (child.type === 'COMPONENT') {
              console.log(`  Found component: ${child.name || '(unnamed)'} (${child.id})`);
              containedComponentIds.push(child.id);
            }
            
            // Recursively check children
            if (child.children) {
              findComponents(child);
            }
          }
        };
        
        // Find components in this node
        findComponents(node);
      }
    }
    
    // If we found components in the selection, filter to show only those
    if (containedComponentIds.length > 0) {
      console.log(`Found ${containedComponentIds.length} components within selected containers`);
      figma.ui.postMessage({
        type: 'filterBySelection',
        selectedComponentIds: containedComponentIds
      });
      return;
    }
    
    // If no special criteria met, show all components
    console.log('No selection criteria met, showing all components');
    figma.ui.postMessage({
      type: 'filterBySelection',
      selectedComponentIds: null
    });
  }

  // Track component IDs for change detection
  let knownComponentIds = new Set();
  
  // Function to update known component IDs
  async function updateKnownComponentIds() {
    const components = [];
    
    // Find all components across all pages
    for (const page of figma.root.children) {
      const pageComponents = page.findAllWithCriteria({
        types: ['COMPONENT']
      }).filter(component => 
        !component.parent || component.parent.type !== 'COMPONENT_SET'
      );
      components.push(...pageComponents);
    }
    
    // Update the set of known component IDs
    knownComponentIds = new Set(components.map(c => c.id));
    console.log(`Updated known component IDs, tracking ${knownComponentIds.size} components`);
  }
  
  // Initialize the known component IDs
  await updateKnownComponentIds();
  
  // We've completely removed the duplicate document change handler to fix syntax errors.
  // The enhanced handler above provides improved functionality for detecting deleted components.
  
  // Listen to messages from the UI
  figma.ui.onmessage = async msg => {
  // Set a timeout for all message handling to prevent hanging
  let messageHandled = false;
  const messageTimeout = setTimeout(() => {
    if (!messageHandled) {
      console.error(`Message handler timed out for message type: ${msg.type}`);
      figma.ui.postMessage({
        type: 'operationTimeout',
        originalMessageType: msg.type,
        error: 'Operation timed out. The document may be too large or complex.'
      });
    }
  }, 20000); // 20 second timeout for message handling
  
  try {
    console.log(`Handling message of type: ${msg.type}`);
    
    // Component detection is now reliable enough that we don't need manual refresh
    // The refreshComponents message handler has been removed
    
    // Handle data structure toggle
    if (msg.type === 'toggleFlattenedStructure') {
      storage.setUseFlattenedStructure(msg.useFlattened);
      figma.ui.postMessage({
        type: 'flattenedStructureToggled',
        useFlattened: msg.useFlattened
      });
      
      messageHandled = true;
      clearTimeout(messageTimeout);
      return;
    }
    if (msg.type === 'getDocumentTitle') {
      try {
        figma.ui.postMessage({
          type: 'documentTitle',
          title: figma.root.name
        });
      } catch (titleError) {
        console.error('Error getting document title:', titleError);
        figma.ui.postMessage({
          type: 'documentTitleError',
          error: 'Could not get document title'
        });
      }
    } else if (msg.type === 'selectComponent') {
      try {
        // Find the component with a timeout
        const findTimeout = setTimeout(() => {
          throw new Error('Finding component timed out');
        }, 5000);
        
        // Find the component
        const component = figma.currentPage.findOne(node => 
          node.type === 'COMPONENT' && node.id === msg.componentId
        );
        
        clearTimeout(findTimeout);

        if (component) {
          // Select the component
          figma.currentPage.selection = [component];
          
          // Scroll the component into view
          figma.viewport.scrollAndZoomIntoView([component]);
          
          figma.ui.postMessage({
            type: 'componentSelected',
            componentId: msg.componentId
          });
        } else {
          console.warn(`Component not found: ${msg.componentId}`);
          figma.ui.postMessage({
            type: 'componentNotFound',
            componentId: msg.componentId
          });
        }
      } catch (selectError) {
        console.error('Error selecting component:', selectError);
        figma.ui.postMessage({
          type: 'selectError',
          error: 'Failed to select component: ' + selectError.message,
          componentId: msg.componentId
        });
      }
    } else if (msg.type === 'checkboxChanged') {
      try {
        const { componentId, category, label, isChecked } = msg;

        // Get current state to check if this is actually changing
        const currentState = await storage.getComponentState(componentId);
        let currentValue = false;
        if (currentState && currentState[category] && currentState[category][label]) {
          currentValue = currentState[category][label].checked || false;
        }
        const isRealChange = currentValue !== isChecked;

        // Update the checkbox state
        const timestamp = msg.applyToAll ? msg.timestamp : (isChecked ? new Date().toISOString() : null);
        await storage.updateCheckboxState(componentId, category, label, {
          checked: isChecked,
          timestamp: timestamp
        });

        // If this was an actual change to the scorecard data, update the lastModified date
        if (isRealChange) {
          await storage.updateModifiedDates(componentId, new Date().toISOString());
        }

        // Calculate and update the score
        const score = await storage.calculateComponentScore(componentId);
        figma.ui.postMessage({
          type: 'updateScore',
          componentId,
          checkedCount: score.checkedCount,
          totalRules: score.totalRules
        });
      } catch (checkboxError) {
        console.error('Error updating checkbox state:', checkboxError);
        figma.ui.postMessage({
          type: 'checkboxError',
          error: 'Failed to update component state: ' + checkboxError.message,
          componentId: msg.componentId,
          category: msg.category,
          label: msg.label
        });
      }
    } else if (msg.type === 'saveViewState') {
      try {
        // Save the component view state
        const { componentId, collapsed, userToggled } = msg;
        await storage.updateViewState(componentId, collapsed, userToggled);
        
        figma.ui.postMessage({
          type: 'viewStateSaved',
          componentId
        });
      } catch (viewStateError) {
        console.error('Error saving view state:', viewStateError);
        // Non-critical, can continue without notifying UI
      }
    } else if (msg.type === 'saveUserPreferences') {
      try {
        // Save user preferences
        await storage.updateUserPreferences(msg.preferences);
        
        figma.ui.postMessage({
          type: 'preferencesSaved'
        });
      } catch (prefError) {
        console.error('Error saving user preferences:', prefError);
        figma.ui.postMessage({
          type: 'preferencesError',
          error: 'Failed to save preferences: ' + prefError.message
        });
      }
    } else if (msg.type === 'saveCustomRules') {
      try {
        console.log('Saving custom rules');
        await storage.saveCustomRules(msg.customRules);
        
        figma.ui.postMessage({
          type: 'customRulesSaved'
        });
      } catch (rulesError) {
        console.error('Error saving custom rules:', rulesError);
        figma.ui.postMessage({
          type: 'customRulesError',
          error: 'Failed to save custom rules: ' + rulesError.message
        });
      }
    // The selectInstances message handler has been removed as the instance count feature is no longer needed
    } else {
      console.warn(`Unknown message type received: ${msg.type}`);
    }
    
    // Mark message as handled
    messageHandled = true;
    clearTimeout(messageTimeout);
  } catch (error) {
    console.error(`Unhandled error processing message of type ${msg.type}:`, error);
    messageHandled = true;
    clearTimeout(messageTimeout);
    
    // Send generic error for unhandled message errors
    figma.ui.postMessage({
      type: 'operationError',
      originalMessageType: msg.type,
      error: 'Operation failed: ' + error.message
    });
  }
};

} // End of main function

// Run the main function
main();