# Component-scorecard
Design system quality check at the component level

A Figma plugin that allows you to track and score components based on a customizable checklist of design guidelines. This plugin dynamically updates the score of each component based on checked or unchecked items in real time. It also allows users to define their own set of design checks and automatically updates the list of checkboxes as the input is changed.

By default, the plugin comes pre-loaded with the following design checks:

```

Sizing, layout
- [ ] Resizes sensibly (including sensible default size)
- [ ] Uses Autolayout where appropriate
- [ ] has appropriate spacers/padding (toggle-able where appropriate)
- [ ] Respects the grid (line height, paragraph spacing, list spacing)
- [ ] proportions of drag-resizable components are constrained where appropriate

Naming
- [ ] Text layers have descriptive names (or at least are named Text, Text 2 etc.)

Accessibility
- [ ] WCAG2 A contrast

Lint
- [ ] No design lint (check with Design Lint plugin)
- [ ] Components all the way down (where appropriate)

Properties and variants
- [ ] It’s clear how to swap any images the component contains
- [ ] ‘Expose child element properties’ (design panel › ‘Properties’) is selected
- [ ] ‘Simplify all instances’ is selected
- [ ] Uses Figma tokens

Instances
- [ ] There is at least one instance of the component in existence

Deprecated components
- [ ] If it’s deprecated, it says why and what to do instead of using it

```

## What it looks like
![image](https://github.com/user-attachments/assets/c13b5e93-c620-452b-8d78-79e07c0204dd)
