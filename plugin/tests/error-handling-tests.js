/**
 * Tests for the ErrorManager class
 * 
 * Tests error categorization, reporting, and notification integration.
 */

const errorHandlingTests = {
  name: 'Error Handling Tests',
  
  setup(runner) {
    // Create mock notification system for testing
    const mockNotifications = {
      notifications: [],
      error(title, message) {
        this.notifications.push({ type: 'error', title, message });
        return { id: this.notifications.length };
      },
      warning(title, message) {
        this.notifications.push({ type: 'warning', title, message });
        return { id: this.notifications.length };
      },
      info(title, message) {
        this.notifications.push({ type: 'info', title, message });
        return { id: this.notifications.length };
      },
      success(title, message) {
        this.notifications.push({ type: 'success', title, message });
        return { id: this.notifications.length };
      },
      clearAll() {
        this.notifications = [];
      },
      getNotifications() {
        return [...this.notifications];
      }
    };
    
    // Run before all tests
    runner.beforeAll(() => {
      // Save original notifications
      window._originalNotifications = window.notifications;
      
      // Replace with mock notifications
      window.notifications = mockNotifications;
      
      // Create a new error manager for testing
      window._testErrorManager = new ErrorManager();
    });
    
    // Run after all tests
    runner.afterAll(() => {
      // Restore original notifications
      window.notifications = window._originalNotifications;
      
      // Clean up test error manager
      delete window._testErrorManager;
    });
    
    // Reset notifications before each test
    runner.beforeEach(() => {
      mockNotifications.clearAll();
    });
    
    // Basic Error Reporting Tests
    runner.test('Should report errors with correct categorization', () => {
      const errorManager = window._testErrorManager;
      
      const testError = new Error('Test error message');
      const testCategory = 'STORAGE';
      const testSeverity = 'ERROR';
      const testContext = { key: 'testKey', operation: 'get' };
      
      // Report error
      const errorObj = errorManager.report(testError, testCategory, testSeverity, testContext);
      
      // Check error object properties
      assert.equals(errorObj.message, testError.message, 'Error message should match');
      assert.equals(errorObj.category, errorManager.categories[testCategory], 'Category should match');
      assert.equals(errorObj.severity, errorManager.severity[testSeverity], 'Severity should match');
      assert.isNotNullOrUndefined(errorObj.stack, 'Stack trace should be captured');
      assert.isNotNullOrUndefined(errorObj.timestamp, 'Timestamp should be set');
      assert.equals(errorObj.context.key, testContext.key, 'Context should be preserved');
    });
    
    // Error Notification Tests
    runner.test('Should trigger notifications based on severity', () => {
      const errorManager = window._testErrorManager;
      
      // Report errors with different severities
      errorManager.report('Critical error', 'PLUGIN', 'CRITICAL');
      errorManager.report('Regular error', 'UI', 'ERROR');
      errorManager.report('Warning message', 'COMPONENT', 'WARNING');
      errorManager.report('Info message', 'NETWORK', 'INFO');
      
      // Check notifications
      const notifications = window.notifications.getNotifications();
      
      // Should trigger notifications for critical, error, and warning
      assert.equals(notifications.length, 3, 'Should have triggered 3 notifications');
      
      // Check notification types
      const criticalNotification = notifications.find(n => n.message === 'Critical error');
      const errorNotification = notifications.find(n => n.message === 'Regular error');
      const warningNotification = notifications.find(n => n.message === 'Warning message');
      
      assert.isNotNullOrUndefined(criticalNotification, 'Critical error should trigger notification');
      assert.isNotNullOrUndefined(errorNotification, 'Regular error should trigger notification');
      assert.isNotNullOrUndefined(warningNotification, 'Warning should trigger notification');
      
      // Info messages shouldn't trigger notifications by default
      const infoNotification = notifications.find(n => n.message === 'Info message');
      assert.isNullOrUndefined(infoNotification, 'Info message should not trigger notification');
    });
    
    // Error Listener Tests
    runner.test('Should notify listeners when errors occur', () => {
      const errorManager = window._testErrorManager;
      let listenerCalled = false;
      let reportedError = null;
      
      // Add listener
      errorManager.addListener(error => {
        listenerCalled = true;
        reportedError = error;
      });
      
      // Report error
      const testMessage = 'Listener test error';
      errorManager.report(testMessage, 'STORAGE', 'ERROR');
      
      // Check listener was called
      assert.isTrue(listenerCalled, 'Error listener should be called');
      assert.equals(reportedError.message, testMessage, 'Reported error should match');
    });
    
    // Error Storage Tests
    runner.test('Should store recent errors up to the limit', () => {
      const errorManager = window._testErrorManager;
      
      // Clear existing errors
      errorManager.clearErrors();
      
      // Generate errors beyond the limit
      const maxErrors = errorManager.maxErrors;
      const extraErrors = 10;
      const totalErrors = maxErrors + extraErrors;
      
      for (let i = 0; i < totalErrors; i++) {
        errorManager.report(`Error ${i}`, 'UNKNOWN', 'INFO');
      }
      
      // Check error storage limit
      assert.equals(errorManager.errors.length, maxErrors, 
        `Should only store up to ${maxErrors} errors`);
      
      // Check that the most recent errors are kept
      const latestError = errorManager.errors[0];
      assert.equals(latestError.message, `Error ${totalErrors - 1}`, 
        'Most recent error should be at the beginning');
    });
    
    // Error Category Filtering Tests
    runner.test('Should filter errors by category', () => {
      const errorManager = window._testErrorManager;
      
      // Clear existing errors
      errorManager.clearErrors();
      
      // Add errors with different categories
      errorManager.report('Storage error', 'STORAGE', 'ERROR');
      errorManager.report('UI error', 'UI', 'ERROR');
      errorManager.report('Another storage error', 'STORAGE', 'WARNING');
      
      // Get storage errors
      const storageErrors = errorManager.getErrors('storage');
      
      // Check filtering
      assert.equals(storageErrors.length, 2, 'Should find 2 storage errors');
      assert.isTrue(storageErrors.every(e => e.category === 'storage'), 
        'All filtered errors should be storage category');
    });
  }
};
