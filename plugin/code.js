// Import would be at the top, but Figma plugins don't support ES modules
// Instead, we'll use the code directly

class Storage {
  constructor() {
    this.cache = {
      checkboxStates: null,
      modifiedDates: null,
      viewStates: null
    };
  }

  async init() {
    const [checkboxStates, modifiedDates, viewStates] = await Promise.all([
      figma.clientStorage.getAsync('checkboxStates'),
      figma.clientStorage.getAsync('modifiedDates'),
      figma.clientStorage.getAsync('viewStates')
    ]);

    this.cache.checkboxStates = checkboxStates || {};
    this.cache.modifiedDates = modifiedDates || {};
    this.cache.viewStates = viewStates || {};
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
      figma.clientStorage.setAsync('viewStates', this.cache.viewStates)
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
  
  // First pass: collect main components and initialize usage counts
  for (const page of figma.root.children) {
    const pageComponents = page.findAllWithCriteria({
      types: ['COMPONENT']
    });
    
    pageComponents.forEach(component => {
      // Skip variants - only include main components
      if (!component.parent || component.parent.type !== 'COMPONENT_SET') {
        usageCounts.set(component.id, 0);
      }
    });
  }

  // Second pass: count instances, including those of variants
  for (const page of figma.root.children) {
    const instances = page.findAllWithCriteria({
      types: ['INSTANCE']
    });
    
    instances.forEach(instance => {
      if (instance.mainComponent) {
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
      }
    });
  }

  return usageCounts;
}

// Function to load components and send data to the UI
async function loadComponents() {
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
    
    // Filter out components in component sets (variants)
    const components = allComponents.filter(component => 
      !component.parent || component.parent.type !== 'COMPONENT_SET'
    );
    
    console.log(`Found ${allComponents.length} total components, ${components.length} main components`);
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
    
    // Get all view states from storage
    const viewStates = await storage.getAllViewStates();

    // Get component usage counts
    const usageCounts = await analyzeComponents();

    // Send component data to the UI along with checkbox states
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
        lastModified: storage.getModifiedDates(component.id) || null,
        usageCount: usageCounts.get(component.id) || 0
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
      selectedComponentId
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

// Function to get component usage data
async function getComponentUsage(componentId) {
  try {
    const component = figma.getNodeById(componentId);
    if (component && component.remote) {
      return {
        usageCount: component.remote.instances.length,
        files: component.remote.instances.reduce((acc, instance) => {
          const fileKey = instance.fileKey;
          if (!acc[fileKey]) {
            acc[fileKey] = {
              name: instance.fileName || 'Unnamed File',
              count: 0
            };
          }
          acc[fileKey].count++;
          return acc;
        }, {})
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting component usage:', error);
    return null;
  }
}

async function main() {
  // Initialize storage
  await storage.init();

  // Show the UI
  figma.showUI(__html__, { width: 400, height: 600 });

  // Load all pages to enable document change handlers
  await figma.loadAllPagesAsync();
  
  // Load components initially
  await loadComponents();

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
        }
      } else if (change.type === 'DELETE') {
        // If a known component was deleted, we need to update
        if (nodeType === 'COMPONENT' && knownComponentIds.has(nodeId)) {
          console.log(`Known component deleted: ${nodeId}`);
          componentsChanged = true;
          knownComponentIds.delete(nodeId);
        } else if (nodeType === 'COMPONENT_SET' || nodeType === 'FRAME' || nodeType === 'GROUP') {
          // These might have contained components
          console.log(`${nodeType} deleted, checking for component changes`);
          needFullReload = true;
        }
      } else if (change.type === 'PROPERTY_CHANGE') {
        // If a component property changed, update its modification date
        if (nodeType === 'COMPONENT') {
          console.log(`Component property changed: ${nodeId}`);
          await storage.updateModifiedDates(nodeId, Date.now());
          componentsChanged = true;
          changedComponentIds.add(nodeId);
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
    
    // If we detected specific component changes but don't need a full reload
    if (componentsChanged && !needFullReload) {
      console.log(`Detected changes to ${changedComponentIds.size} components`);
      // If only a few components changed, we could implement partial updates here
      // For now, we'll still do a full reload for consistency
      loadComponents();
    } 
    // If we need a full reload (structure changes that might affect components)
    else if (needFullReload) {
      console.log('Structural changes detected, updating component tracking');
      await updateKnownComponentIds();
      loadComponents();
    } else {
      console.log('No component-related changes detected');
    }
  });

  // Listen for selection changes
  figma.on('selectionchange', async () => {
    console.log('Selection changed in Figma');
    const selectedNodes = figma.currentPage.selection;
    console.log('Selected nodes:', selectedNodes.length);
    const selectedComponent = selectedNodes.find(node => node.type === 'COMPONENT');
    
    if (selectedComponent) {
      console.log('Selected component in Figma:', selectedComponent.id, selectedComponent.name);
      
      // Log all components to help with debugging
      const allComponents = figma.currentPage.findAllWithCriteria({
        types: ['COMPONENT']
      });
      console.log('All components on page:', allComponents.map(c => c.id));
      
      const usageData = await getComponentUsage(selectedComponent.id);
      figma.ui.postMessage({
        type: 'componentSelected',
        componentId: selectedComponent.id,
        usage: usageData
      });
    } else {
      console.log('No component selected in Figma');
      figma.ui.postMessage({
        type: 'componentSelected',
        componentId: null,
        usage: null
      });
    }
  });
}

// Listen to messages from the UI
figma.ui.onmessage = async msg => {
  if (msg.type === 'refreshComponents') {
    console.log('Manual refresh requested');
    // Force a full refresh of components
    await loadComponents();
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