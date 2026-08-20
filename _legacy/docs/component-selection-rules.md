# Component Selection and Toggle Triangle Behaviour

Here’s an exhaustive summary of the desired behaviour for component selection and the toggle triangle.

### Component Selection Behaviour

### **Clicking a component name in the list:**

- Selects the component as "selected" in the plugin (adds the `selected` class)
- Sets the component as selected in the plugin UI
- Ensures that the component’s criteria list is expanded
- Marks the expansion as auto-expanded (`userToggled` = `false`)
- Records the component ID as `lastAutoExpandedId`

### **Selecting a component in Figma:**

- Sets the component as "selected" in the plugin (adds the `selected` class)
- Expands the component’s criteria list if it was collapsed
- Marks the expansion as auto-expanded (`userToggled` = `false`)
- Records the component ID as `lastAutoExpandedId`
- Scrolls to the component in the plugin UI

### **Deselecting a component in Figma:**

- Removes the "selected" state from all components (removes the `selected` class)
- DOES NOT collapse any components’ criteria list
- Resets the `lastAutoExpandedId` tracking

### Toggle Triangle Behaviour

### **Toggles (click the toggle triangle):**

- Toggles the component’s criteria list (expands if collapsed, collapses if expanded)
- Marks the triangle state as user-controlled (`userToggled` = `true`)
- Persists the user’s preference to storage

### **Updates accessibility attributes for screen readers:**

- When a component is auto-expanded due to selection, the triangle rotates but remains user toggleable (`userToggled` = `false`)
- If the user has previously manually toggled a component, that preference is respected
- Previous auto-expanded components are automatically collapsed when a new component is selected (unless manually toggled)

### **Manual closing after auto-expansion:**

- When a user manually closes a component that was auto-expanded, it’s marked as `userToggled` = `true`
- This prevents the component from being auto-expanded again unless manually expanded
- The triangle rotates to indicate the collapsed state

### State Tracking

### **Component state tracking:**

- For each component, track: `collapsed` (boolean) and `userToggled` (boolean)
- `collapsed` indicates the current visual state of the criteria list
- `userToggled` indicates whether the state was manually set by the user
- The state is persisted to storage via the `saveViewState` message

### **Auto-expanded tracking:**

- Track the last auto-expanded component via `lastAutoExpandedId`
- Only auto-collapse components that were auto-expanded (not user-toggled)
- NEVER auto-collapse components that were expanded by the user
- When no components are currently selected in Figma, clear the record of which component was last automatically expanded.

### Visual Indicators

### **Triangle orientation:**

- Pointing right (rotated 90deg) when criteria are hidden
- Pointing down (rotated 0deg) when criteria are visible

### **Selection indication:**

- Selected components have the `selected` class
- The visually distinguishes them from non-selected components
