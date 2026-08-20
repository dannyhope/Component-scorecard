import { emit, on, showUI } from '@create-figma-plugin/utilities'

import { listStandaloneComponents, selectComponentInEditor, selectionComponentIds, toScorecardComponents } from './document'
import { parseRules } from './parse-rules'
import { loadStoredData, persistStoredData, setCheckbox, StoredData } from './storage'
import {
  CheckboxChangedHandler,
  ErrorHandler,
  FilterHandler,
  LoadHandler,
  LoadPayload,
  RefreshHandler,
  SavePreferencesHandler,
  SaveRulesHandler,
  SaveViewStateHandler,
  ScoreHandler,
  SelectComponentHandler,
  WarningHandler
} from './types'

let store: StoredData

async function payload(selectedComponentIds: string[] | null): Promise<LoadPayload> {
  const components = await listStandaloneComponents()
  const scorecard = await toScorecardComponents(components, store.modifiedDates)
  for (const component of scorecard) {
    if (!store.modifiedDates[component.id]) {
      store.modifiedDates[component.id] = new Date().toISOString()
    }
  }
  await persistStoredData(store)
  return {
    components: scorecard,
    checkboxStates: store.checkboxStates,
    viewStates: store.viewStates,
    userPreferences: store.userPreferences,
    customRules: store.customRules,
    selectedComponentIds
  }
}

async function pushLoad(selectedComponentIds: string[] | null = selectionComponentIds(figma.currentPage.selection)): Promise<void> {
  try {
    emit<LoadHandler>('LOAD', await payload(selectedComponentIds))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emit<ErrorHandler>('ERROR', `Could not load components: ${message}`)
  }
}

export default async function (): Promise<void> {
  store = await loadStoredData()
  showUI({ width: 400, height: 640, title: 'Component scorecard' })

  try {
    await figma.loadAllPagesAsync()
  } catch {
    emit<WarningHandler>('WARNING', 'Some pages could not be loaded, so the list may be incomplete.')
  }

  await pushLoad()

  figma.on('selectionchange', () => {
    emit<FilterHandler>('FILTER', selectionComponentIds(figma.currentPage.selection))
  })

  let documentChangeTimer: ReturnType<typeof setTimeout> | undefined
  figma.on('documentchange', () => {
    if (documentChangeTimer) clearTimeout(documentChangeTimer)
    documentChangeTimer = setTimeout(async () => {
      try {
        await figma.loadAllPagesAsync()
        await pushLoad()
      } catch {
        emit<WarningHandler>('WARNING', 'Could not refresh after a document change.')
      }
    }, 400)
  })

  on<SelectComponentHandler>('SELECT_COMPONENT', async (componentId) => {
    const found = await selectComponentInEditor(componentId)
    if (!found) emit<WarningHandler>('WARNING', 'That component is not on a loaded page.')
  })

  on<CheckboxChangedHandler>('CHECKBOX_CHANGED', async (msg) => {
    const ids = msg.applyToAll
      ? (await listStandaloneComponents()).map((component) => component.id)
      : [msg.componentId]
    store = setCheckbox(store, ids, msg.category, msg.label, msg.isChecked)
    await persistStoredData(store)
    const rules = parseRules(store.customRules)
    const state = store.checkboxStates[msg.componentId]
    let checkedCount = 0
    for (const category of rules.categories) {
      for (const rule of category.rules) {
        if (state?.[category.name]?.[rule]?.checked) checkedCount += 1
      }
    }
    emit<ScoreHandler>('SCORE', msg.componentId, checkedCount)
    if (msg.applyToAll) await pushLoad()
  })

  on<SaveViewStateHandler>('SAVE_VIEW_STATE', async (msg) => {
    store.viewStates[msg.componentId] = {
      collapsed: msg.collapsed,
      userToggled: msg.userToggled
    }
    await persistStoredData(store)
  })

  on<SavePreferencesHandler>('SAVE_PREFERENCES', async (preferences) => {
    store.userPreferences = preferences
    await persistStoredData(store)
  })

  on<SaveRulesHandler>('SAVE_RULES', async (customRules) => {
    store.customRules = customRules
    await persistStoredData(store)
    await pushLoad()
  })

  on<RefreshHandler>('REFRESH', async () => {
    await pushLoad()
  })
}
