/**
 * Component Scorecard Plugin
 * 
 * This plugin helps designers track and manage component quality across their design system.
 * It implements a centralized state management system for improved reliability and maintainability.
 */

import stateManager from './state-manager.js';

/**
 * StorageManager - Handles all storage operations for the Component Scorecard plugin
 * Provides caching, error handling, and a clean API for data access
 */
class StorageManager {
  constructor() {
    this.cache = {
      checkboxStates: null,
      modifiedDates: null,
      viewStates: null,
      userPreferences: null,
      customRules: null,
      // New flattened data structure (will be populated later)
      flatCheckboxItems: null
    };
    this.initialized = false;
    this.initPromise = null;
    this.pendingOperations = [];
    this.isProcessingOperations = false;
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
        
        const [checkboxStates, modifiedDates, viewStates, userPreferences, customRules] = await Promise.all([
          this.getStorageWithFallback('checkboxStates', {}),
          this.getStorageWithFallback('modifiedDates', {}),
          this.getStorageWithFallback('viewStates', {}),
          this.getStorageWithFallback('userPreferences', { hideCompleted: false }),
          this.getStorageWithFallback('customRules', null)
        ]);
        
        clearTimeout(storageTimeout);
        
        this.cache.checkboxStates = checkboxStates;
        this.cache.modifiedDates = modifiedDates;
        this.cache.viewStates = viewStates;
        this.cache.userPreferences = userPreferences;
        this.cache.customRules = customRules;
        
        this.initialized = true;
        console.log('Storage initialized successfully');
        resolve();
      } catch (error) {
        console.error('Error initializing storage:', error);
        reject(error);
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
        (attempt) => {
          console.log(`Retry ${attempt + 1} getting ${key} from storage`);
          // Notify UI of retry attempt
          figma.ui.postMessage({
            type: 'storageRetry',
            key: key,
            attempt: attempt + 1,
            maxRetries: 3,
            delay: Math.round(300 * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4))
          });
        }
      );
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      console.error(`Error getting ${key} from storage after retries:`, error);
      // Notify UI of error
      figma.ui.postMessage({
        type: 'storageError',
        key: key,
        error: error.message || 'Unknown error'
      });
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
    
    // Check cache first
    if (this.cache[key] !== undefined) {
      return this.cache[key];
    }
    
    // Get from storage
    const value = await this.getStorageWithFallback(key, defaultValue);
    
    // Update cache
    this.cache[key] = value;
    
    return value;
  }

  /**
   * Generic method to set any value in storage
   */
  async set(key, value) {
    await this.ensureInitialized();
    
    // Update cache immediately
    this.cache[key] = value;
    
    try {
      // Use retry with backoff for storage operations
      await this.retryWithBackoff(
        () => figma.clientStorage.setAsync(key, value),
        3,
        300,
        (attempt, delay) => {
          console.log(`Retry ${attempt + 1} setting ${key} in storage`);
          // Notify UI of retry attempt
          figma.ui.postMessage({
            type: 'storageRetry',
            key: key,
            attempt: attempt + 1,
            maxRetries: 3,
            delay: Math.round(delay)
          });
        }
      );
      
      return true;
    } catch (error) {
      console.error(`Error setting ${key} in storage after retries:`, error);
      // Notify UI of error
      figma.ui.postMessage({
        type: 'storageError',
        key: key,
        error: error.message || 'Unknown error'
      });
      
      throw error;
    }
  }

  // Other methods remain the same...
}

// Create storage instance
const storage = new StorageManager();

/**
 * Calculate a component's score
 * @param {string} componentId - The component ID
 * @returns {Object} Score information
 */
function calculateComponentScore(componentId) {
  // Use the state manager to calculate scores
  return stateManager.calculateComponentScore(componentId);
}

/**
 * Function to analyze component usage across the document
 */
async function analyzeComponents() {
  // Existing implementation...
}

/**
 * Function to load components and send data to the UI
 */
