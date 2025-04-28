/**
 * Build configuration for Component Scorecard plugin
 * 
 * This defines the build process settings, including:
 * - Source files and their order
 * - Build output location
 * - Development vs production settings
 * - Version information
 */

module.exports = {
  // Plugin version (used in manifest and builds)
  version: '1.0.0',
  
  // Build modes
  modes: {
    development: {
      minify: false,
      sourceMaps: true,
      includeTests: true,
      buildNumber: 'dev'
    },
    production: {
      minify: true,
      sourceMaps: false, 
      includeTests: false,
      buildNumber: Date.now().toString()
    }
  },
  
  // Core files (always included)
  coreFiles: [
    // UI files
    'plugin/ui.html',
    'plugin/manifest.json',
    
    // JavaScript files (in order of dependency)
    'plugin/virtual-list.js',
    'plugin/state-machine.js',
    'plugin/error-manager.js',
    'plugin/notification-manager.js',
    'plugin/plugin-states.js',
    'plugin/storage-error-integration.js',
    'plugin/code.js'
  ],
  
  // Optional files included based on build mode
  optionalFiles: {
    test: [
      'plugin/test-framework.js',
      'plugin/test-ui.js',
      'plugin/tests/storage-tests.js',
      'plugin/tests/error-handling-tests.js',
      'plugin/tests/data-migration-tests.js'
    ]
  },
  
  // Output directory structure
  output: {
    base: 'dist',
    development: 'dist/dev',
    production: 'dist/production'
  },
  
  // Bundling settings for JavaScript
  bundling: {
    enabled: true,
    excludeFiles: [
      'plugin/ui.html',
      'plugin/manifest.json'
    ],
    uiBundle: 'bundle-ui.js',
    codeBundle: 'bundle-code.js'
  },
  
  // Development server settings
  devServer: {
    port: 8080,
    watchFiles: ['plugin/**/*'],
    reloadDelay: 500
  }
};
