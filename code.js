// Store checkbox states in Figma client storage
let checkboxStates = {};

// Function to load components and send data to the UI
async function loadComponents() {
  // Find all components in the document
  const components = figma.currentPage.findAll(node => node.type === 'COMPONENT');

  // Load the stored checkbox states from client storage
  checkboxStates = await figma.clientStorage.getAsync('checkboxStates') || {};

  // Send component data to the UI along with checkbox states
  const componentData = components.map(component => {
    // Calculate the total number of checkboxes ticked out of 8
    const totalCategories = 8; // Now explicitly setting this to 8
    const checkedCount = Object.values(checkboxStates[component.id] || {}).reduce((sum, category) => {
      return sum + Object.values(category).filter(state => state.checked).length;
    }, 0);

    return {
      id: component.id,
      name: component.name,
      checkedCount,
      totalCategories
    };
  });

  // Send data to the UI
  figma.ui.postMessage({
    type: 'load-components',
    components: componentData,
    checkboxStates,
  });
}

// Function to save checkbox states to Figma client storage
async function saveCheckboxStates() {
  await figma.clientStorage.setAsync('checkboxStates', checkboxStates);
}

function main() {
  // Show the UI
  figma.showUI(__html__, { width: 400, height: 600 });

  // Load components initially
  loadComponents();

  // Listen for document changes (e.g., when components are added)
  figma.on('documentchange', (changes) => {
    const componentChanges = changes.documentChanges.some(change => change.type === 'CREATE' || change.type === 'DELETE');
    if (componentChanges) {
      loadComponents(); // Reload components if any new components are added or removed
    }
  });
}

// Listen to messages from the UI
figma.ui.onmessage = async msg => {
  if (msg.type === 'ok-checkbox-changed') {
    const { componentId, category, label, isChecked } = msg;

    // Save the checkbox state
    if (!checkboxStates[componentId]) {
      checkboxStates[componentId] = {};
    }
    if (!checkboxStates[componentId][category]) {
      checkboxStates[componentId][category] = {};
    }

    checkboxStates[componentId][category][label] = { checked: isChecked };

    // Save the state to client storage
    await saveCheckboxStates();

    // Calculate the updated score out of 8
    const checkedCount = Object.values(checkboxStates[componentId])
      .flatMap(categoryState => Object.values(categoryState))
      .filter(state => state.checked).length;

    const totalCategories = 8; // Now explicitly setting this to 8

    // Send the updated score and total to the UI
    figma.ui.postMessage({
      type: 'update-score',
      componentId,
      checkedCount,
      totalCategories,
    });
  }
};

// Run the main function
main();