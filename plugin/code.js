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
  }

  async init() {
    const [checkboxStates, modifiedDates, viewStates, userPreferences, customRules] = await Promise.all([
      figma.clientStorage.getAsync('checkboxStates'),
      figma.clientStorage.getAsync('modifiedDates'),
      figma.clientStorage.getAsync('viewStates'),
      figma.clientStorage.getAsync('userPreferences'),
      figma.clientStorage.getAsync('customRules')
    ]);

    this.cache.checkboxStates = checkboxStates || {};
    this.cache.modifiedDates = modifiedDates || {};
    this.cache.viewStates = viewStates || {};
    this.cache.userPreferences = userPreferences || { hideCompleted: false };
    this.cache.customRules = customRules || null;
  }

  async getComponentState(componentId) {
    if (!this.cache.checkboxStates) await this.init();
    return this.cache.checkboxStates[componentId] || {};
  }

  async getAllComponentStates() {
    if (!this.cache.checkboxStates) await this.init();
    return this.cache.checkboxStates;
  }

  async updateCheckboxState(componentId, category, rule, state) {
    if (!this.cache.checkboxStates) await this.init();
    
    if (!this.cache.checkboxStates[componentId]) {
      this.cache.checkboxStates[componentId] = {};
    }
    if (!this.cache.checkboxStates[componentId][category]) {
      this.cache.checkboxStates[componentId][category] = {};
    }

    this.cache.checkboxStates[componentId][category][rule] = state;
    await this.persist();
    
    return this.cache.checkboxStates[componentId];
  }

  async persist() {
    await Promise.all([
      figma.clientStorage.setAsync('checkboxStates', this.cache.checkboxStates),
      figma.clientStorage.setAsync('modifiedDates', this.cache.modifiedDates),
      figma.clientStorage.setAsync('viewStates', this.cache.viewStates),
      figma.clientStorage.setAsync('userPreferences', this.cache.userPreferences),
      figma.clientStorage.setAsync('customRules', this.cache.customRules)
    ]);
  }

  async updateModifiedDates(componentId, timestamp) {
    if (!this.cache.modifiedDates) await this.init();
    this.cache.modifiedDates[componentId] = timestamp;
    await this.persist();
  }

  async getModifiedDates(componentId) {
    if (!this.cache.modifiedDates) await this.init();
    return this.cache.modifiedDates[componentId] || null;
  }
  
  async getAllModifiedDates() {
    if (!this.cache.modifiedDates) await this.init();
    return this.cache.modifiedDates;
  }

  async getViewState(componentId) {
    if (!this.cache.viewStates) await this.init();
    return this.cache.viewStates[componentId] || null;
  }

  async getAllViewStates() {
    if (!this.cache.viewStates) await this.init();
    return this.cache.viewStates;
  }

  async updateViewState(componentId, isCollapsed, userToggled = true) {
    if (!this.cache.viewStates) await this.init();
    
    this.cache.viewStates[componentId] = {
      collapsed: isCollapsed,
      userToggled: userToggled
    };
    
    await this.persist();
    return this.cache.viewStates[componentId];
  }
  
  async getUserPreferences() {
    if (!this.cache.userPreferences) await this.init();
    return this.cache.userPreferences;
  }
  
  async updateUserPreferences(preferences) {
    if (!this.cache.userPreferences) await this.init();
    
    // Update only the provided preferences, keeping the rest intact
    this.cache.userPreferences = Object.assign({}, this.cache.userPreferences, preferences);
    
    await this.persist();
    return this.cache.userPreferences;
  }
  
  async getCustomRules() {
    if (!this.cache.customRules) await this.init();
    return this.cache.customRules;
  }
  
  async saveCustomRules(customRules) {
    if (!this.cache.customRules) await this.init();
    this.cache.customRules = customRules;
    await this.persist();
    return this.cache.customRules;
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
  
  // First pass: collect main components and initialize counts
  for (const page of figma.root.children) {
    const pageComponents = page.findAllWithCriteria({
      types: ['COMPONENT']
    });
    
    pageComponents.forEach(component => {
      // Skip variants - only include main components
      if (!component.parent || component.parent.type !== 'COMPONENT_SET') {
        usageCounts.set(component.id, 0);
        dependencyCounts.set(component.id, 0);
        componentDependencies.set(component.id, new Set());
      }
    });
  }

  // Second pass: count instances and analyze dependencies
  for (const page of figma.root.children) {
    // Track instances usage
    const instances = page.findAllWithCriteria({
      types: ['INSTANCE']
    });
    
    instances.forEach(instance => {
      if (!instance.mainComponent) return;
      
      let targetComponent = instance.mainComponent;
      
      // If this is a variant, get its parent component set's main component
      if (targetComponent.parent && targetComponent.parent.type === 'COMPONENT_SET') {
        const mainVariant = targetComponent.parent.defaultVariant;
        if (mainVariant) {
          targetComponent = mainVariant;
        }
      }

      const mainComponentId = targetComponent.id;
      if (usageCounts.has(mainComponentId)) {
        usageCounts.set(
          mainComponentId,
          usageCounts.get(mainComponentId) + 1
        );
      }
      
      // Find the parent component that contains this instance (if any)
      let parent = instance.parent;
      while (parent) {
        if (parent.type === 'COMPONENT' && 
            (!parent.parent || parent.parent.type !== 'COMPONENT_SET')) {
          // Found a parent main component that contains this instance
          // Add this as a dependency for that component
          if (componentDependencies.has(parent.id)) {
            componentDependencies.get(parent.id).add(targetComponent.id);
          }
          break;
        }
        parent = parent.parent;
      }
    });
  }
  
  // Calculate final dependency counts
  for (const [componentId, dependencies] of componentDependencies) {
    dependencyCounts.set(componentId, dependencies.size);
  }

  return { usageCounts, dependencyCounts };
}

