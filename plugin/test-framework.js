/**
 * Simple testing framework for Figma plugins
 * 
 * This provides a lightweight testing framework that can run 
 * directly within the plugin environment.
 */

class TestRunner {
  constructor() {
    this.tests = [];
    this.beforeEachFns = [];
    this.afterEachFns = [];
    this.beforeAllFns = [];
    this.afterAllFns = [];
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0
    };
    this.isRunning = false;
    this.currentTestIndex = 0;
    this.testTimeout = 2000; // Default timeout of 2 seconds
    this.logs = [];
    this.onCompleteCallbacks = [];
  }

  /**
   * Add a test
   * @param {string} description - Test description
   * @param {Function} testFn - Test function
   * @param {boolean} skip - Whether to skip this test
   */
  test(description, testFn, skip = false) {
    this.tests.push({
      description,
      fn: testFn,
      skip
    });
    return this;
  }

  /**
   * Add a test to be skipped
   * @param {string} description - Test description
   * @param {Function} testFn - Test function
   */
  skip(description, testFn) {
    return this.test(description, testFn, true);
  }

  /**
   * Add a function to run before each test
   * @param {Function} fn - Function to run before each test
   */
  beforeEach(fn) {
    this.beforeEachFns.push(fn);
    return this;
  }

  /**
   * Add a function to run after each test
   * @param {Function} fn - Function to run after each test
   */
  afterEach(fn) {
    this.afterEachFns.push(fn);
    return this;
  }

  /**
   * Add a function to run before all tests
   * @param {Function} fn - Function to run before all tests
   */
  beforeAll(fn) {
    this.beforeAllFns.push(fn);
    return this;
  }

  /**
   * Add a function to run after all tests
   * @param {Function} fn - Function to run after all tests
   */
  afterAll(fn) {
    this.afterAllFns.push(fn);
    return this;
  }

  /**
   * Set the test timeout
   * @param {number} ms - Timeout in milliseconds
   */
  setTimeout(ms) {
    this.testTimeout = ms;
    return this;
  }

  /**
   * Add a callback to run when all tests are complete
   * @param {Function} callback - Callback function
   */
  onComplete(callback) {
    this.onCompleteCallbacks.push(callback);
    return this;
  }

  /**
   * Run all tests
   * @param {boolean} stopOnFail - Whether to stop on first failure
   * @param {boolean} clearConsole - Whether to clear the console before running
   */
  async run(stopOnFail = false, clearConsole = true) {
    if (this.isRunning) {
      this.log('Tests are already running');
      return;
    }

    this.isRunning = true;
    this.currentTestIndex = 0;
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: this.tests.length
    };
    this.logs = [];

    if (clearConsole) {
      console.clear();
    }

    this.log(`🧪 Running ${this.tests.length} tests...`);
    
    try {
      // Run beforeAll hooks
      for (const beforeAllFn of this.beforeAllFns) {
        await beforeAllFn();
      }

      // Run tests
      for (let i = 0; i < this.tests.length; i++) {
        this.currentTestIndex = i;
        const test = this.tests[i];
        
        if (test.skip) {
          this.results.skipped++;
          this.log(`⏩ SKIPPED: ${test.description}`);
          continue;
        }

        try {
          // Run beforeEach hooks
          for (const beforeEachFn of this.beforeEachFns) {
            await beforeEachFn();
          }

          // Run the test with timeout
          const testResult = await this.runWithTimeout(test);
          
          // Run afterEach hooks
          for (const afterEachFn of this.afterEachFns) {
            await afterEachFn();
          }

          if (testResult.passed) {
            this.results.passed++;
            this.log(`✅ PASSED: ${test.description}`);
          } else {
            this.results.failed++;
            this.log(`❌ FAILED: ${test.description}`);
            this.log(`   Error: ${testResult.error.message}`);
            if (testResult.error.stack) {
              this.log(`   Stack: ${testResult.error.stack}`);
            }
            
            if (stopOnFail) {
              this.log('Stopping tests due to failure');
              break;
            }
          }
        } catch (error) {
          this.results.failed++;
          this.log(`❌ FAILED: ${test.description}`);
          this.log(`   Error: ${error.message}`);
          if (error.stack) {
            this.log(`   Stack: ${error.stack}`);
          }
          
          if (stopOnFail) {
            this.log('Stopping tests due to failure');
            break;
          }
        }
      }

      // Run afterAll hooks
      for (const afterAllFn of this.afterAllFns) {
        await afterAllFn();
      }
    } catch (error) {
      this.log(`⚠️ Test runner error: ${error.message}`);
      if (error.stack) {
        this.log(`   Stack: ${error.stack}`);
      }
    }

    // Log summary
    this.logSummary();
    
    // Call onComplete callbacks
    for (const callback of this.onCompleteCallbacks) {
      try {
        callback(this.results);
      } catch (error) {
        this.log(`Error in onComplete callback: ${error.message}`);
      }
    }

    this.isRunning = false;
    return this.results;
  }

  /**
   * Run a test with timeout
   * @param {Object} test - Test object
   * @returns {Object} Test result
   */
  async runWithTimeout(test) {
    return new Promise(resolve => {
      let timeoutId;
      
      const testPromise = Promise.resolve().then(() => test.fn());
      
      // Set timeout
      if (this.testTimeout > 0) {
        timeoutId = setTimeout(() => {
          resolve({
            passed: false,
            error: new Error(`Test timed out after ${this.testTimeout}ms`)
          });
        }, this.testTimeout);
      }
      
      // Wait for test to complete
      testPromise.then(() => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve({
          passed: true
        });
      }).catch(error => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve({
          passed: false,
          error
        });
      });
    });
  }

  /**
   * Log a message
   * @param {string} message - Message to log
   */
  log(message) {
    this.logs.push(message);
    console.log(message);
  }

  /**
   * Log test summary
   */
  logSummary() {
    const totalRun = this.results.passed + this.results.failed;
    const percentPassed = totalRun > 0 ? Math.round((this.results.passed / totalRun) * 100) : 0;
    
    this.log('\n📊 TEST SUMMARY');
    this.log(`Total: ${this.results.total}`);
    this.log(`Passed: ${this.results.passed}`);
    this.log(`Failed: ${this.results.failed}`);
    this.log(`Skipped: ${this.results.skipped}`);
    this.log(`Success rate: ${percentPassed}%`);
    
    if (this.results.failed === 0 && this.results.skipped === 0) {
      this.log('🎉 All tests passed!');
    } else if (this.results.failed === 0) {
      this.log('🟡 All run tests passed, but some were skipped');
    } else {
      this.log('🔴 Some tests failed');
    }
  }

  /**
   * Get the test logs
   * @returns {Array} Test logs
   */
  getLogs() {
    return [...this.logs];
  }
}

