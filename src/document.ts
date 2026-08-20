import { ScorecardComponent } from './types'

function pageOf(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node
  while (current && current.type !== 'PAGE') {
    current = current.parent
  }
  return current && current.type === 'PAGE' ? current : null
}

export function isStandaloneComponent(node: BaseNode): node is ComponentNode {
  return node.type === 'COMPONENT' && node.parent?.type !== 'COMPONENT_SET'
}

export async function listStandaloneComponents(): Promise<ComponentNode[]> {
  await figma.loadAllPagesAsync()
  const found: ComponentNode[] = []
  for (const page of figma.root.children) {
    const onPage = page.findAllWithCriteria({ types: ['COMPONENT'] })
    for (const component of onPage) {
      if (isStandaloneComponent(component)) found.push(component)
    }
  }
  return found
}

export async function analyseUsage(
  components: ComponentNode[]
): Promise<{ usageCounts: Map<string, number>; dependencyCounts: Map<string, number> }> {
  const usageCounts = new Map<string, number>()
  const dependencyCounts = new Map<string, number>()
  for (const component of components) {
    usageCounts.set(component.id, 0)
    dependencyCounts.set(component.id, 0)
  }
  for (const component of components) {
    const instances = component.findAllWithCriteria({ types: ['INSTANCE'] })
    dependencyCounts.set(component.id, instances.length)
    for (const instance of instances) {
      try {
        const main = await instance.getMainComponentAsync()
        if (main) {
          usageCounts.set(main.id, (usageCounts.get(main.id) ?? 0) + 1)
        }
      } catch {
        // Instance may point at a missing or library component
      }
    }
  }
  return { usageCounts, dependencyCounts }
}

export async function toScorecardComponents(
  components: ComponentNode[],
  modifiedDates: Record<string, string>
): Promise<ScorecardComponent[]> {
  const { usageCounts, dependencyCounts } = await analyseUsage(components)
  return components.map((component) => {
    const page = pageOf(component)
    return {
      id: component.id,
      name: component.name,
      pageId: page?.id ?? '',
      pageName: page?.name ?? '',
      usageCount: usageCounts.get(component.id) ?? 0,
      dependencyCount: dependencyCounts.get(component.id) ?? 0,
      lastModified: modifiedDates[component.id] ?? null
    }
  })
}

export function selectionComponentIds(selection: readonly SceneNode[]): string[] | null {
  if (selection.length === 0) return null

  const direct = selection.filter(isStandaloneComponent)
  if (direct.length >= 2) return direct.map((node) => node.id)

  const contained: string[] = []
  const visit = (node: BaseNode) => {
    if (isStandaloneComponent(node)) contained.push(node.id)
    if ('children' in node) {
      for (const child of node.children) visit(child)
    }
  }
  for (const node of selection) visit(node)
  if (contained.length > 0) return Array.from(new Set(contained))
  if (direct.length === 1) return [direct[0].id]
  return null
}

export async function selectComponentInEditor(componentId: string): Promise<boolean> {
  const node = await figma.getNodeByIdAsync(componentId)
  if (!node || !isStandaloneComponent(node)) return false
  const page = pageOf(node)
  if (page && page.id !== figma.currentPage.id) {
    await figma.setCurrentPageAsync(page)
  }
  figma.currentPage.selection = [node]
  figma.viewport.scrollAndZoomIntoView([node])
  return true
}
