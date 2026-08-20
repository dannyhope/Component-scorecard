import {
  Checkbox,
  Container,
  Muted,
  render,
  Text,
  TextboxMultiline,
  VerticalSpace
} from '@create-figma-plugin/ui'
import { emit, on } from '@create-figma-plugin/utilities'
import { Fragment, h, JSX } from 'preact'
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'

import { checkedCountForComponent, parseRules } from './parse-rules'
import {
  CheckboxChangedHandler,
  ComponentStates,
  DEFAULT_RULES,
  ErrorHandler,
  FilterHandler,
  LoadHandler,
  LoadPayload,
  RefreshHandler,
  SavePreferencesHandler,
  SaveRulesHandler,
  SaveViewStateHandler,
  ScorecardComponent,
  ScoreHandler,
  SelectComponentHandler,
  UserPreferences,
  ViewState,
  WarningHandler
} from './types'

import '!./ui.css'

function scoreClass(checked: number, total: number): string {
  if (total === 0) return 'score-muted'
  const percent = (checked / total) * 100
  if (percent <= 40) return 'score-red'
  if (percent <= 70) return 'score-amber'
  return 'score-green'
}

function formatEdited(iso: string | null): string {
  if (!iso) return 'not scored yet'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'not scored yet'
  return `edited ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

function Plugin() {
  const [payload, setPayload] = useState<LoadPayload | null>(null)
  const [filterIds, setFilterIds] = useState<string[] | null>(null)
  const [banner, setBanner] = useState<{ kind: 'error' | 'warning'; text: string } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; componentId: string; category: string; label: string } | null>(null)

  useEffect(() => {
    return on<LoadHandler>('LOAD', (next) => {
      setPayload(next)
      setFilterIds(next.selectedComponentIds)
      setBanner(null)
    })
  }, [])

  useEffect(() => {
    return on<FilterHandler>('FILTER', setFilterIds)
  }, [])

  useEffect(() => {
    return on<ScoreHandler>('SCORE', (componentId, checkedCount) => {
      setPayload((current) => {
        if (!current) return current
        const checkboxStates = { ...current.checkboxStates }
        return { ...current, checkboxStates, components: current.components.map((component) => component) }
      })
      void componentId
      void checkedCount
    })
  }, [])

  useEffect(() => {
    return on<WarningHandler>('WARNING', (text) => setBanner({ kind: 'warning', text }))
  }, [])

  useEffect(() => {
    return on<ErrorHandler>('ERROR', (text) => setBanner({ kind: 'error', text }))
  }, [])

  const rules = useMemo(() => parseRules(payload?.customRules ?? DEFAULT_RULES), [payload?.customRules])

  const hideCompleted = payload?.userPreferences.hideCompleted ?? false

  const visibleComponents = useMemo(() => {
    if (!payload) return []
    return payload.components.filter((component) => {
      if (filterIds && !filterIds.includes(component.id)) return false
      if (!hideCompleted) return true
      const checked = checkedCountForComponent(payload.checkboxStates[component.id], rules)
      return checked < rules.totalRules
    })
  }, [payload, filterIds, hideCompleted, rules])

  const hiddenCount = payload ? payload.components.length - visibleComponents.length : 0

  const updatePreference = useCallback(
    (preferences: UserPreferences) => {
      setPayload((current) => (current ? { ...current, userPreferences: preferences } : current))
      emit<SavePreferencesHandler>('SAVE_PREFERENCES', preferences)
    },
    []
  )

  const toggleCollapsed = useCallback((componentId: string, collapsed: boolean) => {
    setPayload((current) => {
      if (!current) return current
      const viewStates = {
        ...current.viewStates,
        [componentId]: { collapsed, userToggled: true }
      }
      emit<SaveViewStateHandler>('SAVE_VIEW_STATE', { componentId, collapsed, userToggled: true })
      return { ...current, viewStates }
    })
  }, [])

  const onCheck = useCallback(
    (componentId: string, category: string, label: string, isChecked: boolean, applyToAll = false) => {
      setPayload((current) => {
        if (!current) return current
        const nextStates = { ...current.checkboxStates }
        const ids = applyToAll ? current.components.map((component) => component.id) : [componentId]
        for (const id of ids) {
          const componentState: ComponentStates = { ...(nextStates[id] ?? {}) }
          const categoryState = { ...(componentState[category] ?? {}) }
          categoryState[label] = { checked: isChecked, timestamp: isChecked ? new Date().toISOString() : null }
          componentState[category] = categoryState
          nextStates[id] = componentState
        }
        return { ...current, checkboxStates: nextStates }
      })
      emit<CheckboxChangedHandler>('CHECKBOX_CHANGED', {
        componentId,
        category,
        label,
        isChecked,
        applyToAll
      })
      setMenu(null)
    },
    []
  )

  if (!payload) {
    return (
      <Container space="medium">
        <VerticalSpace space="medium" />
        <Muted>Loading components…</Muted>
      </Container>
    )
  }

  return (
    <div class="app" onClick={() => setMenu(null)}>
      {banner ? <div class={`banner ${banner.kind}`}>{banner.text}</div> : null}
      <div class="list">
        {visibleComponents.length === 0 ? (
          <div class="empty">
            <Text>No standalone components in this file.</Text>
            <Muted>Variants inside a set are skipped. Create a component, then refresh.</Muted>
          </div>
        ) : (
          visibleComponents.map((component) => (
            <ComponentRow
              key={component.id}
              component={component}
              rules={rules}
              states={payload.checkboxStates[component.id]}
              view={payload.viewStates[component.id]}
              selected={Boolean(filterIds?.length === 1 && filterIds[0] === component.id)}
              hideCompleted={hideCompleted}
              onToggle={() => {
                const collapsed = payload.viewStates[component.id]?.collapsed ?? true
                toggleCollapsed(component.id, !collapsed)
              }}
              onSelect={() => emit<SelectComponentHandler>('SELECT_COMPONENT', component.id)}
              onCheck={onCheck}
              onMenu={(event, category, label) => {
                event.preventDefault()
                event.stopPropagation()
                setMenu({
                  x: event.clientX,
                  y: event.clientY,
                  componentId: component.id,
                  category,
                  label
                })
              }}
            />
          ))
        )}
      </div>
      <div class="checklist-editor">
        <Text>Define your checklist</Text>
        <VerticalSpace space="extraSmall" />
        <TextboxMultiline
          rows={6}
          value={payload.customRules}
          onValueInput={(value: string) => {
            setPayload((current) => (current ? { ...current, customRules: value } : current))
          }}
          onBlur={(event) => {
            emit<SaveRulesHandler>('SAVE_RULES', event.currentTarget.value)
          }}
        />
      </div>
      <footer class="footer">
        <label class="hide-completed">
          <Checkbox
            value={hideCompleted}
            onValueChange={(value: boolean) => updatePreference({ hideCompleted: value })}
          >
            <Text>Hide completed</Text>
          </Checkbox>
        </label>
        <div class="footer-links">
          {hiddenCount > 0 && hideCompleted ? <Muted>{hiddenCount} hidden</Muted> : null}
          <button type="button" class="text-button" onClick={() => emit<RefreshHandler>('REFRESH')}>
            Refresh
          </button>
          <a href="https://dannyhope.co.uk/feedback" target="_blank" rel="noreferrer">
            Feedback
          </a>
          <a class="attribution" href="https://dannyhope.co.uk" target="_blank" rel="noreferrer">
            A Danny Hope plugin
          </a>
        </div>
      </footer>
      {menu ? (
        <button
          type="button"
          class="context-menu"
          style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
          onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            const checked =
              payload.checkboxStates[menu.componentId]?.[menu.category]?.[menu.label]?.checked ?? false
            onCheck(menu.componentId, menu.category, menu.label, !checked, true)
          }}
        >
          Apply to all components
        </button>
      ) : null}
    </div>
  )
}

function ComponentRow(props: {
  component: ScorecardComponent
  rules: ReturnType<typeof parseRules>
  states: ComponentStates | undefined
  view: ViewState | undefined
  selected: boolean
  hideCompleted: boolean
  onToggle: () => void
  onSelect: () => void
  onCheck: (componentId: string, category: string, label: string, isChecked: boolean) => void
  onMenu: (event: JSX.TargetedMouseEvent<HTMLLabelElement>, category: string, label: string) => void
}) {
  const collapsed = props.view?.collapsed ?? true
  const checked = checkedCountForComponent(props.states, props.rules)
  const total = props.rules.totalRules

  return (
    <div class={`component ${props.selected ? 'selected' : ''}`}>
      <div
        class="component-title"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => {
          props.onSelect()
          if (collapsed) props.onToggle()
        }}
        onKeyDown={(event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            props.onSelect()
            if (collapsed) props.onToggle()
          }
        }}
      >
        <button
          type="button"
          class={`chevron ${collapsed ? 'collapsed' : ''}`}
          aria-label={collapsed ? 'Show criteria' : 'Hide criteria'}
          onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            props.onToggle()
          }}
        >
          ▼
        </button>
        <span class="diamond" aria-hidden="true">
          ❖
        </span>
        <span class="name">
          {props.component.name}
          {props.component.dependencyCount > 0 ? (
            <span class="deps" title="Nested component instances">
              {props.component.dependencyCount}
            </span>
          ) : null}
        </span>
        <span class={`score ${scoreClass(checked, total)}`}>
          {checked}/{total}
        </span>
        <span class="edited">{formatEdited(props.component.lastModified)}</span>
      </div>
      {collapsed ? null : (
        <div class="criteria">
          {props.rules.categories.map((category) => {
            const visibleRules = props.hideCompleted
              ? category.rules.filter((rule) => !props.states?.[category.name]?.[rule]?.checked)
              : category.rules
            if (visibleRules.length === 0) return null
            return (
              <Fragment key={category.name || 'ungrouped'}>
                {category.name ? <div class="category">{category.name}</div> : null}
                {visibleRules.map((rule) => {
                  const isChecked = Boolean(props.states?.[category.name]?.[rule]?.checked)
                  return (
                    <label
                      key={rule}
                      class="rule"
                      onContextMenu={(event: JSX.TargetedMouseEvent<HTMLLabelElement>) =>
                        props.onMenu(event, category.name, rule)
                      }
                    >
                      <Checkbox
                        value={isChecked}
                        onValueChange={(value: boolean) =>
                          props.onCheck(props.component.id, category.name, rule, value)
                        }
                      >
                        <Text>{rule}</Text>
                      </Checkbox>
                    </label>
                  )
                })}
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default render(Plugin)
