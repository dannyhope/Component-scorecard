/**
 * Plugin States - Defines the states and transitions for the Component Scorecard plugin
 * 
 * This implements a message-based approach where each operation is separate and
 * independent, allowing the UI to function even when data is loading.
 */

// Plugin states configuration
const pluginStateConfig = {
  // Define all possible states
  states: {
    idle: {
      enter: (data) => {
        console.log('Entering idle state');
        updateUiForIdleState();
      }
    },
    
    loading: {
      enter: (data) => {
        console.log('Entering loading state');
        updateUiForLoadingState();
      },
      exit: (data, newData) => {
        console.log('Exiting loading state');
        hideLoadingIndicators();
      }
    },
    
    componentSelection: {
      enter: (data) => {
        console.log('Entering component selection state');
        highlightSelectedComponents(data.selectedComponentIds);
      }
    },
    
    filtering: {
      enter: (data) => {
        console.log('Entering filtering state');
        applyFilters(data.filters);
      }
    },
    
    error: {
      enter: (data) => {
        console.log('Entering error state:', data.error);
        showErrorMessage(data.error);
      }
    },
    
    saving: {
      enter: (data) => {
        console.log('Entering saving state');
        showSavingIndicator();
      },
      exit: (data, newData) => {
        console.log('Exiting saving state');
        hideSavingIndicator();
      }
    }
  },
  
  // Define allowed transitions between states
  transitions: {
    // From idle state
    idle: ['loading', 'componentSelection', 'filtering', 'error'],
    
    // From loading state
    loading: ['idle', 'error'],
    
    // From component selection state
    componentSelection: ['idle', 'filtering', 'loading', 'saving', 'error'],
    
    // From filtering state
    filtering: ['idle', 'componentSelection', 'loading', 'error'],
    
    // From error state
    error: ['idle', 'loading'],
    
    // From saving state
    saving: ['idle', 'error']
  },
  
  // Initial state
  initialState: 'idle'
};

// Handler functions for UI updates based on state

function updateUiForIdleState() {
  // Enable all interactive elements
  document.querySelectorAll('button, input, select').forEach(el => {
    el.disabled = false;
  });
  
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

function updateUiForLoadingState() {
  // Disable interactive elements during loading
  document.querySelectorAll('button, input, select').forEach(el => {
    if (!el.classList.contains('always-enabled')) {
      el.disabled = true;
    }
  });
  
  // Show loading overlay or indicator
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  } else {
    // Create loading overlay if it doesn't exist
    createLoadingOverlay();
  }
}

function hideLoadingIndicators() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

