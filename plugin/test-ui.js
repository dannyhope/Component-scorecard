/**
 * Test UI for running and visualizing tests within the plugin
 */

class TestUI {
  constructor() {
    this.container = null;
    this.resultsList = null;
    this.summaryElement = null;
    this.statusIndicator = null;
    this.runButton = null;
    this.isVisible = false;
    this.testSuites = {};
  }

  /**
   * Initialize the test UI
   */
  init() {
    // Create the container if it doesn't exist
    if (!this.container) {
      this.create();
    }
    
    // Register test suites
    this.registerTestSuites();
    
    // Add event listeners
    this.addEventListeners();
    
    return this;
  }
  
  /**
   * Create the test UI elements
   */
  create() {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'test-panel';
    this.container.className = 'test-panel';
    this.container.style.display = 'none';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'test-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Test Runner';
    
    this.statusIndicator = document.createElement('span');
    this.statusIndicator.className = 'test-status idle';
    this.statusIndicator.textContent = 'Idle';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'test-close-button';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', 'Close test panel');
    closeButton.addEventListener('click', () => this.hide());
    
    header.appendChild(title);
    header.appendChild(this.statusIndicator);
    header.appendChild(closeButton);
    
    // Create controls
    const controls = document.createElement('div');
    controls.className = 'test-controls';
    
    this.runButton = document.createElement('button');
    this.runButton.className = 'test-run-button';
    this.runButton.textContent = 'Run All Tests';
    this.runButton.addEventListener('click', () => this.runAllTests());
    
    const clearButton = document.createElement('button');
    clearButton.className = 'test-clear-button';
    clearButton.textContent = 'Clear Results';
    clearButton.addEventListener('click', () => this.clearResults());
    
    controls.appendChild(this.runButton);
    controls.appendChild(clearButton);
    
    // Create suites selector
    const suitesSelector = document.createElement('div');
    suitesSelector.className = 'test-suites-selector';
    
    const suitesLabel = document.createElement('label');
    suitesLabel.textContent = 'Test Suites:';
    suitesLabel.setAttribute('for', 'test-suites-select');
    
    this.suitesSelect = document.createElement('select');
    this.suitesSelect.id = 'test-suites-select';
    this.suitesSelect.className = 'test-suites-select';
    
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Tests';
    this.suitesSelect.appendChild(allOption);
    
    suitesSelector.appendChild(suitesLabel);
    suitesSelector.appendChild(this.suitesSelect);
    
    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'test-results-container';
    
    this.resultsList = document.createElement('div');
    this.resultsList.className = 'test-results-list';
    
    resultsContainer.appendChild(this.resultsList);
    
    // Create summary
    this.summaryElement = document.createElement('div');
    this.summaryElement.className = 'test-summary';
    
    // Assemble all elements
    this.container.appendChild(header);
    this.container.appendChild(controls);
    this.container.appendChild(suitesSelector);
    this.container.appendChild(resultsContainer);
    this.container.appendChild(this.summaryElement);
    
    // Add to document
    document.body.appendChild(this.container);
    
    // Add styles
    this.addStyles();
  }
  
