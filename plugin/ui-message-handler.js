// Main message handler for the UI
window.onmessage = event => {
  const message = event.data.pluginMessage;
  if (!message) return;

  if (message.type === 'loadComponents') {
    // Store the component data
    const components = message.components;
    const checkboxStates = message.checkboxStates || {};
    
    // Build the component list
    buildComponentList(components, checkboxStates, rules);
    
    // Update component count
    updateComponentCount();
    
    // If a component is selected in Figma, select it in the UI
    if (message.selectedComponentId) {
      selectComponent(message.selectedComponentId, true);
    }
    
    // Hide the loading indicator
    document.getElementById('refresh-button').classList.remove('spin');
  } else if (message.type === 'updateScore') {
    // Update the score for a component
    updateScore(message.componentId, message.checkedCount, message.totalRules);
  } else if (message.type === 'documentTitle') {
    // Update the document title
    document.getElementById('document-title').textContent = message.title;
  } else if (message.type === 'componentSelected') {
    // A component was selected in Figma
    if (message.componentId) {
      // Select the component in the UI (with fromFigma=true to prevent infinite loop)
      selectComponent(message.componentId, true);
    } else {
      // Clear selection
      selectComponent(null);
    }
  }
};
