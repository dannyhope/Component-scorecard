#!/usr/bin/env node

/**
 * Build script for Component Scorecard plugin
 * 
 * This script handles the build process for development and production builds.
 * It processes source files according to the build-config.js settings.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('./build-config');

// Get build mode from command line arguments
const args = process.argv.slice(2);
const mode = args.includes('--production') ? 'production' : 'development';
const modeConfig = config.modes[mode];
const shouldWatch = args.includes('--watch');
const shouldTest = args.includes('--test');
const outputDir = config.output[mode];

// Print banner
console.log(`
┌───────────────────────────────────────┐
│  Component Scorecard Plugin Builder   │
└───────────────────────────────────────┘
`);

console.log(`🛠️  Building in ${mode} mode...`);
console.log(`📂 Output directory: ${outputDir}`);

// Create output directories
ensureDirectoryExists(config.output.base);
ensureDirectoryExists(outputDir);

// Start build process
async function build() {
  try {
    const startTime = Date.now();
    
    // 1. Clean output directory
    await cleanDirectory(outputDir);
    
    // 2. Collect all files to include in build
    const filesToInclude = collectBuildFiles();
    console.log(`📋 Including ${filesToInclude.length} files in build`);
    
    // 3. Process and copy files
    await processFiles(filesToInclude);
    
    // 4. Update manifest with build info
    await updateManifest();
    
    // 5. Run tests if requested
    if (shouldTest) {
      await runTests();
    }
    
    // 6. Bundle files if enabled
    if (config.bundling.enabled) {
      await bundleFiles();
    }
    
    const buildTime = (Date.now() - startTime) / 1000;
    console.log(`✅ Build completed in ${buildTime.toFixed(2)}s`);
    
    // 7. Start watch mode if requested
    if (shouldWatch) {
      console.log('👀 Watching for changes...');
      startWatchMode();
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Clean directory but preserve .gitkeep
async function cleanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    if (file === '.gitkeep') continue;
    
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      await cleanDirectory(filePath);
      fs.rmdirSync(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
  }
  
  console.log(`🧹 Cleaned directory: ${dir}`);
}

// Collect all files to include in build
function collectBuildFiles() {
  let files = [...config.coreFiles];
  
  // Add optional files based on build mode
  if (modeConfig.includeTests) {
    files = files.concat(config.optionalFiles.test || []);
  }
  
  return files;
}

// Process and copy all build files
async function processFiles(files) {
  for (const file of files) {
    const sourcePath = path.resolve(file);
    const relativePath = path.relative('plugin', file.startsWith('plugin/') ? file : `plugin/${path.basename(file)}`);
    const destPath = path.join(outputDir, relativePath);
    
    // Ensure destination directory exists
    ensureDirectoryExists(path.dirname(destPath));
    
    // Process file based on its type
    if (file.endsWith('.js')) {
      await processJavaScriptFile(sourcePath, destPath);
    } else if (file.endsWith('.html')) {
      await processHtmlFile(sourcePath, destPath);
    } else if (file.endsWith('.json')) {
      await processJsonFile(sourcePath, destPath);
    } else {
      // Just copy other files
      fs.copyFileSync(sourcePath, destPath);
    }
    
    console.log(`📄 Processed: ${relativePath}`);
  }
}

// Process JavaScript files
async function processJavaScriptFile(sourcePath, destPath) {
  let content = fs.readFileSync(sourcePath, 'utf8');
  
  // Add build information
  content = addBuildInfo(content, path.basename(sourcePath));
  
  // Process source maps
  if (modeConfig.sourceMaps) {
    // Add source map comment
    content += `\n//# sourceMappingURL=${path.basename(destPath)}.map`;
    
    // Create a simple source map
    const sourceMap = {
      version: 3,
      file: path.basename(destPath),
      sources: [path.basename(sourcePath)],
      mappings: '', // Empty mappings for now
      sourceContent: [content]
    };
    
    fs.writeFileSync(`${destPath}.map`, JSON.stringify(sourceMap));
  }
  
  // Minify in production
  if (modeConfig.minify) {
    // Simple minification (in a real project, use a proper minifier like terser)
    content = content
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*({|}|\(|\)|\[|\]|;|,|:)\s*/g, '$1'); // Remove whitespace around brackets/punctuation
  }
  
  fs.writeFileSync(destPath, content);
}

