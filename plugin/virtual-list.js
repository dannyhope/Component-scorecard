/**
 * VirtualList - A lightweight virtualization system for the Component Scorecard plugin
 * 
 * This implements efficient DOM recycling and only renders components that are visible
 * in the viewport. This makes handling large component libraries much more performant.
 */

class VirtualList {
  constructor({
    container,
    itemHeight = 200, // Estimated average height of a component
    overscan = 3,     // Number of items to render above/below the visible area
    createItemFn,     // Function to create a component DOM element
    getItemKey        // Function to get a unique key for a component
  }) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.overscan = overscan;
    this.createItemFn = createItemFn;
    this.getItemKey = getItemKey;
    
    // State
    this.items = [];          // All items data
    this.visibleItems = [];   // Currently visible items
    this.renderedItems = new Map(); // Map of rendered DOM elements by key
    this.scrollTop = 0;
    this.viewportHeight = 0;
    
    // Create DOM structure
    this.initialize();
    
    // Bind methods
    this.handleScroll = this.handleScroll.bind(this);
    this.resize = this.resize.bind(this);
    
    // Set up event listeners
    this.container.addEventListener('scroll', this.handleScroll);
    window.addEventListener('resize', this.resize);
    
    // Initial render after a brief delay to allow CSS to be applied
    setTimeout(this.resize, 50);
  }
  
  /**
   * Set up the DOM structure for the virtual list
   */
  initialize() {
    // Make sure container has position relative or absolute
    const computedStyle = window.getComputedStyle(this.container);
    if (computedStyle.position === 'static') {
      this.container.style.position = 'relative';
    }
    
    // Create the spacer element that will ensure proper scrollbar size
    this.spacer = document.createElement('div');
    this.spacer.className = 'virtual-list-spacer';
    this.spacer.style.position = 'absolute';
    this.spacer.style.top = '0';
    this.spacer.style.left = '0';
    this.spacer.style.width = '1px';
    this.spacer.style.visibility = 'hidden';
    this.spacer.style.pointerEvents = 'none';
    
    // Create the item container where visible items will be rendered
    this.itemContainer = document.createElement('div');
    this.itemContainer.className = 'virtual-list-items';
    this.itemContainer.style.position = 'relative';
    
    // Add elements to the container
    this.container.appendChild(this.spacer);
    this.container.appendChild(this.itemContainer);
    
    // Make sure the container is scrollable
    if (computedStyle.overflow !== 'auto' && computedStyle.overflow !== 'scroll') {
      this.container.style.overflow = 'auto';
    }
    
    // Add debug info element
    this.debugInfo = document.createElement('div');
    this.debugInfo.className = 'virtual-list-debug';
    this.debugInfo.style.position = 'fixed';
    this.debugInfo.style.bottom = '10px';
    this.debugInfo.style.left = '10px';
    this.debugInfo.style.background = 'rgba(0,0,0,0.7)';
    this.debugInfo.style.color = 'white';
    this.debugInfo.style.padding = '5px';
    this.debugInfo.style.fontSize = '12px';
    this.debugInfo.style.borderRadius = '4px';
    this.debugInfo.style.zIndex = '1000';
    this.debugInfo.style.display = 'none'; // Hidden by default
    document.body.appendChild(this.debugInfo);
  }
  
  /**
   * Set the items for the virtual list
   * @param {Array} items - Array of data items
   */
  setItems(items) {
    console.log(`VirtualList: Setting ${items.length} items`);
    this.items = items;
    
    // Update the spacer height to reflect the total content height
    this.spacer.style.height = `${this.items.length * this.itemHeight}px`;
    
    // Re-render visible items
    this.updateVisibleItems();
  }
  
  /**
   * Handle scroll events to update which items are visible
   */
  handleScroll() {
    // Only update if scroll position changed significantly (at least 50px)
    const newScrollTop = this.container.scrollTop;
    if (Math.abs(newScrollTop - this.scrollTop) < 50) return;
    
    this.scrollTop = newScrollTop;
    this.updateVisibleItems();
    
    // Update debug info
    this.updateDebugInfo();
  }
  
  /**
   * Update the list of visible items based on current scroll position
   */
  updateVisibleItems() {
    const { scrollTop, viewportHeight } = this;
    
    // Calculate visible range (with overscan)
    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    const endIndex = Math.min(
      this.items.length - 1,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.overscan
    );
    
    // Get the items that should be visible
    const newVisibleItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= 0 && i < this.items.length) {
        newVisibleItems.push({
          item: this.items[i],
          index: i,
          top: i * this.itemHeight
        });
      }
    }
    
    // Update the visibleItems array
    this.visibleItems = newVisibleItems;
    
    // Render the visible items
    this.renderVisibleItems();
    
    // Log the update
    console.log(`VirtualList: Showing items ${startIndex}-${endIndex} of ${this.items.length}`);
  }
  
  /**
   * Render the currently visible items
   */
  renderVisibleItems() {
    // Create a set of keys that should be visible
    const visibleKeys = new Set(this.visibleItems.map(item => this.getItemKey(item.item)));
    
    // Remove items that are no longer visible
    for (const [key, element] of this.renderedItems.entries()) {
      if (!visibleKeys.has(key)) {
        // Remove from DOM and from our tracking map
        this.itemContainer.removeChild(element);
        this.renderedItems.delete(key);
      }
    }
    
    // Add new items that should be visible
    this.visibleItems.forEach(({ item, top }) => {
      const key = this.getItemKey(item);
      
      // Skip if already rendered
      if (this.renderedItems.has(key)) {
        // Just update the position
        const element = this.renderedItems.get(key);
        element.style.transform = `translateY(${top}px)`;
        return;
      }
      
      // Create new element
      const element = this.createItemFn(item);
      
      // Position the element absolutely
      element.style.position = 'absolute';
      element.style.top = '0';
      element.style.left = '0';
      element.style.width = '100%';
      element.style.transform = `translateY(${top}px)`;
      
      // Add to DOM and track it
      this.itemContainer.appendChild(element);
      this.renderedItems.set(key, element);
    });
  }
  
  /**
   * Handle resize events to update viewport dimensions
   */
  resize() {
    // Update viewport size
    this.viewportHeight = this.container.clientHeight;
    
    // Re-calculate visible items since more/fewer might be visible
    this.updateVisibleItems();
    
    // Update debug info
    this.updateDebugInfo();
    
    console.log(`VirtualList: Resized, viewport height = ${this.viewportHeight}px`);
  }
  
  /**
   * Update debug information display
   */
  updateDebugInfo() {
    if (this.debugInfo.style.display === 'none') return;
    
    this.debugInfo.innerHTML = `
      <div>Total items: ${this.items.length}</div>
      <div>Rendered items: ${this.renderedItems.size}</div>
      <div>Viewport: ${this.viewportHeight}px</div>
      <div>Scroll: ${Math.round(this.scrollTop)}px</div>
    `;
  }
  
  /**
   * Toggle debug information display
   */
  toggleDebugInfo() {
    this.debugInfo.style.display = 
      this.debugInfo.style.display === 'none' ? 'block' : 'none';
    
    if (this.debugInfo.style.display !== 'none') {
      this.updateDebugInfo();
    }
  }
  
  /**
   * Clean up event listeners when no longer needed
   */
  destroy() {
    this.container.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.resize);
    
    if (this.debugInfo.parentNode) {
      this.debugInfo.parentNode.removeChild(this.debugInfo);
    }
  }
}
