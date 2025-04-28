/**
 * StateMachine - A lightweight state machine implementation for the Component Scorecard plugin
 * 
 * This provides a structured way to manage the plugin's workflow and states.
 * It ensures predictable behavior and makes debugging easier.
 */

class StateMachine {
  constructor(config) {
    // Store the configuration
    this.states = config.states || {};
    this.transitions = config.transitions || {};
    this.initialState = config.initialState;
    
    // Initialize state
    this.currentState = null;
    this.previousState = null;
    this.data = {};
    
    // Listeners
    this.stateChangeListeners = [];
    
    // Transition to initial state if provided
    if (this.initialState) {
      this.transition(this.initialState);
    }
  }
  
  /**
   * Get the current state
   */
  getState() {
    return this.currentState;
  }
  
  /**
   * Check if a transition is allowed from the current state
   */
  canTransition(to) {
    // If no current state, only allow transition to initial state
    if (!this.currentState) {
      return to === this.initialState;
    }
    
    // Check if transition is defined
    const allowedTransitions = this.transitions[this.currentState] || [];
    return allowedTransitions.includes(to);
  }
  
  /**
   * Transition to a new state
   */
  transition(to, data = {}) {
    console.log(`StateMachine: Attempting transition from ${this.currentState} to ${to}`);
    
    // Validate transition
    if (!this.canTransition(to)) {
      const error = `Invalid transition from '${this.currentState}' to '${to}'`;
      console.error(error);
      return { success: false, error };
    }
    
    // Get state handlers
    const exitHandler = this.states[this.currentState]?.exit;
    const enterHandler = this.states[to]?.enter;
    
    // Store previous state
    this.previousState = this.currentState;
    
    // Execute exit handler for current state if exists
    if (exitHandler && typeof exitHandler === 'function') {
      try {
        exitHandler(this.data, data);
      } catch (error) {
        console.error(`Error in exit handler for state '${this.currentState}':`, error);
      }
    }
    
    // Update current state
    this.currentState = to;
    
    // Update data
    this.data = { ...this.data, ...data };
    
    // Execute enter handler for new state if exists
    if (enterHandler && typeof enterHandler === 'function') {
      try {
        enterHandler(this.data);
      } catch (error) {
        console.error(`Error in enter handler for state '${to}':`, error);
      }
    }
    
    // Notify listeners
    this.notifyStateChangeListeners();
    
    console.log(`StateMachine: Transitioned to '${to}'`);
    return { success: true };
  }
  
  /**
   * Add a listener for state changes
   */
  addStateChangeListener(listener) {
    if (typeof listener === 'function') {
      this.stateChangeListeners.push(listener);
      return true;
    }
    return false;
  }
  
  /**
   * Remove a listener
   */
  removeStateChangeListener(listener) {
    const index = this.stateChangeListeners.indexOf(listener);
    if (index !== -1) {
      this.stateChangeListeners.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Notify all listeners of state change
   */
  notifyStateChangeListeners() {
    const stateInfo = {
      current: this.currentState,
      previous: this.previousState,
      data: this.data
    };
    
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(stateInfo);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }
  
  /**
   * Reset the state machine to initial state
   */
  reset() {
    this.data = {};
    this.previousState = this.currentState;
    this.currentState = this.initialState;
    this.notifyStateChangeListeners();
  }
  
  /**
   * Get current state data
   */
  getData() {
    return { ...this.data };
  }
  
  /**
   * Update state data without changing state
   */
  updateData(newData) {
    this.data = { ...this.data, ...newData };
    this.notifyStateChangeListeners();
  }
}

// Export for global use
window.StateMachine = StateMachine;