  /**
   * Add styles for the test UI
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .test-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        max-height: 80vh;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .test-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background-color: #f5f5f5;
        border-bottom: 1px solid #e0e0e0;
      }
      
      .test-header h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      
      .test-status {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        margin-left: 8px;
      }
      
      .test-status.idle {
        background-color: #e0e0e0;
      }
      
      .test-status.running {
        background-color: #E1F7FF;
        color: #108BC1;
      }
      
      .test-status.passed {
        background-color: #E5F8E8;
        color: #00B400;
      }
      
      .test-status.failed {
        background-color: #FFE8E8;
        color: #E4003D;
      }
      
      .test-close-button {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 0 4px;
        color: #616E73;
      }
      
      .test-controls {
        display: flex;
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
      }
      
      .test-run-button, .test-clear-button {
        padding: 8px 16px;
        border-radius: 4px;
        border: none;
        font-size: 14px;
        cursor: pointer;
        margin-right: 8px;
      }
      
      .test-run-button {
        background-color: #108BC1;
        color: white;
      }
      
      .test-clear-button {
        background-color: #f5f5f5;
        color: #4B565A;
        border: 1px solid #e0e0e0;
      }
      
      .test-suites-selector {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
      }
      
      .test-suites-selector label {
        margin-right: 8px;
        font-size: 14px;
      }
      
      .test-suites-select {
        flex-grow: 1;
        padding: 6px;
        border-radius: 4px;
        border: 1px solid #e0e0e0;
      }
      
      .test-results-container {
        flex-grow: 1;
        overflow-y: auto;
        padding: 12px 16px;
      }
      
      .test-results-list {
        font-family: monospace;
        font-size: 13px;
        line-height: 1.4;
      }
      
      .test-result {
        margin-bottom: 8px;
        padding: 8px;
        border-radius: 4px;
      }
      
      .test-result.passed {
        background-color: #E5F8E8;
      }
      
      .test-result.failed {
        background-color: #FFE8E8;
      }
      
      .test-result.skipped {
        background-color: #FFF8E0;
      }
      
      .test-summary {
        padding: 12px 16px;
        background-color: #f5f5f5;
        border-top: 1px solid #e0e0e0;
        font-size: 14px;
      }
      
      .test-error {
        margin-top: 4px;
        color: #E4003D;
        white-space: pre-wrap;
        font-size: 12px;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Register test suites
   */
  registerTestSuites() {
    // Register built-in test suites
    this.testSuites = {
      'storage': storageTests,
      'error-handling': errorHandlingTests,
      'data-migration': dataMigrationTests
    };
    
    // Add test suites to selector
    for (const [key, suite] of Object.entries(this.testSuites)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = suite.name || key;
      this.suitesSelect.appendChild(option);
    }
  }
  
  /**
   * Add event listeners
   */
  addEventListeners() {
    // Listen for test completions
    if (window.testRunner) {
      testRunner.onComplete(results => {
        this.updateStatus(results);
        this.enableRunButton();
      });
    }
    
    // Listen for suite selection changes
    this.suitesSelect.addEventListener('change', () => {
      this.clearResults();
    });
  }
  
  /**
   * Show the test UI
   */
  show() {
    if (this.container) {
      this.container.style.display = 'flex';
      this.isVisible = true;
    }
    return this;
  }
  
  /**
   * Hide the test UI
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
      this.isVisible = false;
    }
    return this;
  }
  
  /**
   * Toggle the test UI visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
    return this;
  }
  
  /**
   * Run all tests or a specific suite
   */
  runAllTests() {
    if (!window.testRunner) {
      this.showError('Test runner not initialized');
      return;
    }
    
    // Disable run button while tests are running
    this.disableRunButton();
    
    // Clear previous results
    this.clearResults();
    
    // Update status
    this.updateStatus({ running: true });
    
    // Get selected suite
    const selectedSuite = this.suitesSelect.value;
    
    // Run tests based on selection
    if (selectedSuite === 'all') {
      // Run all test suites
      this.runTestSuites(Object.values(this.testSuites));
    } else if (this.testSuites[selectedSuite]) {
      // Run specific suite
      this.runTestSuite(this.testSuites[selectedSuite]);
    } else {
      this.showError(`Unknown test suite: ${selectedSuite}`);
      this.enableRunButton();
    }
  }
  
  /**
   * Run multiple test suites
   * @param {Array} suites - Test suites to run
   */
  async runTestSuites(suites) {
    for (const suite of suites) {
      await this.runTestSuite(suite);
    }
  }
  
