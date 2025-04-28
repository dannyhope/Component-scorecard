# User Stories

## As a design system maintainer

### Scoring components
**Given** I have a component that needs quality assessment  
**When** I select the component  
**Then** I can see a checklist of quality criteria  
**And** I can check/uncheck items  
**And** I can see the component's quality score update in real-time

### Component selection and criteria visibility
**Given** I am reviewing components in the list  
**When** I click on a component name  
**Then** it expands to show its criteria  
**And** it selects the corresponding component in Figma

**Given** I have selected a component in Figma  
**When** the plugin receives the selection event  
**Then** it expands and highlights the component in the list  
**And** scrolls to make it visible

**Given** I have expanded a component's criteria  
**When** I deselect the component in Figma  
**Then** the criteria remain visible  
**And** only the highlight is removed from the component

## Usability Testing Tasks

### Component Selection and Visibility

**Task:** Work with component selection and criteria visibility

1. Find a component named "Button" in the list and click on it to expand its criteria
2. Verify that the Button component is selected in Figma
3. Check a few criteria boxes for this component
4. Select a different component in Figma
5. Verify that the Button's criteria remain visible in the plugin
6. Click on another component in the plugin list
7. Verify that its criteria expand while the Button's criteria remain visible
8. Try clicking on a component's expand/collapse arrow and verify it correctly toggles the visibility

**Success criteria:**
- Components properly expand when clicked
- Component selection in the plugin and Figma stay in sync
- Criteria remain visible when a component is deselected
- The toggle arrow correctly reflects the expanded/collapsed state

### Customizing criteria
**Given** I have specific quality requirements  
**When** I edit the checklist  
**Then** the criteria are updated for all components  
**And** existing scores are recalculated

### Working with new components
**Given** I have created new components in my Figma file  
**When** I click the refresh button in the plugin  
**Then** the new components appear in the list  
**And** I can assess their quality immediately

### Focusing on component quality
**Given** I want to focus on component quality assessment  
**When** I use the plugin  
**Then** I see a simplified interface without distracting details  
**And** I can concentrate on the quality criteria checklist

### Reporting issues
**Given** I encounter a problem while using the plugin  
**When** I click the "Issues" link  
**Then** I am taken to the GitHub Issues page  
**And** I can easily report bugs or suggest improvements

## As a designer

### Finding component quality
**Given** I'm looking for a component to use  
**When** I browse components  
**Then** I can see their quality scores  
**And** understand what criteria they meet or don't meet

### Exporting quality data
**Given** I need to share component quality information with my team  
**When** I use the export feature  
**Then** I can download a CSV file with all component quality data  
**And** I can analyze quality trends across the design system

### Debugging plugin issues
**Given** I encounter unexpected behavior in the plugin  
**When** I check the console logs  
**Then** I can see detailed information about what's happening  
**And** I can provide this information when reporting issues

### Hiding completed items
**Given** I want to focus on incomplete criteria  
**When** I check the "Hide completed" checkbox  
**Then** all checked criteria are hidden  
**And** components with all criteria checked are hidden  
**And** I only see components and criteria that need attention

**Given** I have the "Hide completed" checkbox checked  
**When** I check off a criterion  
**Then** that criterion remains visible until I toggle the checkbox  
**And** previously hidden criteria remain hidden

**Given** I have the "Hide completed" checkbox checked  
**When** I uncheck the "Hide completed" checkbox  
**Then** all components and criteria become visible again  
**And** I can see my complete progress
**When** I need to troubleshoot  
**Then** I can access debug information  
**And** I can report detailed information to help fix the issue