function highlightSelectedComponents(selectedIds) {
  if (!selectedIds || !Array.isArray(selectedIds)) return;
  
  // Clear all previous selections
  document.querySelectorAll('.component-section.selected').forEach(el => {
    el.classList.remove('selected');
  });
  
  // Apply selection to specified components
  selectedIds.forEach(id => {
    const selector = `.component-section[data-id="${id}"]`;
    const component = document.querySelector(selector);
    if (component) {
      component.classList.add('selected');
      // Scroll component into view if needed
      component.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function applyFilters(filters) {
  if (!filters) return;
  
  // Apply search filter if provided
  if (filters.searchText !== undefined) {
    const searchInput = document.getElementById('component-filter');
    if (searchInput) {
      searchInput.value = filters.searchText;
    }
  }
  
  // Apply hide completed filter if provided
  if (filters.hideCompleted !== undefined) {
    const hideCompletedCheckbox = document.getElementById('hide-completed-checkbox');
    if (hideCompletedCheckbox) {
      hideCompletedCheckbox.checked = filters.hideCompleted;
    }
  }
  
  // Call the filterComponents function with the new filters
  if (typeof filterComponents === 'function') {
    const hideCompleted = filters.hideCompleted || false;
    const forceApply = filters.forceApply || false;
    filterComponents(hideCompleted, forceApply);
  }
}

function showErrorMessage(error) {
  // Show error in notifications system if available
  if (window.notifications && typeof notifications.error === 'function') {
    notifications.error('Error', error);
    return;
  }
  
  // Fallback to alert if notifications system not available
  console.error('Plugin error:', error);
  
  // Create error overlay
  const errorOverlay = document.getElementById('error-overlay');
  if (errorOverlay) {
    // Update existing error overlay
    const errorMessage = errorOverlay.querySelector('.error-message');
    if (errorMessage) {
      errorMessage.textContent = error;
    }
    errorOverlay.style.display = 'flex';
  } else {
    // Create new error overlay
    createErrorOverlay(error);
  }
}

function createErrorOverlay(errorText) {
  const overlay = document.createElement('div');
  overlay.id = 'error-overlay';
  overlay.className = 'overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '9999';
  
  const errorBox = document.createElement('div');
  errorBox.className = 'error-box';
  errorBox.style.backgroundColor = 'white';
  errorBox.style.padding = '20px';
  errorBox.style.borderRadius = '4px';
  errorBox.style.maxWidth = '80%';
  errorBox.style.textAlign = 'center';
  
  const errorTitle = document.createElement('h3');
  errorTitle.textContent = 'Error';
  errorTitle.style.color = '#FF0040'; // Using user's brand colors
  
  const errorMessage = document.createElement('p');
  errorMessage.className = 'error-message';
  errorMessage.textContent = errorText;
  
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.marginTop = '10px';
  closeButton.style.padding = '5px 10px';
  closeButton.style.border = 'none';
  closeButton.style.backgroundColor = '#E4003D'; // Using user's brand colors
  closeButton.style.color = 'white';
  closeButton.style.borderRadius = '4px';
  closeButton.style.cursor = 'pointer';
  
  closeButton.addEventListener('click', () => {
    overlay.style.display = 'none';
    // Transition back to idle state
    if (window.pluginStateMachine) {
      pluginStateMachine.transition('idle');
    }
  });
  
  errorBox.appendChild(errorTitle);
  errorBox.appendChild(errorMessage);
  errorBox.appendChild(closeButton);
  overlay.appendChild(errorBox);
  
  document.body.appendChild(overlay);
}

function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.className = 'overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '9999';
  
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  spinner.style.width = '40px';
  spinner.style.height = '40px';
  spinner.style.border = '4px solid #f3f3f3';
  spinner.style.borderTop = '4px solid #E4003D'; // Using user's brand colors
  spinner.style.borderRadius = '50%';
  spinner.style.animation = 'spin 1s linear infinite';
  
  const loadingText = document.createElement('div');
  loadingText.textContent = 'Loading...';
  loadingText.style.marginLeft = '10px';
  
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.appendChild(spinner);
  container.appendChild(loadingText);
  
  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

function showSavingIndicator() {
  // Use notification system if available
  if (window.notifications && typeof notifications.info === 'function') {
    notifications.info('Saving', 'Saving changes...');
    return;
  }
  
  // Fallback to simple indicator
  const statusBar = document.getElementById('status-bar');
  if (statusBar) {
    statusBar.textContent = 'Saving...';
    statusBar.style.display = 'block';
  } else {
    // Create status bar if it doesn't exist
    createStatusBar('Saving...');
  }
}

function hideSavingIndicator() {
  const statusBar = document.getElementById('status-bar');
  if (statusBar) {
    statusBar.style.display = 'none';
  }
}

function createStatusBar(message) {
  const statusBar = document.createElement('div');
  statusBar.id = 'status-bar';
  statusBar.style.position = 'fixed';
  statusBar.style.bottom = '0';
  statusBar.style.left = '0';
  statusBar.style.width = '100%';
  statusBar.style.padding = '5px 10px';
  statusBar.style.backgroundColor = '#f0f2f2'; // Using user's muted colors
  statusBar.style.color = '#333';
  statusBar.style.fontSize = '12px';
  statusBar.style.textAlign = 'center';
  statusBar.style.borderTop = '1px solid #d7d7d7';
  statusBar.textContent = message;
  
  document.body.appendChild(statusBar);
}

// Initialize plugin state machine
function initializePluginStateMachine() {
  // Create state machine
  window.pluginStateMachine = new StateMachine(pluginStateConfig);
  
  // Add listeners for state changes
  pluginStateMachine.addStateChangeListener((stateInfo) => {
    console.log(`State changed: ${stateInfo.previous} -> ${stateInfo.current}`, stateInfo.data);
    
    // Update UI based on state if needed
    updateUiForStateChange(stateInfo);
  });
  
  console.log('Plugin state machine initialized');
  return window.pluginStateMachine;
}

// Helper to update UI elements based on state changes
function updateUiForStateChange(stateInfo) {
  // Update the debug panel if available
  const stateDisplay = document.getElementById('current-state-display');
  if (stateDisplay) {
    stateDisplay.textContent = stateInfo.current;
  }
  
  // Add any other general UI updates based on state
}

// Export for global use
window.pluginStateConfig = pluginStateConfig;
window.initializePluginStateMachine = initializePluginStateMachine;