// Function to load components and send data to the UI
async function loadComponents(skipCache = false) {
  try {
    console.log('Loading components...');
    console.log('Document name:', figma.root.name);
    console.log('Number of pages:', figma.root.children.length);
    console.log('Current page name:', figma.currentPage.name);
    
    // Make sure all pages are loaded
    await figma.loadAllPagesAsync();
    console.log('All pages loaded successfully');
    
    // Find all components across all pages in the document
    let allComponents = [];
    for (const page of figma.root.children) {
      console.log(`Searching for components on page: ${page.name}`);
      const pageComponents = page.findAllWithCriteria({
        types: ['COMPONENT']
      });
      console.log(`Found ${pageComponents.length} components on page ${page.name}`);
      allComponents = allComponents.concat(pageComponents);
    }
    
    console.log('Found components across all pages:', allComponents.length);
    
    // Filter out components in component sets (variants) and deduplicate by ID
    const componentMap = new Map();
    
    // First pass - filter out variants and collect components
    allComponents
      .filter(component => !component.parent || component.parent.type !== 'COMPONENT_SET')
      .forEach(component => {
        // Only add this component if we haven't seen its ID before
        if (!componentMap.has(component.id)) {
          componentMap.set(component.id, component);
        }
      });
      
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

    // Get all component states from storage
    const states = await storage.getAllComponentStates();
    
    // Get all view states and user preferences
    const viewStates = await storage.getAllViewStates();
    const userPreferences = await storage.getUserPreferences();
    const customRules = await storage.getCustomRules();

    // Get component usage and dependency counts
    const { usageCounts, dependencyCounts } = await analyzeComponents();

    // Send component data to the UI along with checkbox states
    // Note: Only components that currently exist in the document are sent to the UI
    // Data for deleted components is preserved in storage but not shown in the UI
    // This allows for restoration of data if a component is recreated (e.g., via undo)
    
    // First get all the modification dates at once (since this is async)
    const modifiedDates = await storage.getAllModifiedDates();
    
    // Update current modification dates for all components if needed
    for (const component of components) {
      // If component doesn't have a modified date or we need to refresh it
      if (!modifiedDates[component.id] || skipCache) {
        // Set the current time as the modification date
        await storage.updateModifiedDates(component.id, new Date().toISOString());
      }
    }
    
    // Now get the updated dates
    const updatedModifiedDates = await storage.getAllModifiedDates();
    
    const componentData = components.map(component => {
      // Get the checked count using the storage states
      const componentState = states[component.id] || {};
      const checkedCount = Object.values(componentState).reduce((sum, category) => {
        return sum + Object.values(category).filter(state => state.checked).length;
      }, 0);

      // Log each component we're sending to the UI
      console.log('Sending component to UI:', {
        id: component.id,
        name: component.name
      });

      return {
        id: component.id,
        name: component.name,
        checkedCount,
        lastModified: updatedModifiedDates[component.id] || null,
        usageCount: usageCounts.get(component.id) || 0,
        dependencyCount: dependencyCounts.get(component.id) || 0
      };
    });

    // Get currently selected component if any
    const selectedNodes = figma.currentPage.selection;
    const selectedComponentId = selectedNodes.length === 1 && selectedNodes[0].type === 'COMPONENT' ? selectedNodes[0].id : null;
    
    if (selectedComponentId) {
      console.log('Currently selected component:', selectedComponentId);
    }

    // Send data to the UI
    figma.ui.postMessage({
      type: 'loadComponents',
      viewStates,
      components: componentData,
      checkboxStates: states,
      selectedComponentId,
      userPreferences,
      customRules
    });
  } catch (error) {
    console.error('Error loading components:', error);
    // Send an error message to the UI
    figma.ui.postMessage({
      type: 'loadError',
      error: error.message
    });
  }
}