/**
 * Assertion functions for tests
 */
class Assert {
  /**
   * Assert that a value is truthy
   * @param {any} value - Value to check
   * @param {string} message - Optional assertion message
   */
  static isTrue(value, message = 'Expected value to be truthy') {
    if (!value) {
      throw new Error(message);
    }
  }

  /**
   * Assert that a value is falsy
   * @param {any} value - Value to check
   * @param {string} message - Optional assertion message
   */
  static isFalse(value, message = 'Expected value to be falsy') {
    if (value) {
      throw new Error(message);
    }
  }

  /**
   * Assert that two values are equal
   * @param {any} actual - Actual value
   * @param {any} expected - Expected value
   * @param {string} message - Optional assertion message
   */
  static equals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
    }
  }

  /**
   * Assert that two values are not equal
   * @param {any} actual - Actual value
   * @param {any} expected - Expected value
   * @param {string} message - Optional assertion message
   */
  static notEquals(actual, expected, message) {
    if (actual === expected) {
      throw new Error(message || `Expected ${JSON.stringify(actual)} not to equal ${JSON.stringify(expected)}`);
    }
  }

  /**
   * Assert that a value is null or undefined
   * @param {any} value - Value to check
   * @param {string} message - Optional assertion message
   */
  static isNullOrUndefined(value, message) {
    if (value !== null && value !== undefined) {
      throw new Error(message || `Expected ${JSON.stringify(value)} to be null or undefined`);
    }
  }

  /**
   * Assert that a value is not null or undefined
   * @param {any} value - Value to check
   * @param {string} message - Optional assertion message
   */
  static isNotNullOrUndefined(value, message) {
    if (value === null || value === undefined) {
      throw new Error(message || 'Expected value not to be null or undefined');
    }
  }

  /**
   * Assert that a function throws an error
   * @param {Function} fn - Function to check
   * @param {string|RegExp} expectedError - Expected error message or pattern
   * @param {string} message - Optional assertion message
   */
  static throws(fn, expectedError, message) {
    try {
      fn();
      throw new Error(message || 'Expected function to throw an error');
    } catch (error) {
      if (expectedError) {
        if (expectedError instanceof RegExp) {
          if (!expectedError.test(error.message)) {
            throw new Error(message || `Expected error message to match ${expectedError}, but got ${error.message}`);
          }
        } else if (error.message !== expectedError) {
          throw new Error(message || `Expected error message to be ${expectedError}, but got ${error.message}`);
        }
      }
    }
  }

  /**
   * Assert that a function does not throw an error
   * @param {Function} fn - Function to check
   * @param {string} message - Optional assertion message
   */
  static doesNotThrow(fn, message) {
    try {
      fn();
    } catch (error) {
      throw new Error(message || `Expected function not to throw an error, but got ${error.message}`);
    }
  }

  /**
   * Assert that a value is an instance of a class
   * @param {any} value - Value to check
   * @param {Function} expectedClass - Expected class
   * @param {string} message - Optional assertion message
   */
  static instanceOf(value, expectedClass, message) {
    if (!(value instanceof expectedClass)) {
      throw new Error(message || `Expected ${value} to be an instance of ${expectedClass.name}`);
    }
  }

  /**
   * Assert that an array or string has a specific length
   * @param {Array|string} value - Value to check
   * @param {number} expectedLength - Expected length
   * @param {string} message - Optional assertion message
   */
  static hasLength(value, expectedLength, message) {
    if (!value || value.length !== expectedLength) {
      throw new Error(message || `Expected ${JSON.stringify(value)} to have length ${expectedLength}, but got ${value ? value.length : 'undefined'}`);
    }
  }

  /**
   * Assert that an object has a property
   * @param {Object} obj - Object to check
   * @param {string} prop - Property name
   * @param {string} message - Optional assertion message
   */
  static hasProperty(obj, prop, message) {
    if (!obj || !(prop in obj)) {
      throw new Error(message || `Expected object to have property ${prop}`);
    }
  }

  /**
   * Assert that a string matches a regular expression
   * @param {string} value - String to check
   * @param {RegExp} regex - Regular expression to match
   * @param {string} message - Optional assertion message
   */
  static matches(value, regex, message) {
    if (!regex.test(value)) {
      throw new Error(message || `Expected ${value} to match ${regex}`);
    }
  }
}

// Create global instances
window.testRunner = new TestRunner();
window.assert = Assert;
