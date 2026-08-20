import { DEFAULT_RULES, ParsedRules } from './types'

export function parseRules(text: string): ParsedRules {
  const source = text.trim() === '' ? DEFAULT_RULES : text
  const lines = source.split('\n')
  let currentCategory = ''
  const map = new Map<string, string[]>()
  map.set(currentCategory, [])

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('- [ ]')) {
      const ruleText = line.slice(5).trim()
      if (ruleText.length === 0) continue
      const list = map.get(currentCategory) ?? []
      list.push(ruleText)
      map.set(currentCategory, list)
    } else if (line !== '') {
      currentCategory = line.replace(/^#+\s*/, '')
      if (!map.has(currentCategory)) map.set(currentCategory, [])
    }
  }

  const categories = Array.from(map.entries())
    .filter(([, rules]) => rules.length > 0)
    .map(([name, rules]) => ({ name, rules }))

  return {
    categories,
    totalRules: categories.reduce((sum, category) => sum + category.rules.length, 0)
  }
}

export function checkedCountForComponent(
  state: Record<string, Record<string, { checked?: boolean }>> | undefined,
  rules: ParsedRules
): number {
  if (!state) return 0
  let count = 0
  for (const category of rules.categories) {
    const catState = state[category.name] ?? state['']
    for (const rule of category.rules) {
      if (catState?.[rule]?.checked) count += 1
    }
  }
  return count
}
