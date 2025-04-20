// Shared utilities for score calculation and formatting

/**
 * Calculate component score metrics from component state
 * @param {Object} componentState - Component's checkbox state object
 * @param {number} defaultTotal - Default total to use if no rules found
 * @returns {Object} Score metrics including checkedCount, totalRules, percentage and colorClass
 */
function calculateScoreMetrics(componentState, defaultTotal = 5) {
  // Handle empty state
  if (!componentState || Object.keys(componentState).length === 0) {
    return {
      checkedCount: 0,
      totalRules: defaultTotal,
      percentage: 0,
      colorClass: 'score-red'
    };
  }

  // Count checked rules 
  const checkedCount = Object.values(componentState)
    .flatMap(categoryState => Object.values(categoryState))
    .filter(state => state && state.checked === true).length;

  // Count total rules
  let totalRules = Object.values(componentState)
    .flatMap(categoryState => Object.values(categoryState))
    .length;
    
  // Use default if no rules found
  if (totalRules === 0) {
    totalRules = defaultTotal;
  }

  // Calculate percentage and color class
  const percentage = (checkedCount / totalRules) * 100;
  let colorClass = 'score-red';
  
  if (percentage > 66) {
    colorClass = 'score-green';
  } else if (percentage > 33) {
    colorClass = 'score-amber';
  }

  return {
    checkedCount,
    totalRules,
    percentage,
    colorClass
  };
}

// Export if supported (for UI we'll include this directly)
if (typeof module !== 'undefined') {
  module.exports = {
    calculateScoreMetrics
  };
}
