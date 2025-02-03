// Store checkbox states and modification dates in Figma client storage
let checkboxStates = {};
let modifiedDates = {};

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
  // Find all components in the document, excluding variants by default
  const components = figma.currentPage.findAll(node => 
    node.type === 'COMPONENT' && 
    (!node.parent || node.parent.type !== 'COMPONENT_SET')
  );

  // Load the stored data from client storage
  checkboxStates = await figma.clientStorage.getAsync('checkboxStates') || {};
  modifiedDates = await figma.clientStorage.getAsync('modifiedDates') || {};

  // Get component usage counts
  const usageCounts = await analyzeComponents();

  // Send component data to the UI along with checkbox states
  const componentData = components.map(component => {
    // Get the checked count
    const checkedCount = Object.values(checkboxStates[component.id] || {}).reduce((sum, category) => {
      return sum + Object.values(category).filter(state => state.checked).length;
    }, 0);

    return {
      id: component.id,
      name: component.name,
      checkedCount,
      totalCategories: 0, // Will be calculated in UI based on actual rules
      lastModified: modifiedDates[component.id] || null, // Get stored modification date
      usageCount: usageCounts.get(component.id) || 0 // Add usage count
    };
  });

  // Get currently selected component if any
  const selectedNodes = figma.currentPage.selection;
  const selectedComponentId = selectedNodes.length === 1 && selectedNodes[0].type === 'COMPONENT' ? selectedNodes[0].id : null;

  // Send data to the UI
  figma.ui.postMessage({
    type: 'load-components',
    components: componentData,
    checkboxStates,
    selectedComponentId
  });
}

// Function to save checkbox states to Figma client storage
async function saveCheckboxStates() {
  await figma.clientStorage.setAsync('checkboxStates', checkboxStates);
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

function main() {
  // Show the UI
  figma.showUI(__html__, { width: 400, height: 600 });

  // Load components initially
  loadComponents();

  // Listen for document changes (e.g., when components are added or modified)
  figma.on('documentchange', async (changes) => {
    let needsReload = false;
    
    for (const change of changes.documentChanges) {
      if (change.type === 'CREATE' || change.type === 'DELETE') {
        needsReload = true;
      } else if (change.type === 'PROPERTY_CHANGE' && change.node.type === 'COMPONENT') {
        // Update modification date for the changed component
        modifiedDates[change.node.id] = Date.now();
        await figma.clientStorage.setAsync('modifiedDates', modifiedDates);
        needsReload = true;
      }
    }
    
    if (needsReload) {
      loadComponents(); // Reload components to get updated data
    }
  });

  // Listen for selection changes
  figma.on('selectionchange', async () => {
    const selectedNodes = figma.currentPage.selection;
    const selectedComponent = selectedNodes.find(node => node.type === 'COMPONENT');
    
    if (selectedComponent) {
      const usageData = await getComponentUsage(selectedComponent.id);
      figma.ui.postMessage({
        type: 'component-selected',
        componentId: selectedComponent.id,
        usage: usageData
      });
    } else {
      figma.ui.postMessage({
        type: 'component-selected',
        componentId: null,
        usage: null
      });
    }
  });
}

// Listen to messages from the UI
figma.ui.onmessage = async msg => {
  if (msg.type === 'get-document-title') {
    figma.ui.postMessage({
      type: 'document-title',
      title: figma.root.name
    });
  } else if (msg.type === 'select-component-in-figma') {
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
  } else if (msg.type === 'ok-checkbox-changed') {
    const { componentId, category, label, isChecked } = msg;

    // Save the checkbox state
    if (!checkboxStates[componentId]) {
      checkboxStates[componentId] = {};
    }
    if (!checkboxStates[componentId][category]) {
      checkboxStates[componentId][category] = {};
    }

    // For Apply to all, we want all components to share the same timestamp
    const timestamp = msg.applyToAll ? msg.timestamp : (isChecked ? new Date().toISOString() : null);
    checkboxStates[componentId][category][label] = { 
      checked: isChecked,
      timestamp: timestamp
    };

    // Save the state to client storage
    await saveCheckboxStates();

    // Calculate the updated score
    const checkedCount = Object.values(checkboxStates[componentId])
      .flatMap(categoryState => Object.values(categoryState))
      .filter(state => state.checked).length;

    // Send the updated score to the UI
    figma.ui.postMessage({
      type: 'update-score',
      componentId,
      checkedCount
    });
  } else if (msg.type === 'select-instances') {
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