/**
 * Storage Error Integration - Adds ErrorManager integration to StorageManager
 * 
 * This file adds the necessary methods to connect the StorageManager
 * with our new centralized error handling system.
 */

// Add error handling methods to StorageManager prototype
StorageManager.prototype.getStorageWithErrorHandling = async function(key, defaultValue) {
  try {
    const data = await figma.clientStorage.getAsync(key);
    return data;
  } catch (error) {
    // Report to error manager with appropriate categorization
    figma.ui.postMessage({ 
      type: 'reportError', 
      error: error.message,
      category: 'STORAGE',
      severity: 'ERROR',
      context: { 
        key, 
        operation: 'get',
        defaultValueProvided: defaultValue !== undefined
      }
    });
    
    console.error(`Error getting ${key} from storage:`, error);
    return defaultValue;
  }
};

StorageManager.prototype.setStorageWithErrorHandling = async function(key, value) {
  try {
    await figma.clientStorage.setAsync(key, value);
    return true;
  } catch (error) {
    // Report to error manager
    figma.ui.postMessage({ 
      type: 'reportError', 
      error: error.message,
      category: 'STORAGE',
      severity: 'ERROR',
      context: { 
        key, 
        operation: 'set',
        valueType: typeof value,
        isArray: Array.isArray(value),
        valueSize: JSON.stringify(value).length
      }
    });
    
    console.error(`Error setting ${key} in storage:`, error);
    
    // Try to save in a retry queue
    this.addToRetryQueue(key, value);
    return false;
  }
};

// Add retry logic
StorageManager.prototype.retryQueue = [];
StorageManager.prototype.isProcessingRetries = false;

StorageManager.prototype.addToRetryQueue = function(key, value) {
  this.retryQueue.push({ key, value, attempts: 0, maxAttempts: 3 });
  
  // Start processing retries if not already in progress
  if (!this.isProcessingRetries) {
    this.processRetryQueue();
  }
};

StorageManager.prototype.processRetryQueue = async function() {
  if (this.retryQueue.length === 0) {
    this.isProcessingRetries = false;
    return;
  }
  
  this.isProcessingRetries = true;
  const item = this.retryQueue.shift();
  
  // Increase attempts
  item.attempts++;
  
  // Notify UI about retry attempt
  figma.ui.postMessage({ 
    type: 'storageRetry', 
    key: item.key, 
    attempt: item.attempts,
    maxRetries: item.maxAttempts,
    delay: Math.pow(2, item.attempts) * 1000 // Exponential backoff
  });
  
  try {
    // Wait using exponential backoff
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, item.attempts) * 1000));
    
    // Try to save again
    await figma.clientStorage.setAsync(item.key, item.value);
    
    // Notify UI about successful retry
    figma.ui.postMessage({ 
      type: 'storageRetrySuccess', 
      key: item.key
    });
  } catch (error) {
    // Still failed
    if (item.attempts < item.maxAttempts) {
      // Add back to queue for another try
      this.retryQueue.push(item);
    } else {
      // Give up after max attempts
      figma.ui.postMessage({ 
        type: 'storageError', 
        key: item.key,
        error: `Failed to save after ${item.maxAttempts} attempts: ${error.message}`
      });
    }
  }
  
  // Process next item
  this.processRetryQueue();
};

// Enhanced initialization with better error handling
StorageManager.prototype.initWithErrorHandling = function() {
  if (this.initPromise) {
    return this.initPromise;
  }

  this.initPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('Initializing storage with error handling...');
      
      // Add timeout protection for storage operations
      const storageTimeout = setTimeout(() => {
        const timeoutError = new Error('Storage initialization timed out after 5000ms');
        
        // Report timeout to error manager
        figma.ui.postMessage({ 
          type: 'reportError', 
          error: timeoutError.message,
          category: 'STORAGE',
          severity: 'CRITICAL',
          context: { operation: 'initialization' }
        });
        
        reject(timeoutError);
      }, 5000);
      
      const [checkboxStates, modifiedDates, viewStates, userPreferences, customRules, flatCheckboxItems] = await Promise.all([
        this.getStorageWithErrorHandling('checkboxStates', {}),
        this.getStorageWithErrorHandling('modifiedDates', {}),
        this.getStorageWithErrorHandling('viewStates', {}),
        this.getStorageWithErrorHandling('userPreferences', { hideCompleted: false }),
        this.getStorageWithErrorHandling('customRules', null),
        this.getStorageWithErrorHandling('flatCheckboxItems', null)
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
        try {
          this.cache.flatCheckboxItems = this.migrateToFlatStructure();
          // Save the flattened structure
          await this.setStorageWithErrorHandling('flatCheckboxItems', this.cache.flatCheckboxItems);
        } catch (migrationError) {
          // Report migration error
          figma.ui.postMessage({ 
            type: 'reportError', 
            error: migrationError.message,
            category: 'STORAGE',
            severity: 'ERROR',
            context: { 
              operation: 'migration',
              source: 'nested',
              target: 'flattened'
            }
          });
          
          // Fall back to empty array
          this.cache.flatCheckboxItems = [];
        }
      } else {
        this.cache.flatCheckboxItems = flatCheckboxItems;
      }
      
      this.initialized = true;
      console.log('Storage initialization complete');
      resolve();
    } catch (error) {
      console.error('Error initializing storage:', error);
      
      // Report initialization error
      figma.ui.postMessage({ 
        type: 'reportError', 
        error: error.message,
        category: 'STORAGE',
        severity: 'CRITICAL',
        context: { operation: 'initialization' }
      });
      
      // Initialize with empty values in case of failure
      this.cache.checkboxStates = {};
      this.cache.modifiedDates = {};
      this.cache.viewStates = {};
      this.cache.userPreferences = { hideCompleted: false };
      this.cache.customRules = null;
      this.cache.flatCheckboxItems = [];
      
      this.initialized = true; // Still mark as initialized to avoid getting stuck
      resolve(); // Resolve anyway to allow the plugin to function, albeit with default values
    }
  });
  
  return this.initPromise;
};

// Override init method to use our error handling version
const originalInit = StorageManager.prototype.init;
StorageManager.prototype.init = function() {
  return this.initWithErrorHandling();
};

// Replace get/set methods with error handling versions
const originalGet = StorageManager.prototype.get;
StorageManager.prototype.get = function(key, defaultValue) {
  if (!this.initialized) {
    figma.ui.postMessage({ 
      type: 'reportError', 
      error: 'Storage accessed before initialization',
      category: 'STORAGE',
      severity: 'WARNING',
      context: { key, operation: 'get' }
    });
  }
  return originalGet.call(this, key, defaultValue);
};

const originalSet = StorageManager.prototype.set;
StorageManager.prototype.set = function(key, value) {
  if (!this.initialized) {
    figma.ui.postMessage({ 
      type: 'reportError', 
      error: 'Storage modified before initialization',
      category: 'STORAGE',
      severity: 'WARNING',
      context: { key, operation: 'set' }
    });
  }
  return originalSet.call(this, key, value);
};