  /**
   * Run a specific test suite
   * @param {Object} suite - Test suite to run
   */
  async runTestSuite(suite) {
    if (!window.testRunner) {
      this.showError('Test runner not initialized');
      return;
    }
    
    try {
      // Clear test runner
      testRunner.tests = [];
      testRunner.beforeEachFns = [];
      testRunner.afterEachFns = [];
      testRunner.beforeAllFns = [];
      testRunner.afterAllFns = [];
      
      // Add suite title to results
      const suiteTitle = document.createElement('h3');
      suiteTitle.textContent = suite.name || 'Unnamed Test Suite';
      this.resultsList.appendChild(suiteTitle);
      
      // Set up the test suite
      suite.setup(testRunner);
      
      // Run the tests
      const results = await testRunner.run(false, false);
      
      // Display results
      this.displayResults(testRunner.getLogs());
      
      return results;
    } catch (error) {
      this.showError(`Error running test suite: ${error.message}`);
      console.error('Test suite error:', error);
    }
  }
  
  /**
   * Display test results
   * @param {Array} logs - Test logs
   */
  displayResults(logs) {
    for (const log of logs) {
      const logElement = document.createElement('div');
      
      if (log.includes('PASSED:')) {
        logElement.className = 'test-result passed';
      } else if (log.includes('FAILED:')) {
        logElement.className = 'test-result failed';
      } else if (log.includes('SKIPPED:')) {
        logElement.className = 'test-result skipped';
      } else if (log.includes('Error:')) {
        logElement.className = 'test-error';
      } else if (log.includes('TEST SUMMARY')) {
        // Start a new summary section
        const summaryTitle = document.createElement('h3');
        summaryTitle.textContent = 'Test Summary';
        this.resultsList.appendChild(summaryTitle);
        continue;
      }
      
      logElement.textContent = log;
      this.resultsList.appendChild(logElement);
    }
    
    // Scroll to bottom of results
    this.resultsList.scrollTop = this.resultsList.scrollHeight;
  }
  
  /**
   * Show an error message
   * @param {string} message - Error message
   */
  showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'test-error';
    errorElement.textContent = message;
    this.resultsList.appendChild(errorElement);
    
    // Update summary
    this.summaryElement.textContent = 'Tests failed to run';
    this.updateStatus({ failed: 1, passed: 0, total: 1 });
  }
  
  /**
   * Clear test results
   */
  clearResults() {
    if (this.resultsList) {
      this.resultsList.innerHTML = '';
    }
    
    if (this.summaryElement) {
      this.summaryElement.textContent = '';
    }
    
    this.updateStatus({ idle: true });
  }
  
  /**
   * Update the status indicator
   * @param {Object} results - Test results
   */
  updateStatus(results) {
    if (!this.statusIndicator) return;
    
    if (results.idle) {
      this.statusIndicator.className = 'test-status idle';
      this.statusIndicator.textContent = 'Idle';
    } else if (results.running) {
      this.statusIndicator.className = 'test-status running';
      this.statusIndicator.textContent = 'Running';
    } else if (results.failed && results.failed > 0) {
      this.statusIndicator.className = 'test-status failed';
      this.statusIndicator.textContent = `${results.failed} Failed`;
      
      // Update summary
      if (this.summaryElement) {
        this.summaryElement.textContent = `Passed: ${results.passed} | Failed: ${results.failed} | Total: ${results.total}`;
      }
    } else {
      this.statusIndicator.className = 'test-status passed';
      this.statusIndicator.textContent = 'Passed';
      
      // Update summary
      if (this.summaryElement) {
        this.summaryElement.textContent = `All ${results.passed} tests passed`;
      }
    }
  }
  
  /**
   * Disable the run button
   */
  disableRunButton() {
    if (this.runButton) {
      this.runButton.disabled = true;
      this.runButton.textContent = 'Running...';
    }
  }
  
  /**
   * Enable the run button
   */
  enableRunButton() {
    if (this.runButton) {
      this.runButton.disabled = false;
      this.runButton.textContent = 'Run Tests';
    }
  }
}

// Create global instance
window.testUI = new TestUI();