// Process HTML files
async function processHtmlFile(sourcePath, destPath) {
  let content = fs.readFileSync(sourcePath, 'utf8');
  
  // Add build information
  content = content.replace('</head>', `  <meta name="build-number" content="${modeConfig.buildNumber}">\n  <meta name="build-mode" content="${mode}">\n  <meta name="build-time" content="${new Date().toISOString()}">\n</head>`);
  
  // In production mode, use bundled scripts if enabled
  if (mode === 'production' && config.bundling.enabled) {
    // Replace individual script references with bundle
    content = content.replace(/<script src="[^"]+\.js"><\/script>\s*/g, '');
    content = content.replace('</head>', `  <script src="${config.bundling.uiBundle}"></script>\n</head>`);
  }
  
  // Basic HTML minification in production
  if (modeConfig.minify) {
    content = content
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\s+</g, '<') // Remove whitespace before tags
      .replace(/>\s+/g, '>') // Remove whitespace after tags
      .replace(/>\s+</g, '><'); // Remove whitespace between tags
  }
  
  fs.writeFileSync(destPath, content);
}

// Process JSON files
async function processJsonFile(sourcePath, destPath) {
  const content = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  
  // Update manifest version if this is the manifest file
  if (path.basename(sourcePath) === 'manifest.json') {
    content.version = config.version;
  }
  
  // Write with pretty formatting in dev, minified in production
  const jsonIndent = modeConfig.minify ? 0 : 2;
  fs.writeFileSync(destPath, JSON.stringify(content, null, jsonIndent));
}

// Update the manifest with build information
async function updateManifest() {
  const manifestPath = path.join(outputDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return;
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Add build metadata
  manifest.buildNumber = modeConfig.buildNumber;
  manifest.buildMode = mode;
  manifest.buildTime = new Date().toISOString();
  
  // Write updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, modeConfig.minify ? 0 : 2));
  console.log('📝 Updated manifest with build information');
}

// Bundle JavaScript files
async function bundleFiles() {
  if (!config.bundling.enabled) return;
  
  console.log('📦 Bundling files...');
  
  // Create UI bundle (all JS files except code.js)
  const uiFiles = collectBuildFiles()
    .filter(file => file.endsWith('.js') && !file.includes('code.js'))
    .filter(file => !config.bundling.excludeFiles.includes(file));
  
  let uiBundle = '';
  for (const file of uiFiles) {
    uiBundle += fs.readFileSync(path.resolve(file), 'utf8') + '\n';
  }
  
  // Add build info to bundle
  uiBundle = addBuildInfo(uiBundle, config.bundling.uiBundle);
  
  // Write UI bundle
  fs.writeFileSync(path.join(outputDir, config.bundling.uiBundle), uiBundle);
  console.log(`📦 Created UI bundle: ${config.bundling.uiBundle}`);
  
  // Create code bundle (just code.js, which runs in the plugin context)
  const codeFiles = collectBuildFiles()
    .filter(file => file.includes('code.js'));
  
  if (codeFiles.length > 0) {
    let codeBundle = '';
    for (const file of codeFiles) {
      codeBundle += fs.readFileSync(path.resolve(file), 'utf8') + '\n';
    }
    
    // Add build info to bundle
    codeBundle = addBuildInfo(codeBundle, config.bundling.codeBundle);
    
    // Write code bundle
    fs.writeFileSync(path.join(outputDir, config.bundling.codeBundle), codeBundle);
    console.log(`📦 Created code bundle: ${config.bundling.codeBundle}`);
  }
}

// Run tests
async function runTests() {
  console.log('🧪 Running tests...');
  
  return new Promise((resolve, reject) => {
    exec('node test-runner.js', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Tests failed:', stderr);
        reject(error);
        return;
      }
      
      console.log(stdout);
      console.log('✅ Tests passed');
      resolve();
    });
  });
}

// Start watching for file changes
function startWatchMode() {
  const chokidar = require('chokidar');
  const watchPaths = config.devServer.watchFiles;
  
  const watcher = chokidar.watch(watchPaths, {
    ignored: /(^|[\/\\])\../, // Ignore dot files
    persistent: true
  });
  
  let debounceTimer;
  
  watcher
    .on('change', path => {
      console.log(`🔄 File changed: ${path}`);
      
      // Debounce rebuild to avoid multiple rapid builds
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('🛠️ Rebuilding...');
        build();
      }, config.devServer.reloadDelay);
    })
    .on('error', error => console.error(`Watcher error: ${error}`));
  
  console.log(`👀 Watching ${watchPaths.join(', ')} for changes...`);
}

// Add build information to file content
function addBuildInfo(content, filename) {
  const buildInfo = `
/**
 * ${filename}
 * Build: ${modeConfig.buildNumber}
 * Mode: ${mode}
 * Time: ${new Date().toISOString()}
 */
`;
  
  return buildInfo + content;
}

// Ensure directory exists
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Start build process
build();