async function main() {
  // Initialize storage
  await storage.init();
  figma.showUI(__html__, { width: 400, height: 600 });
  
  // Make sure all pages are loaded first
  console.log('Loading all pages...');
  await figma.loadAllPagesAsync();
  
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
  if (msg.type === 'refreshComponents') {
    console.log('Refresh requested, fullRefresh:', msg.fullRefresh);
    // If fullRefresh is true, we'll do a complete reload of all components
    await loadComponents(msg.fullRefresh === true);
  } else if (msg.type === 'getDocumentTitle') {
    figma.ui.postMessage({
      type: 'documentTitle',
      title: figma.root.name
    });
  } else if (msg.type === 'selectComponent') {
    // Find the component
    const component = figma.currentPage.findOne(node => 
      node.type === 'COMPONENT' && node.id === msg.componentId
    );

    if (component) {
      // Select the component
      figma.currentPage.selection = [component];
      
      // Scroll the component into view
      figma.viewport.scrollAndZoomIntoView([component]);
    }
  } else if (msg.type === 'checkboxChanged') {
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
  } else if (msg.type === 'saveViewState') {
    // Save the component view state
    const { componentId, collapsed, userToggled } = msg;
    await storage.updateViewState(componentId, collapsed, userToggled);
  } else if (msg.type === 'saveUserPreferences') {
    // Save user preferences
    await storage.updateUserPreferences(msg.preferences);
  } else if (msg.type === 'saveCustomRules') {
    console.log('Saving custom rules');
    await storage.saveCustomRules(msg.customRules);
  } else if (msg.type === 'selectInstances') {
    const component = figma.getNodeById(msg.componentId);
    if (component) {
      // Find all instances of the component
      const instances = [];
      
      function traverse(node) {
        if (node.type === 'INSTANCE' && node.mainComponent && node.mainComponent.id === msg.componentId) {
          instances.push(node);
        }
        if ('children' in node) {
          node.children.forEach(traverse);
        }
      }

      // Search through all pages
      try {
        figma.root.children.forEach(traverse);
      } catch (error) {
        console.error('Error finding instances:', error);
      }
      
      if (instances.length > 0) {
        // Select all instances
        figma.currentPage.selection = instances;
        // Zoom to fit all instances
        figma.viewport.scrollAndZoomIntoView(instances);
      }
    }
  }
};

// Run the main function
main();