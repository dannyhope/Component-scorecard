import {
  CheckboxState,
  ComponentStates,
  DEFAULT_RULES,
  UserPreferences,
  ViewState
} from './types'

const KEYS = {
  checkboxStates: 'checkboxStates',
  modifiedDates: 'modifiedDates',
  viewStates: 'viewStates',
  userPreferences: 'userPreferences',
  customRules: 'customRules'
} as const

export type StoredData = {
  checkboxStates: Record<string, ComponentStates>
  modifiedDates: Record<string, string>
  viewStates: Record<string, ViewState>
  userPreferences: UserPreferences
  customRules: string
}

async function read<T>(key: string, fallback: T): Promise<T> {
  const value = await figma.clientStorage.getAsync(key)
  return (value as T | undefined) ?? fallback
}

export async function loadStoredData(): Promise<StoredData> {
  const [checkboxStates, modifiedDates, viewStates, userPreferences, customRules] =
    await Promise.all([
      read<Record<string, ComponentStates>>(KEYS.checkboxStates, {}),
      read<Record<string, string>>(KEYS.modifiedDates, {}),
      read<Record<string, ViewState>>(KEYS.viewStates, {}),
      read<UserPreferences>(KEYS.userPreferences, { hideCompleted: false }),
      read<string | null>(KEYS.customRules, null)
    ])

  return {
    checkboxStates,
    modifiedDates,
    viewStates,
    userPreferences: {
      hideCompleted: Boolean(userPreferences?.hideCompleted)
    },
    customRules: customRules ?? DEFAULT_RULES
  }
}

export async function persistStoredData(data: StoredData): Promise<void> {
  await Promise.all([
    figma.clientStorage.setAsync(KEYS.checkboxStates, data.checkboxStates),
    figma.clientStorage.setAsync(KEYS.modifiedDates, data.modifiedDates),
    figma.clientStorage.setAsync(KEYS.viewStates, data.viewStates),
    figma.clientStorage.setAsync(KEYS.userPreferences, data.userPreferences),
    figma.clientStorage.setAsync(KEYS.customRules, data.customRules)
  ])
}

export function setCheckbox(
  data: StoredData,
  targetIds: string[],
  category: string,
  label: string,
  isChecked: boolean
): StoredData {
  const timestamp = isChecked ? new Date().toISOString() : null
  const nextState: CheckboxState = { checked: isChecked, timestamp }
  const checkboxStates = { ...data.checkboxStates }
  const modifiedDates = { ...data.modifiedDates }

  for (const id of targetIds) {
    const component = { ...(checkboxStates[id] ?? {}) }
    const categoryState = { ...(component[category] ?? {}) }
    const previous = categoryState[label]?.checked ?? false
    categoryState[label] = nextState
    component[category] = categoryState
    checkboxStates[id] = component
    if (previous !== isChecked) {
      modifiedDates[id] = new Date().toISOString()
    }
  }

  return { ...data, checkboxStates, modifiedDates }
}
