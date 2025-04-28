/**
 * ErrorManager - Centralized error handling for the Component Scorecard plugin
 * 
 * Provides consistent error reporting, categorization, and user feedback.
 */

class ErrorManager {
  constructor() {
    this.errors = [];
    this.maxErrors = 50; // Limit stored errors
    this.listeners = [];
    
    // Error categories
    this.categories = {
      STORAGE: 'storage',
      NETWORK: 'network',
      UI: 'ui',
      COMPONENT: 'component',
      PLUGIN: 'plugin',
      UNKNOWN: 'unknown'
    };
    
    // Severity levels
    this.severity = {
      CRITICAL: 'critical',   // App can't continue
      ERROR: 'error',         // Feature broken
      WARNING: 'warning',     // Can continue with caution
      INFO: 'info'            // Informational only
    };
  }
  
  /**
   * Report an error to the system
   * @param {Error|string} error - The error object or message
   * @param {string} category - Error category
   * @param {string} severity - Error severity
   * @param {Object} context - Additional context about where/why the error occurred
   * @returns {Object} The created error object
   */
  report(error, category, severity, context = {}) {
    const errorObj = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      timestamp: new Date().toISOString(),
      category: this.categories[category] || this.categories.UNKNOWN,
      severity: this.severity[severity] || this.severity.ERROR,
      context: JSON.parse(JSON.stringify(context)) // Ensure serializable
    };
    
    // Log to console with appropriate formatting
    this.logToConsole(errorObj);
    
    // Store error
    this.errors.unshift(errorObj);
    if (this.errors.length > this.maxErrors) {
      this.errors.pop();
    }
    
    // Notify listeners
    this.notifyListeners(errorObj);
    
    // Handle based on severity
    this.handleBySeverity(errorObj);
    
    return errorObj;
  }
  
  /**
   * Format and log the error to console based on severity
   * @param {Object} errorObj - The error object to log
   */
  logToConsole(errorObj) {
    const { message, category, severity, context, stack } = errorObj;
    
    // Format based on severity
    switch (severity) {
      case this.severity.CRITICAL:
        console.error(`🔴 CRITICAL [${category}]: ${message}`, context);
        if (stack) console.error(stack);
        break;
      case this.severity.ERROR:
        console.error(`🔴 ERROR [${category}]: ${message}`, context);
        if (stack) console.error(stack);
        break;
      case this.severity.WARNING:
        console.warn(`🟡 WARNING [${category}]: ${message}`, context);
        break;
      case this.severity.INFO:
        console.info(`ℹ️ INFO [${category}]: ${message}`, context);
        break;
    }
  }
  
  /**
   * Take different actions based on error severity
   * @param {Object} errorObj - The error object to handle
   */
  handleBySeverity(errorObj) {
    const { severity, category, message } = errorObj;
    
    // Critical errors need immediate attention
    if (severity === this.severity.CRITICAL) {
      // Notify UI to show error message
      if (window.pluginStateMachine) {
        pluginStateMachine.transition('error', { 
          error: message,
          category,
          severity
        });
      } else if (window.notifications) {
        // Fall back to notifications if available
        notifications.error(`${category.toUpperCase()} Error`, message);
      }
    } 
    // Regular errors show notification but don't transition state
    else if (severity === this.severity.ERROR) {
      if (window.notifications) {
        notifications.error(`${category.toUpperCase()} Error`, message);
      }
    }
    // Warnings use the warning notification
    else if (severity === this.severity.WARNING) {
      if (window.notifications) {
        notifications.warning(`${category.toUpperCase()} Warning`, message);
      }
    }
    
    // Storage errors might need retry logic
    if (category === this.categories.STORAGE && 
        (severity === this.severity.ERROR || severity === this.severity.CRITICAL)) {
      // Post message to plugin for retry if applicable
      if (window.parent) {
        window.parent.postMessage({ 
          pluginMessage: { 
            type: 'storageRetry', 
            key: errorObj.context?.key || 'unknown',
            attempt: errorObj.context?.attempt || 1,
            maxRetries: errorObj.context?.maxRetries || 3
          } 
        }, '*');
      }
    }
  }
  
  /**
   * Add a listener for new errors
   * @param {Function} listener - Function to call when new errors occur
   * @returns {boolean} Whether the listener was added successfully
   */
  addListener(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
      return true;
    }
    return false;
  }
  
  /**
   * Remove a previously added listener
   * @param {Function} listener - The listener function to remove
   * @returns {boolean} Whether the listener was removed
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Notify all listeners about a new error
   * @param {Object} errorObj - The error that occurred
   */
  notifyListeners(errorObj) {
    this.listeners.forEach(listener => {
      try {
        listener(errorObj);
      } catch (error) {
        console.error('Error in error listener:', error);
      }
    });
  }
  
  /**
   * Get recent errors, optionally filtered by category
   * @param {string|null} category - Category to filter by, or null for all
   * @param {number} limit - Maximum number of errors to return
   * @returns {Array} Array of error objects
   */
  getErrors(category = null, limit = 10) {
    if (category) {
      return this.errors
        .filter(e => e.category === category)
        .slice(0, limit);
    }
    return this.errors.slice(0, limit);
  }
  
  /**
   * Clear all stored errors
   */
  clearErrors() {
    this.errors = [];
  }
  
  /**
   * Handle a try/catch block with standard error reporting
   * @param {Function} fn - Function to try
   * @param {string} category - Error category
   * @param {string} severity - Error severity
   * @param {Object} context - Error context
   * @returns {Promise} Promise that resolves with the function result or rejects with the error
   */
  async try(fn, category, severity, context = {}) {
    try {
      return await fn();
    } catch (error) {
      this.report(error, category, severity, context);
      throw error; // Re-throw for caller to handle
    }
  }
}

// Create global instance
window.errorManager = new ErrorManager();
