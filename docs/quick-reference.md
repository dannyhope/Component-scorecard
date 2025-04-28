# Component Scorecard Quick Reference

Quick reference guide for common tasks when working with the Component Scorecard plugin.

## Common Commands

| Task | Command | Description |
|------|---------|-------------|
| Development | `npm run dev` | Start development build with watch mode |
| Testing | `npm run test` | Run automated tests |
| Production | `npm run build:prod` | Create production build |
| Deploy | `npm run deploy` | Build and deploy (customize path in package.json) |

## Debugging

- Click "Debug" in the plugin footer to access the debug panel
- Click "Run Tests" in the debug panel to run tests
- Use the browser console for more detailed logs

## Error Handling

Report errors with proper categorization:

```javascript
errorManager.report(
  error,          // Error object or message string
  'STORAGE',      // Category: STORAGE, COMPONENT, PLUGIN, UI, NETWORK
  'ERROR',        // Severity: CRITICAL, ERROR, WARNING, INFO
  { context }     // Additional context
);
```

## Show Notifications

Display notifications to users:

```javascript
// Show error notification
notifications.error('Title', 'Message');

// Show success notification
notifications.success('Title', 'Message');

// Show info notification
notifications.info('Title', 'Message', 3000); // Auto-dismiss after 3 seconds
```

## State Machine

Control UI workflow with the state machine:

```javascript
// Transition to a new state
pluginStateMachine.transition('loading', { componentId: '123' });

// Add state change listener
pluginStateMachine.addListener(state => {
  console.log(`State changed to: ${state}`);
});
```

## Storage Operations

Access stored data:

```javascript
// Get component data
const component = storageManager.getComponentWithData(componentId);

// Update checkbox state
await storageManager.setCheckboxState(
  componentId,
  category,
  ruleText,
  true
);

// Get component score
const score = storageManager.calculateComponentScore(componentId, rules);
```

## Adding New Tests

Create a test file in `/plugin/tests/`:

```javascript
const myTestSuite = {
  name: 'My Test Suite',
  
  setup(runner) {
    // Add test cases
    runner.test('should work correctly', () => {
      const result = doSomething();
      assert.isTrue(result);
    });
  }
};
```

Then register it in `ui.html`:

1. Add script reference in head
2. Register in test UI: `testUI.registerTestSuites({ 'my-suite': myTestSuite })`

## Common Patterns

### Creating a Component Section

```javascript
function createSection(component) {
  const section = document.createElement('div');
  section.className = 'component-section';
  section.setAttribute('data-id', component.id);
  
  // Add component title
  const title = createComponentTitle(component);
  section.appendChild(title);
  
  // Add checkboxes
  const checkboxes = createCheckboxes(component);
  section.appendChild(checkboxes);
  
  return section;
}
```

### Handling User Input

```javascript
document.addEventListener('change', event => {
  // Stop event propagation to prevent component collapsing
  event.stopPropagation();
  
  // Handle input
  if (event.target.type === 'checkbox') {
    handleCheckboxEvent(event);
  }
});
```
