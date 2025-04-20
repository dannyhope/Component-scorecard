// Simple pub/sub event bus for state management
class EventBus {
  constructor() {
    this.subscribers = {};
    this.state = {};
  }
  
  // Subscribe to an event with a callback
  subscribe(event, callback) {
    if (!this.subscribers[event]) {
      this.subscribers[event] = [];
    }
    
    const index = this.subscribers[event].length;
    this.subscribers[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers[event].splice(index, 1);
    };
  }
  
  // Publish an event with data
  publish(event, data) {
    if (!this.subscribers[event]) {
      return;
    }
    
    this.subscribers[event].forEach(callback => {
      callback(data);
    });
  }
  
  // Get current state
  getState(key) {
    return this.state[key];
  }
  
  // Update state and notify subscribers
  setState(key, value) {
    this.state[key] = value;
    this.publish(`state:${key}`, value);
    return value;
  }
  
  // Update multiple state properties at once
  setMultiState(updates) {
    const changedKeys = Object.keys(updates);
    
    changedKeys.forEach(key => {
      this.state[key] = updates[key];
    });
    
    // Publish a single batch update event
    this.publish('state:batch', {
      changedKeys,
      updates
    });
    
    // Also publish individual update events
    changedKeys.forEach(key => {
      this.publish(`state:${key}`, updates[key]);
    });
    
    return this.state;
  }
}

// Create a single instance for the entire application
const eventBus = new EventBus();
