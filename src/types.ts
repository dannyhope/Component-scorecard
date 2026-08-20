export type CheckboxState = {
  checked: boolean
  timestamp: string | null
}

export type ComponentStates = Record<string, Record<string, CheckboxState>>

export type ViewState = {
  collapsed: boolean
  userToggled: boolean
}

export type UserPreferences = {
  hideCompleted: boolean
}

export type ScorecardComponent = {
  id: string
  name: string
  pageId: string
  pageName: string
  usageCount: number
  dependencyCount: number
  lastModified: string | null
}

export type ParsedRules = {
  categories: Array<{ name: string; rules: string[] }>
  totalRules: number
}

export type LoadPayload = {
  components: ScorecardComponent[]
  checkboxStates: Record<string, ComponentStates>
  viewStates: Record<string, ViewState>
  userPreferences: UserPreferences
  customRules: string
  selectedComponentIds: string[] | null
}

export interface LoadHandler {
  name: 'LOAD'
  handler: (payload: LoadPayload) => void
}

export interface WarningHandler {
  name: 'WARNING'
  handler: (message: string) => void
}

export interface ErrorHandler {
  name: 'ERROR'
  handler: (message: string) => void
}

export interface FilterHandler {
  name: 'FILTER'
  handler: (selectedComponentIds: string[] | null) => void
}

export interface ScoreHandler {
  name: 'SCORE'
  handler: (componentId: string, checkedCount: number) => void
}

export interface SelectComponentHandler {
  name: 'SELECT_COMPONENT'
  handler: (componentId: string) => void
}

export interface CheckboxChangedHandler {
  name: 'CHECKBOX_CHANGED'
  handler: (payload: {
    componentId: string
    category: string
    label: string
    isChecked: boolean
    applyToAll: boolean
  }) => void
}

export interface SaveViewStateHandler {
  name: 'SAVE_VIEW_STATE'
  handler: (payload: { componentId: string; collapsed: boolean; userToggled: boolean }) => void
}

export interface SavePreferencesHandler {
  name: 'SAVE_PREFERENCES'
  handler: (preferences: UserPreferences) => void
}

export interface SaveRulesHandler {
  name: 'SAVE_RULES'
  handler: (customRules: string) => void
}

export interface RefreshHandler {
  name: 'REFRESH'
  handler: () => void
}

export const DEFAULT_RULES = `Sizing, layout
- [ ] Resizes sensibly (including a sensible default size)
- [ ] Uses auto layout where appropriate
- [ ] Has appropriate spacers/padding (toggleable where appropriate)
- [ ] Respects the grid (line height, paragraph spacing, list spacing)
- [ ] Proportions of drag-resizable components are constrained where appropriate

Naming
- [ ] Text layers have descriptive names

Accessibility
- [ ] WCAG 2 AA contrast

Lint
- [ ] No design lint
- [ ] Components all the way down (where appropriate)

Properties and variants
- [ ] It is clear how to swap any images the component contains
- [ ] Expose nested instances is selected
- [ ] Simplify all instances is selected
- [ ] Uses variables or styles for fills, strokes, and spacing

Instances
- [ ] There is at least one instance of the component in the file

Deprecated components
- [ ] If it is deprecated, it says why and what to use instead
`