async function loadComponents(skipCache = false) {
  try {
    console.log('Loading components...');
    
    // Get all components in the document
    const components = await analyzeComponents();
    
    // Update state manager with components
    stateManager.setComponents(components);
    
    // Send components to UI
    figma.ui.postMessage({
      type: 'componentsLoaded',
      components: Array.from(components.values())
    });
    
    console.log(`Loaded ${components.size} components`);
    
    return components;
  } catch (error) {
    console.error('Error loading components:', error);
    figma.ui.postMessage({
      type: 'error',
      message: 'Error loading components: ' + error.message
    });
    
    throw error;
  }
}

/**
 * Main function to initialize the plugin
 */
async function main() {
  try {
    console.log('Component Scorecard plugin starting...');
    
    // Show UI
    figma.showUI(__html__, { width: 360, height: 580 });
    
    // Initialize storage
    await storage.init();
    
    // Initialize state manager with storage
    stateManager.initialize(storage);
    
    // Load initial state
    await stateManager.loadInitialState();
    
    // Load components
    await loadComponents();
    
    // Send document title to UI
    figma.ui.postMessage({
      type: 'documentTitle',
      title: figma.root.name
    });
    
    console.log('Plugin initialized successfully');
  } catch (error) {
    console.error('Error initializing plugin:', error);
    figma.ui.postMessage({
      type: 'error',
      message: 'Error initializing plugin: ' + error.message
    });
  }
}

// Listen to messages from the UI
figma.ui.onmessage = async msg => {
  // Set a timeout for all message handling to prevent hanging
  let messageHandled = false;
  const messageTimeout = setTimeout(() => {
    if (!messageHandled) {
      console.warn('Message handling timeout exceeded, forcing completion');
      messageHandled = true;
      figma.ui.postMessage({
        type: 'error',
        message: 'Operation timed out. Please try again.'
      });
    }
  }, 10000);
  
  try {
    console.log(`Handling message of type: ${msg.type}`);
    
    if (msg.type === 'selectComponent') {
      // Select a component in the document
      if (msg.componentId) {
        const components = stateManager.getComponents();
        const component = components.get(msg.componentId);
        
        if (component && component.node) {
          // Select the component node
          figma.currentPage.selection = [component.node];
          
          // Scroll to the component
          figma.viewport.scrollAndZoomIntoView([component.node]);
          
          console.log(`Selected component: ${component.name}`);
        } else {
          console.warn(`Component not found: ${msg.componentId}`);
        }
      } else {
        // Clear selection
        figma.currentPage.selection = [];
      }
    } else if (msg.type === 'setCheckboxState') {
      // Update checkbox state
      try {
        await stateManager.setCheckboxState(
          msg.componentId,
          msg.category,
          msg.ruleText,
          msg.checked
        );
        
        // Calculate new score
        const score = stateManager.calculateComponentScore(msg.componentId);
        
        // Send updated score to UI
        figma.ui.postMessage({
          type: 'scoreUpdated',
          componentId: msg.componentId,
          checkedCount: score.checked,
          totalRules: score.total
        });
        
        console.log(`Updated checkbox state for ${msg.componentId} - ${msg.category} - ${msg.ruleText}: ${msg.checked}`);
      } catch (error) {
        console.error('Error updating checkbox state:', error);
        figma.ui.postMessage({
          type: 'error',
          message: 'Error updating checkbox: ' + error.message
        });
      }
    } else if (msg.type === 'setFilter') {
      // Update filter state
      stateManager.setFilters({
        [msg.filterName]: msg.value
      });
      
      console.log(`Updated filter ${msg.filterName}: ${msg.value}`);
    }
    
    messageHandled = true;
    clearTimeout(messageTimeout);
  } catch (error) {
    console.error(`Unhandled error processing message of type ${msg.type}:`, error);
    messageHandled = true;
    clearTimeout(messageTimeout);
    
    figma.ui.postMessage({
      type: 'error',
      message: 'Error processing request: ' + error.message
    });
  }
};

// Run the main function
main();
