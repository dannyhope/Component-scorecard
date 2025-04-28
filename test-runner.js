#!/usr/bin/env node

/**
 * Test runner for Component Scorecard plugin
 * 
 * This script uses Puppeteer to open a headless browser,
 * load the plugin UI, and run the automated tests.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const handler = require('serve-handler');
const puppeteer = require('puppeteer');

// Configuration
const SERVER_PORT = 3000;
const TEST_TIMEOUT = 30000; // 30 seconds
const OUTPUT_DIR = path.join(__dirname, 'test-results');
const DIST_DIR = path.join(__dirname, 'dist/dev');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Main test function
async function runTests() {
  console.log('🧪 Starting test runner...');
  
  let server;
  let browser;
  
  try {
    // Start local server to serve the plugin files
    server = await startServer();
    console.log(`🌐 Test server running on http://localhost:${SERVER_PORT}`);
    
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Run tests in browser
    const testResults = await runBrowserTests(browser);
    
    // Process and display results
    displayResults(testResults);
    
    // Check for test failures
    if (testResults.failed > 0) {
      process.exit(1);
    }
    
    console.log('✅ All tests completed successfully');
    
  } catch (error) {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  } finally {
    // Clean up
    if (browser) await browser.close();
    if (server) server.close();
  }
}

// Start a local server to serve the plugin files
function startServer() {
  return new Promise((resolve, reject) => {
    // Create a simple server using serve-handler
    const server = http.createServer((request, response) => {
      return handler(request, response, {
        public: DIST_DIR,
        headers: [
          {
            source: '**/*',
            headers: [
              { key: 'Access-Control-Allow-Origin', value: '*' }
            ]
          }
        ]
      });
    });
    
    server.listen(SERVER_PORT, err => {
      if (err) {
        reject(err);
      } else {
        resolve(server);
      }
    });
  });
}

// Run tests in the browser
async function runBrowserTests(browser) {
  const page = await browser.newPage();
  
  // Set up console log capturing
  const consoleMessages = [];
  page.on('console', message => {
    const type = message.type();
    const text = message.text();
    consoleMessages.push({ type, text });
    
    // Output to console with color coding
    if (type === 'error') {
      console.error(`🔴 ${text}`);
    } else if (type === 'warning') {
      console.warn(`🟡 ${text}`);
    } else if (text.includes('PASSED:') || text.includes('All tests passed')) {
      console.log(`✅ ${text}`);
    } else if (text.includes('FAILED:') || text.includes('failed')) {
      console.error(`❌ ${text}`);
    } else {
      console.log(`   ${text}`);
    }
  });
  
  // Set up error handling
  page.on('pageerror', error => {
    consoleMessages.push({ type: 'pageerror', text: error.message });
    console.error(`🔴 Page error: ${error.message}`);
  });
  
  // Set up response error capturing
  page.on('response', response => {
    if (!response.ok()) {
      consoleMessages.push({ 
        type: 'responseerror', 
        text: `${response.status()} ${response.url()}`
      });
    }
  });
  
  // Navigate to the test page
  const testUrl = `http://localhost:${SERVER_PORT}/ui.html`;
  await page.goto(testUrl, { waitUntil: 'networkidle0' });
  
  // Create a test environment that simulates Figma plugin environment
  await page.evaluate(() => {
    // Mock the parent figma object
    window.parent = {
      postMessage: message => {
        console.log('Plugin message:', message.pluginMessage?.type || 'unknown');
      }
    };
    
    // Mock figma object
    window.figma = {
      clientStorage: {
        async getAsync(key) {
          const stored = localStorage.getItem(key);
          return stored ? JSON.parse(stored) : null;
        },
        async setAsync(key, value) {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        }
      },
      ui: {
        onmessage: null,
        postMessage: message => {
          console.log('UI message:', message.type || 'unknown');
          if (window.onmessage && message) {
            window.onmessage({ data: { pluginMessage: message } });
          }
        }
      },
      root: { children: [] },
      currentPage: { selection: [] }
    };
  });
  
  // Inject test initialization code
  await page.evaluate(() => {
    // Initialize test UI if available
    if (window.testUI) {
      testUI.init();
    } else {
      console.error('Test UI not initialized');
    }
    
    // Create global test results
    window.testResults = {
      completed: false,
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      errors: []
    };
    
    // Set up test completion handler
    if (window.testRunner) {
      testRunner.onComplete(results => {
        window.testResults = {
          ...results,
          completed: true
        };
      });
    }
  });
  
  // Run all tests
  await page.evaluate(() => {
    try {
      // Run all test suites
      const suites = {
        storage: storageTests,
        'error-handling': errorHandlingTests,
        'data-migration': dataMigrationTests
      };
      
      // Create promise to run all test suites sequentially
      const runAllSuites = async () => {
        for (const [name, suite] of Object.entries(suites)) {
          console.log(`Running ${name} test suite...`);
          
          // Clear test runner
          testRunner.tests = [];
          testRunner.beforeEachFns = [];
          testRunner.afterEachFns = [];
          testRunner.beforeAllFns = [];
          testRunner.afterAllFns = [];
          
          // Set up the test suite
          suite.setup(testRunner);
          
          // Run the tests
          await testRunner.run(false, false);
        }
      };
      
      return runAllSuites();
    } catch (error) {
      console.error('Error running tests:', error);
      window.testResults.errors.push(error.message);
    }
  });
  
  // Wait for tests to complete (up to timeout)
  await page.waitForFunction('window.testResults.completed === true', { 
    timeout: TEST_TIMEOUT 
  }).catch(error => {
    console.error('Test timeout or error:', error.message);
    throw new Error('Tests did not complete within the timeout period');
  });
  
  // Get test results
  const testResults = await page.evaluate(() => window.testResults);
  
  // Take screenshot of test results
  await page.screenshot({ 
    path: path.join(OUTPUT_DIR, 'test-results.png'),
    fullPage: true
  });
  
  // Save console logs
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'test-logs.json'), 
    JSON.stringify(consoleMessages, null, 2)
  );
  
  return testResults;
}

// Display test results in a readable format
function displayResults(results) {
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total tests:   ${results.total}`);
  console.log(`Passed:        ${results.passed}`);
  console.log(`Failed:        ${results.failed}`);
  console.log(`Skipped:       ${results.skipped}`);
  
  const successRate = results.total > 0 
    ? Math.round((results.passed / results.total) * 100) 
    : 0;
  
  console.log(`Success rate:  ${successRate}%`);
  
  if (results.errors && results.errors.length > 0) {
    console.log('\n❌ ERRORS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    results.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the tests
runTests();
