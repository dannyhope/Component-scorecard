// Import would be at the top, but Figma plugins don't support ES modules
// Instead, we'll use the code directly

class Storage {
  constructor() {
    this.cache = {
      checkboxStates: null,
      modifiedDates: null
    };
  }

  async init() {
    const [checkboxStates, modifiedDates] = await Promise.all([
      figma.clientStorage.getAsync('checkboxStates'),
      figma.clientStorage.getAsync('modifiedDates')
    ]);

    this.cache.checkboxStates = checkboxStates || {};
    this.cache.modifiedDates = modifiedDates || {};
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
      figma.clientStorage.setAsync('modifiedDates', this.cache.modifiedDates)
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
  console.log('Loading components...');
  
  // Find all components in the document using the more reliable findAllWithCriteria
  const allComponents = figma.currentPage.findAllWithCriteria({
    types: ['COMPONENT']
  });
  
  // Filter out components in component sets (variants)
  const components = allComponents.filter(component => 
    !component.parent || component.parent.type !== 'COMPONENT_SET'
  );
  
  console.log(`Found ${allComponents.length} total components, ${components.length} main components`);
  console.log('Component IDs:', components.map(c => c.id));

  // Get all component states from storage
  const states = await storage.getAllComponentStates();

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
    components: componentData,
    checkboxStates: states,
    selectedComponentId
  });
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

  // Listen for document changes (e.g., when components are added or modified)
  figma.on('documentchange', async (changes) => {
    console.log('Document changed:', changes);
    let needsReload = false;
    
    // Look for any component creations or changes
    for (const change of changes.documentChanges) {
      const nodeType = change.node && change.node.type ? change.node.type : 'unknown';
      console.log(`Change type: ${change.type}, node type: ${nodeType}`);
      
      // Reload for any CREATE/DELETE operations or if it involves a COMPONENT
      if (change.type === 'CREATE' || change.type === 'DELETE') {
        console.log('CREATE or DELETE detected - triggering reload');
        needsReload = true;
      } else if (change.type === 'PROPERTY_CHANGE') {
        // For property changes, check node type and also update modification date
        if (change.node && change.node.type === 'COMPONENT') {
          console.log(`COMPONENT property changed: ${change.node.id}`);
          await storage.updateModifiedDates(change.node.id, Date.now());
          needsReload = true;
        }
      }
    }
    
    // Add a fallback check - poll for components every 2 seconds to catch any missed changes
    if (!needsReload) {
      console.log('No component-specific changes detected, but checking components anyway');
      needsReload = true; // Just reload regardless for now to ensure we catch everything
    }
    
    if (needsReload) {
      console.log('Reloading components due to document changes');
      loadComponents(); // Reload components to get updated data
    }
  });
  
  // Add a simple reload function that runs periodically
  function setupComponentPolling() {
    console.log('Setting up component polling');
    setTimeout(function pollForComponents() {
      console.log('Checking for component changes...');
      loadComponents();
      // Schedule the next check
      setTimeout(pollForComponents, 5000);
    }, 5000);
  }
  
  // Start the polling
  setupComponentPolling();

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
  } else if (msg.type === 'selectComponentInFigma') {
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
  } else if (msg.type === 'okCheckboxChanged') {
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
      figma.root.children.forEach(traverse);
      
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