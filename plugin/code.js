// Import would be at the top, but Figma plugins don't support ES modules
// Instead, we'll use the code directly

class Storage {
  constructor() {
    this.cache = {
      checkboxStates: null,
      modifiedDates: null,
      viewStates: null,
      userPreferences: null,
      customRules: null
    };
    this.initialized = false;
    this.initPromise = null;
  }

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
  
  async getStorageWithFallback(key, defaultValue) {
    try {
      const value = await figma.clientStorage.getAsync(key);
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      console.error(`Error getting ${key} from storage:`, error);
      return defaultValue;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  async getComponentState(componentId) {
    try {
      await this.ensureInitialized();
      return this.cache.checkboxStates[componentId] || {};
    } catch (error) {
      console.error(`Error getting component state for ${componentId}:`, error);
      return {};
    }
  }

  async getAllComponentStates() {
    try {
      await this.ensureInitialized();
      return this.cache.checkboxStates;
    } catch (error) {
      console.error('Error getting all component states:', error);
      return {};
    }
  }

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

  async persist() {
    try {
      await Promise.all([
        figma.clientStorage.setAsync('checkboxStates', this.cache.checkboxStates),
        figma.clientStorage.setAsync('modifiedDates', this.cache.modifiedDates),
        figma.clientStorage.setAsync('viewStates', this.cache.viewStates),
        figma.clientStorage.setAsync('userPreferences', this.cache.userPreferences),
        figma.clientStorage.setAsync('customRules', this.cache.customRules)
      ]);
    } catch (error) {
      console.error('Error persisting storage:', error);
      figma.ui.postMessage({
        type: 'storageError',
        error: 'Failed to save data: ' + error.message
      });
      throw error; // Rethrow so callers know it failed
    }
  }

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

  async getModifiedDates(componentId) {
    try {
      await this.ensureInitialized();
      return this.cache.modifiedDates[componentId] || null;
    } catch (error) {
      console.error(`Error getting modified date for ${componentId}:`, error);
      return null;
    }
  }
  
  async getAllModifiedDates() {
    try {
      await this.ensureInitialized();
      return this.cache.modifiedDates;
    } catch (error) {
      console.error('Error getting all modified dates:', error);
      return {};
    }
  }

  async getViewState(componentId) {
    try {
      await this.ensureInitialized();
      return this.cache.viewStates[componentId] || null;
    } catch (error) {
      console.error(`Error getting view state for ${componentId}:`, error);
      return null;
    }
  }

  async getAllViewStates() {
    try {
      await this.ensureInitialized();
      return this.cache.viewStates;
    } catch (error) {
      console.error('Error getting all view states:', error);
      return {};
    }
  }

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
  
  async getUserPreferences() {
    try {
      await this.ensureInitialized();
      return this.cache.userPreferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return { hideCompleted: false };
    }
  }
  
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
  
  async getCustomRules() {
    try {
      await this.ensureInitialized();
      return this.cache.customRules;
    } catch (error) {
      console.error('Error getting custom rules:', error);
      return null;
    }
  }
  
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
}

// Create storage instance
const storage = new Storage();

// Calculate a component's score
async function calculateComponentScore(componentId) {
  const componentState = await storage.getComponentState(componentId);
  
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
    
  // Fallback to 5 if no rules were found - matches default template
  if (totalRules === 0) {
    totalRules = 5; // Default number of rules in the template
  }

  return { checkedCount, totalRules };
}

// Function to analyze component usage across the document
async function analyzeComponents() {
  const usageCounts = new Map();
  const dependencyCounts = new Map(); // Track how many components are used within each component
  const componentDependencies = new Map(); // Track which components are used within each component
  
  // Set up analysis timeout with more precise control
  let analysisCompleted = false;
  let analysisProgress = 0; // 0-100% progress tracking
  let lastProgressUpdate = Date.now();
  
  const analysisTimeout = setTimeout(() => {
    if (!analysisCompleted) {
      console.error('Component analysis timed out after 10 seconds');
      figma.ui.postMessage({
        type: 'analysisError',
        error: 'Component analysis timed out. Your document may be too large or complex.',
        progress: analysisProgress
      });
    }
  }, 10000); // 10 seconds timeout for the full analysis
  
  // Progress reporting function to keep the UI updated
  const reportProgress = (stage, progress, detail = '') => {
    const now = Date.now();
    // Only send progress updates at most every 250ms to avoid flooding the UI
    if (now - lastProgressUpdate > 250) {
      lastProgressUpdate = now;
      figma.ui.postMessage({
        type: 'analysisProgress',
        stage: stage,
        progress: progress,
        detail: detail
      });
    }
  };
  
  try {
    console.log('Starting component analysis...');
    reportProgress('start', 0, 'Starting component analysis');
    
    // First pass: collect main components using queue-based iteration
    try {
      console.log('First pass: collecting main components...');
      reportProgress('findComponents', 5, 'Finding components');
      
      // Process pages in batches to prevent UI freeze
      const pageCount = figma.root.children.length;
      let processedPages = 0;
      
      for (const page of figma.root.children) {
        try {
          // Calculate and report progress
          processedPages++;
          const pageProgress = Math.floor((processedPages / pageCount) * 30); // First pass = 0-30% progress
          reportProgress('findComponents', 5 + pageProgress, `Finding components on page ${page.name}`);
          
          // Find components on this page
          const pageComponents = page.findAllWithCriteria({
            types: ['COMPONENT']
          });
          
          let processedComponents = 0;
          const componentCount = pageComponents.length;
          
          for (const component of pageComponents) {
            try {
              // Skip variants - only include main components
              if (!component.parent || component.parent.type !== 'COMPONENT_SET') {
                usageCounts.set(component.id, 0);
                dependencyCounts.set(component.id, 0);
                componentDependencies.set(component.id, new Set());
              }
              
              // Update component processing progress within this page
              processedComponents++;
              if (processedComponents % 10 === 0 && componentCount > 20) {
                const detailedProgress = `Processing component ${processedComponents}/${componentCount} on page ${page.name}`;
                reportProgress('findComponents', 5 + pageProgress, detailedProgress);
              }
            } catch (componentError) {
              console.warn(`Skipping component due to error:`, componentError);
              // Continue with next component
            }
          }
          
          console.log(`Found ${pageComponents.length} components on page ${page.name}`);
        } catch (pageError) {
          console.warn(`Error processing page ${page.name}:`, pageError);
          // Continue with next page
        }
      }
      
      console.log(`Found ${usageCounts.size} main components in total`);
      reportProgress('findInstances', 35, 'Finding component instances');
    } catch (firstPassError) {
      console.error('Error in first pass of component analysis:', firstPassError);
      // Continue to second pass with partial data
      reportProgress('findInstances', 35, 'Finding component instances (with errors)');
    }

    // Second pass: analyze instances and build dependency graph using queue-based iteration
    try {
      console.log('Second pass: analyzing component dependencies...');
      
      const pageCount = figma.root.children.length;
      let processedPages = 0;
      
      for (const page of figma.root.children) {
        try {
          // Calculate and report progress
          processedPages++;
          const pageProgress = Math.floor((processedPages / pageCount) * 40); // Second pass = 35-75% progress
          reportProgress('findInstances', 35 + pageProgress, `Finding instances on page ${page.name}`);
          
          // Find instances with query rather than traversal
          const instances = page.findAllWithCriteria({
            types: ['INSTANCE']
          });
          
          console.log(`Found ${instances.length} instances on page ${page.name}`);
          
          // Process instances in chunks to avoid UI freezing
          const CHUNK_SIZE = 50;
          const totalChunks = Math.ceil(instances.length / CHUNK_SIZE);
          
          for (let i = 0; i < instances.length; i += CHUNK_SIZE) {
            const chunk = instances.slice(i, i + CHUNK_SIZE);
            const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
            
            reportProgress(
              'processInstances', 
              35 + pageProgress, 
              `Processing instances chunk ${chunkNumber}/${totalChunks} on page ${page.name}`
            );
            
            // Process each instance in the chunk
            for (const instance of chunk) {
              try {
                if (!instance.mainComponent) continue;
                
                // Find the target component (accounting for variants)
                let targetComponent = instance.mainComponent;
                
                if (targetComponent.parent && targetComponent.parent.type === 'COMPONENT_SET') {
                  const mainVariant = targetComponent.parent.defaultVariant;
                  if (mainVariant) {
                    targetComponent = mainVariant;
                  }
                }

                // Update usage count
                const mainComponentId = targetComponent.id;
                if (usageCounts.has(mainComponentId)) {
                  usageCounts.set(
                    mainComponentId,
                    usageCounts.get(mainComponentId) + 1
                  );
                }
                
                // Find the parent component that contains this instance using iteration instead of recursion
                // This prevents stack overflows in deeply nested components
                let parentNode = instance.parent;
                let depth = 0;
                const MAX_DEPTH = 100; // Set a reasonable limit to prevent infinite loops
                
                while (parentNode && depth < MAX_DEPTH) {
                  if (parentNode.type === 'COMPONENT' && 
                      (!parentNode.parent || parentNode.parent.type !== 'COMPONENT_SET')) {
                    // Found a parent main component that contains this instance
                    if (componentDependencies.has(parentNode.id)) {
                      componentDependencies.get(parentNode.id).add(targetComponent.id);
                    }
                    break;
                  }
                  
                  // Move up to the parent node
                  parentNode = parentNode.parent;
                  depth++;
                  
                  // Safety check - if we hit the depth limit, log warning and break
                  if (depth >= MAX_DEPTH) {
                    console.warn(`Reached maximum ancestry depth (${MAX_DEPTH}) for instance. Possible circular reference.`);
                    break;
                  }
                }
              } catch (instanceError) {
                console.warn('Error processing instance:', instanceError);
                // Continue with next instance
              }
            }
            
            // Yield to the main thread periodically to prevent UI freezing
            // This is a minimal async delay to let event loop run
            if (i + CHUNK_SIZE < instances.length) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
        } catch (pageError) {
          console.warn(`Error processing instances on page ${page.name}:`, pageError);
          // Continue with next page
        }
      }
      
      reportProgress('calculateDependencies', 80, 'Calculating dependency counts');
    } catch (secondPassError) {
      console.error('Error in second pass of component analysis:', secondPassError);
      // Continue with partial data
      reportProgress('calculateDependencies', 80, 'Calculating dependency counts (partial data)');
    }
    
    // Calculate final dependency counts
    try {
      reportProgress('finalizingResults', 90, 'Finalizing component data');
      
      for (const [componentId, dependencies] of componentDependencies) {
        dependencyCounts.set(componentId, dependencies.size);
      }
      
      // Log some stats
      const componentsWithDependencies = Array.from(dependencyCounts.entries())
        .filter(([_, count]) => count > 0);
        
      console.log(`Found dependencies for ${componentsWithDependencies.length} components`);
      
      if (componentsWithDependencies.length > 0) {
        const maxDependencies = Math.max(...Array.from(dependencyCounts.values()));
        console.log(`Maximum dependencies for a single component: ${maxDependencies}`);
      }
    } catch (countError) {
      console.error('Error calculating dependency counts:', countError);
    }

    console.log('Component analysis complete');
    analysisCompleted = true;
    clearTimeout(analysisTimeout);
    
    reportProgress('complete', 100, 'Analysis complete');
    
    return { usageCounts, dependencyCounts };
  } catch (error) {
    console.error('Critical error during component analysis:', error);
    clearTimeout(analysisTimeout);
    
    // Notify UI about the failure
    figma.ui.postMessage({
      type: 'analysisError',
      error: 'Component analysis failed: ' + error.message,
      details: error.stack
    });
    
    // Return empty maps as fallback
    return { 
      usageCounts: new Map(), 
      dependencyCounts: new Map() 
    };
  }
}

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
              // If component doesn't have a modified date or we need to refresh it
              if (!modifiedDates[component.id] || skipCache) {
                // Set the current time as the modification date
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
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Page loading timed out')), 10000);
        })
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
  
  // Listen for document changes
  figma.on('documentchange', async (event) => {
    console.log('Document changed:', event);
    
    // Check if any components were modified in this change
    if (event && event.documentChanges) {
      for (const change of event.documentChanges) {
        // If a node was modified and it's a component
        if (change.type === 'PROPERTY_CHANGE' && change.node && change.node.type === 'COMPONENT') {
          console.log('Component modified:', change.node.name);
          // Update the component's last modified date
          await storage.updateModifiedDates(change.node.id, new Date().toISOString());
        }
      }
    }
    
    // Reload components to reflect any changes
    try {
      await loadComponents();
    } catch (error) {
      console.error('Error reloading components after document change:', error);
    }
  });
  
  // Listen for selection changes
  figma.on('selectionchange', async () => {
    console.log('Selection changed, checking relevant components...');
    await handleSelectionChange();
  });
  
  // Function to handle selection changes and filter components accordingly
  async function handleSelectionChange() {
    const selection = figma.currentPage.selection;
    
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
    
    // Case 2 & 3: Section or frame containing components is selected
    const containedComponentIds = [];
    
    // Process each selected node
    for (const node of selection) {
      // Only check SECTION or FRAME nodes
      if (node.type !== 'SECTION' && node.type !== 'FRAME') continue;
      
      // Find all components within this node
      const findComponents = (parent) => {
        if (!parent.children) return;
        
        for (const child of parent.children) {
          if (child.type === 'COMPONENT') {
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
    
    // If we found components in the selection, filter to show only those
    if (containedComponentIds.length > 0) {
      console.log(`Found ${containedComponentIds.length} components in selected frames/sections`);
      figma.ui.postMessage({
        type: 'filterBySelection',
        selectedComponentIds: containedComponentIds
      });
      return;
    }
    
    // If no special criteria met, show all components
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
  
  // Listen for document changes with targeted detection
  figma.on('documentchange', async (changes) => {
    console.log('Document changed, analyzing changes...');
    let componentsChanged = false;
    let needFullReload = false;
    let changedComponentIds = new Set();
    
    // Process each change
    for (const change of changes.documentChanges) {
      const node = change.node;
      const nodeType = node && node.type ? node.type : 'unknown';
      const nodeId = node && node.id ? node.id : undefined;
      
      // Track specific change types
      if (change.type === 'CREATE') {
        // If a component was created, we need to update our tracking
        if (nodeType === 'COMPONENT') {
          console.log(`New component created: ${nodeId}`);
          
          // Check if we have existing data for this component ID
          // This would happen if a component was deleted and then recreated via undo
          const existingData = await storage.getComponentState(nodeId);
          if (Object.keys(existingData).length > 0) {
            console.log(`Found existing data for component ${nodeId}, likely an undo operation`);
          }
          
          componentsChanged = true;
          changedComponentIds.add(nodeId);
        } else if (nodeType === 'COMPONENT_SET') {
          // Component sets might contain components we need to track
          console.log(`New component set created, checking for components`);
          needFullReload = true;
        } else if (nodeType === 'FRAME' || nodeType === 'GROUP') {
          // Frames or groups might contain components
          console.log(`New ${nodeType} created, checking for nested components`);
          needFullReload = true;
        } else if (nodeType === 'INSTANCE') {
          // Instance creation might affect dependencies
          console.log(`New instance created, will update dependencies`);
          componentsChanged = true;
        }
      } else if (change.type === 'DELETE') {
        // If a known component was deleted, we need to update
        if (nodeType === 'COMPONENT' && knownComponentIds.has(nodeId)) {
          console.log(`Known component deleted: ${nodeId}`);
          // Mark as changed so the UI will update (remove from list)
          componentsChanged = true;
          // Remove from known components but DO NOT delete data from storage
          // This allows the data to be preserved if the user undoes the deletion
          knownComponentIds.delete(nodeId);
        } else if (nodeType === 'COMPONENT_SET' || nodeType === 'FRAME' || nodeType === 'GROUP') {
          // These might have contained components
          console.log(`${nodeType} deleted, checking for component changes`);
          needFullReload = true;
        } else if (nodeType === 'INSTANCE') {
          // Instance deletion might affect dependencies
          console.log(`Instance deleted, will update dependencies`);
          componentsChanged = true;
        }
      } else if (change.type === 'PROPERTY_CHANGE') {
        // If a component property changed, update its modification date
        if (nodeType === 'COMPONENT') {
          console.log(`Component property changed: ${nodeId}`);
          await storage.updateModifiedDates(nodeId, Date.now());
          componentsChanged = true;
          changedComponentIds.add(nodeId);
        } else if (nodeType === 'INSTANCE') {
          // Instance property change might affect dependencies
          console.log(`Instance property changed, might affect dependencies`);
          componentsChanged = true;
        }
      } else if (change.type === 'CHILD_CHANGE') {
        // Child changes might affect component structure
        if (nodeType === 'COMPONENT' || nodeType === 'COMPONENT_SET') {
          console.log(`Child change in ${nodeType}: ${nodeId}`);
          componentsChanged = true;
          if (nodeId) changedComponentIds.add(nodeId);
        } else if (nodeType === 'FRAME' || nodeType === 'GROUP' || nodeType === 'PAGE') {
          // These might contain components that were moved
          console.log(`Child change in ${nodeType}, checking for component changes`);
          needFullReload = true;
        }
      }
    }
    
    // Check for changes that might affect dependencies
    const mightAffectDependencies = changes.documentChanges.some(change => 
      ['CREATE', 'DELETE', 'PROPERTY_CHANGE'].includes(change.type) && 
      change.node && change.node.type === 'INSTANCE'
    );
    
    // If we detected specific component changes but don't need a full reload
    if (componentsChanged && !needFullReload) {
      console.log(`Detected changes to ${changedComponentIds.size} components`);
      
      // Update dependencies if there might be changes to instances
      if (mightAffectDependencies) {
        console.log('Detected changes that might affect component dependencies');
        const { dependencyCounts } = await analyzeComponents();
        
        // Send updated dependency counts to the UI
        figma.ui.postMessage({
          type: 'dependencyCountsUpdated',
          dependencyCounts: Object.fromEntries(dependencyCounts)
        });
      }
      
      // For now, we'll still do a full reload for consistency
      loadComponents();
    } 
    // If we need a full reload (structure changes that might affect components)
    else if (needFullReload) {
      console.log('Structural changes detected, updating component tracking');
      await updateKnownComponentIds();
      loadComponents();
      
      // Also update dependencies if there might be changes to instances
      if (mightAffectDependencies) {
        console.log('Detected changes that might affect component dependencies');
        const { dependencyCounts } = await analyzeComponents();
        
        // Send updated dependency counts to the UI
        figma.ui.postMessage({
          type: 'dependencyCountsUpdated',
          dependencyCounts: Object.fromEntries(dependencyCounts)
        });
      }
    }
  });
}

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

        // Update the checkbox state
        const timestamp = msg.applyToAll ? msg.timestamp : (isChecked ? new Date().toISOString() : null);
        await storage.updateCheckboxState(componentId, category, label, {
          checked: isChecked,
          timestamp: timestamp
        });

        // Calculate and update the score
        const score = await calculateComponentScore(componentId);
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
    } else if (msg.type === 'selectInstances') {
      try {
        const findTimeout = setTimeout(() => {
          throw new Error('Finding instances timed out');
        }, 10000); // 10 second timeout for finding instances
        
        const component = figma.getNodeById(msg.componentId);
        if (component) {
          // Find all instances of the component
          const instances = [];
          
          // Use iterative approach with a max depth counter
          function findInstances() {
            const maxNodesToProcess = 10000; // Safety limit
            let nodesProcessed = 0;
            
            // Use a queue for breadth-first traversal instead of recursion
            const queue = [];
            for (const page of figma.root.children) {
              queue.push(page);
            }
            
            // Process queue until empty or we hit the safety limit
            while (queue.length > 0 && nodesProcessed < maxNodesToProcess) {
              const node = queue.shift();
              nodesProcessed++;
              
              // Check if this is an instance we're looking for
              if (node.type === 'INSTANCE' && node.mainComponent && node.mainComponent.id === msg.componentId) {
                instances.push(node);
              }
              
              // Add children to queue if available
              if ('children' in node) {
                for (const child of node.children) {
                  queue.push(child);
                }
              }
              
              // Every 1000 nodes, check if we should yield to prevent UI freeze
              if (nodesProcessed % 1000 === 0) {
                console.log(`Processed ${nodesProcessed} nodes, found ${instances.length} instances so far...`);
              }
            }
            
            if (nodesProcessed >= maxNodesToProcess) {
              console.warn(`Reached node processing limit (${maxNodesToProcess}). Search may be incomplete.`);
              figma.ui.postMessage({
                type: 'instanceSearchLimited',
                warning: 'The search was limited due to the large document size. Some instances may not be shown.'
              });
            }
            
            return instances;
          }

          // Find instances with the non-recursive approach
          const foundInstances = findInstances();
          clearTimeout(findTimeout);
          
          if (foundInstances.length > 0) {
            // Select all instances
            figma.currentPage.selection = foundInstances;
            // Zoom to fit all instances
            figma.viewport.scrollAndZoomIntoView(foundInstances);
            
            figma.ui.postMessage({
              type: 'instancesSelected',
              count: foundInstances.length
            });
          } else {
            figma.ui.postMessage({
              type: 'noInstancesFound',
              componentId: msg.componentId
            });
          }
        } else {
          clearTimeout(findTimeout);
          console.warn(`Component not found for finding instances: ${msg.componentId}`);
          figma.ui.postMessage({
            type: 'componentNotFound',
            componentId: msg.componentId
          });
        }
      } catch (instancesError) {
        console.error('Error finding instances:', instancesError);
        figma.ui.postMessage({
          type: 'instancesError',
          error: 'Failed to find or select instances: ' + instancesError.message,
          componentId: msg.componentId
        });
      }
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

// Run the main function
main();