/**
 * NotificationManager - Centralized notification system for the Component Scorecard plugin
 * 
 * Provides a unified interface for displaying different types of notifications
 * (error, warning, info, success) with consistent styling and behavior.
 */

class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = [];
    this.maxNotifications = 5;
    this.defaultDuration = 5000; // 5 seconds
  }

  /**
   * Initialize the notification manager
   */
  init() {
    this.container = document.getElementById('notification-container');
    if (!this.container) {
      console.error('Notification container not found');
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      document.body.appendChild(this.container);
    }
  }

  /**
   * Create a new notification
   * @param {string} type - Notification type: error, warning, info, success
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {number} duration - How long to show notification (ms), 0 for no auto-dismiss
   * @returns {Object} The notification object
   */
  show(type, title, message, duration = this.defaultDuration) {
    // Initialize if not already done
    if (!this.container) {
      this.init();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Add icon based on type
    let iconSvg = '';
    switch (type) {
      case 'error':
        iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="#E4003D" stroke-width="2"/><path d="M13 7L7 13" stroke="#E4003D" stroke-width="2"/><path d="M7 7L13 13" stroke="#E4003D" stroke-width="2"/></svg>';
        break;
      case 'warning':
        iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M9.99999 17.3333C14.0517 17.3333 17.3333 14.0517 17.3333 9.99999C17.3333 5.94832 14.0517 2.66666 9.99999 2.66666C5.94832 2.66666 2.66666 5.94832 2.66666 9.99999C2.66666 14.0517 5.94832 17.3333 9.99999 17.3333Z" stroke="#FFB200" stroke-width="2"/><path d="M10 6V10" stroke="#FFB200" stroke-width="2" stroke-linecap="round"/><path d="M10 13.3333V13.5" stroke="#FFB200" stroke-width="2" stroke-linecap="round"/></svg>';
        break;
      case 'info':
        iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M9.99999 17.3333C14.0517 17.3333 17.3333 14.0517 17.3333 9.99999C17.3333 5.94832 14.0517 2.66666 9.99999 2.66666C5.94832 2.66666 2.66666 5.94832 2.66666 9.99999C2.66666 14.0517 5.94832 17.3333 9.99999 17.3333Z" stroke="#60BFEB" stroke-width="2"/><path d="M10 6V6.5" stroke="#60BFEB" stroke-width="2" stroke-linecap="round"/><path d="M10 10V13.3333" stroke="#60BFEB" stroke-width="2" stroke-linecap="round"/></svg>';
        break;
      case 'success':
        iconSvg = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M9.99999 17.3333C14.0517 17.3333 17.3333 14.0517 17.3333 9.99999C17.3333 5.94832 14.0517 2.66666 9.99999 2.66666C5.94832 2.66666 2.66666 5.94832 2.66666 9.99999C2.66666 14.0517 5.94832 17.3333 9.99999 17.3333Z" stroke="#00B400" stroke-width="2"/><path d="M6.66666 10L9.16666 12.5L13.3333 7.5" stroke="#00B400" stroke-width="2"/></svg>';
        break;
    }
    
    const icon = document.createElement('div');
    icon.className = 'notification-icon';
    icon.innerHTML = iconSvg;
    
    // Create content
    const content = document.createElement('div');
    content.className = 'notification-content';
    
    const titleElement = document.createElement('div');
    titleElement.className = 'notification-title';
    titleElement.textContent = title;
    
    const messageElement = document.createElement('p');
    messageElement.className = 'notification-message';
    messageElement.textContent = message;
    
    content.appendChild(titleElement);
    content.appendChild(messageElement);
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.innerHTML = '&times;';
    closeButton.setAttribute('aria-label', 'Close notification');
    
    // Create progress bar for auto-dismiss
    const progressBar = document.createElement('div');
    progressBar.className = 'notification-progress';
    
    // Assemble notification
    notification.appendChild(icon);
    notification.appendChild(content);
    notification.appendChild(closeButton);
    if (duration > 0) {
      notification.appendChild(progressBar);
    }
    
    // Manage notification limit
    if (this.notifications.length >= this.maxNotifications) {
      this.removeOldest();
    }
    
    // Add to container
    this.container.appendChild(notification);
    
    // Store notification data
    const notificationData = {
      element: notification,
      type,
      title,
      message,
      timestamp: Date.now()
    };
    
    this.notifications.push(notificationData);
    
    // Add event listeners
    closeButton.addEventListener('click', () => {
      this.remove(notificationData);
    });
    
    // Auto-dismiss after duration if set
    if (duration > 0) {
      // Animate progress bar
      progressBar.style.width = '100%';
      progressBar.style.transition = `width ${duration}ms linear`;
      progressBar.offsetHeight; // Force reflow
      progressBar.style.width = '0%';
      
      setTimeout(() => {
        if (this.notifications.includes(notificationData)) {
          this.remove(notificationData);
        }
      }, duration);
    }
    
    // Add to debug panel if available
    if (window.debugPanel && debugPanel.isVisible) {
      this.addToDebugPanel(notificationData);
    }
    
    return notificationData;
  }
  
  /**
   * Remove a notification
   * @param {Object} notification - The notification to remove
   */
  remove(notification) {
    if (!notification || !notification.element) return;
    
    // Add slide out animation
    notification.element.style.animation = 'slideOut 0.3s ease-out forwards';
    
    // Remove after animation
    setTimeout(() => {
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
      
      // Remove from array
      const index = this.notifications.indexOf(notification);
      if (index !== -1) {
        this.notifications.splice(index, 1);
      }
    }, 300);
  }
  
  /**
   * Remove the oldest notification
   */
  removeOldest() {
    if (this.notifications.length === 0) return;
    
    // Find the oldest notification
    let oldest = this.notifications[0];
    for (let i = 1; i < this.notifications.length; i++) {
      if (this.notifications[i].timestamp < oldest.timestamp) {
        oldest = this.notifications[i];
      }
    }
    
    this.remove(oldest);
  }
  
  /**
   * Add notification to debug panel
   * @param {Object} notification - The notification to add to debug panel
   */
  addToDebugPanel(notification) {
    if (!window.debugPanel) return;
    
    const debugNotifications = document.getElementById('debug-notifications');
    if (!debugNotifications) return;
    
    const notificationItem = document.createElement('div');
    notificationItem.className = `debug-notification ${notification.type}`;
    notificationItem.innerHTML = `
      <span class="time">${new Date().toLocaleTimeString()}</span>
      <span class="type">${notification.type}</span>
      <span class="title">${notification.title}:</span>
      <span class="message">${notification.message}</span>
    `;
    
    debugNotifications.appendChild(notificationItem);
    
    // Limit debug notifications
    const maxDebugNotifications = 20;
    const items = debugNotifications.children;
    if (items.length > maxDebugNotifications) {
      debugNotifications.removeChild(items[0]);
    }
  }
  
  /**
   * Show an error notification
   * @param {string} title - Error title
   * @param {string} message - Error message
   * @param {number} duration - How long to show notification (ms), 0 for no auto-dismiss
   * @returns {Object} The notification object
   */
  error(title, message, duration = this.defaultDuration) {
    return this.show('error', title, message, duration);
  }
  
  /**
   * Show a warning notification
   * @param {string} title - Warning title
   * @param {string} message - Warning message
   * @param {number} duration - How long to show notification (ms), 0 for no auto-dismiss
   * @returns {Object} The notification object
   */
  warning(title, message, duration = this.defaultDuration) {
    return this.show('warning', title, message, duration);
  }
  
  /**
   * Show an info notification
   * @param {string} title - Info title
   * @param {string} message - Info message
   * @param {number} duration - How long to show notification (ms), 0 for no auto-dismiss
   * @returns {Object} The notification object
   */
  info(title, message, duration = this.defaultDuration) {
    return this.show('info', title, message, duration);
  }
  
  /**
   * Show a success notification
   * @param {string} title - Success title
   * @param {string} message - Success message
   * @param {number} duration - How long to show notification (ms), 0 for no auto-dismiss
   * @returns {Object} The notification object
   */
  success(title, message, duration = this.defaultDuration) {
    return this.show('success', title, message, duration);
  }
  
  /**
   * Clear all notifications
   */
  clearAll() {
    for (const notification of [...this.notifications]) {
      this.remove(notification);
    }
  }
}

// Create global instance
window.notifications = new NotificationManager();
