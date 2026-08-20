export type CompositionSelectionRequirement = { unit?: string; id?: string }

export type CompositionUnitRule = {
  ids?: string[]
  min?: number
  max?: number
  points?: number
  requires?: string[]
  requiresType?: string
  requiredByType?: string
  perUnit?: boolean
  requiresGeneral?: boolean
  requiresMounted?: boolean
  requiresOption?: CompositionSelectionRequirement | string | string[]
  requiresCommand?: CompositionSelectionRequirement | string | string[]
  requiresMagicItem?: string | string[]
  requiresIfGeneral?: string[]
}

export type CompositionCategoryRules = {
  minPercent?: number
  maxPercent?: number
  units?: CompositionUnitRule[]
}

export type CompositionRules = Record<string, CompositionCategoryRules>
export type CompositionRuleCatalog = Record<string, CompositionRules>

type UnknownRecord = Record<string, unknown>
function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined
}
function selectionRequirement(value: unknown): CompositionSelectionRequirement | string | string[] | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (!isRecord(value)) return undefined
  const unit = typeof value.unit === 'string' ? value.unit : undefined
  const id = typeof value.id === 'string' ? value.id : undefined
  return unit || id ? { unit, id } : undefined
}

export function parseCompositionRuleCatalog(value: unknown): CompositionRuleCatalog {
  if (!isRecord(value)) throw new Error('Composition rules must be an object.')
  const catalog: CompositionRuleCatalog = {}
  for (const [compositionId, rawComposition] of Object.entries(value)) {
    if (!isRecord(rawComposition)) continue
    const composition: CompositionRules = {}
    for (const [category, rawCategory] of Object.entries(rawComposition)) {
      if (!isRecord(rawCategory)) continue
      const categoryRules: CompositionCategoryRules = {}
      const minPercent = Number(rawCategory.minPercent)
      const maxPercent = Number(rawCategory.maxPercent)
      if (Number.isFinite(minPercent)) categoryRules.minPercent = minPercent
      if (Number.isFinite(maxPercent)) categoryRules.maxPercent = maxPercent
      if (Array.isArray(rawCategory.units)) {
        categoryRules.units = rawCategory.units.flatMap((rawRule): CompositionUnitRule[] => {
          if (!isRecord(rawRule)) return []
          const rule: CompositionUnitRule = {}
          const ids = stringList(rawRule.ids); if (ids?.length) rule.ids = ids
          for (const key of ['min', 'max', 'points'] as const) {
            const numeric = Number(rawRule[key])
            if (Number.isFinite(numeric)) rule[key] = numeric
          }
          const requires = stringList(rawRule.requires); if (requires?.length) rule.requires = requires
          for (const key of ['requiresType', 'requiredByType'] as const) if (typeof rawRule[key] === 'string') rule[key] = rawRule[key]
          for (const key of ['perUnit', 'requiresGeneral', 'requiresMounted'] as const) if (typeof rawRule[key] === 'boolean') rule[key] = rawRule[key]
          const requiresOption = selectionRequirement(rawRule.requiresOption); if (requiresOption !== undefined) rule.requiresOption = requiresOption
          const requiresCommand = selectionRequirement(rawRule.requiresCommand); if (requiresCommand !== undefined) rule.requiresCommand = requiresCommand
          const requiresMagicItem = selectionRequirement(rawRule.requiresMagicItem)
          if (typeof requiresMagicItem === 'string' || Array.isArray(requiresMagicItem)) rule.requiresMagicItem = requiresMagicItem
          const requiresIfGeneral = stringList(rawRule.requiresIfGeneral); if (requiresIfGeneral?.length) rule.requiresIfGeneral = requiresIfGeneral
          return [rule]
        })
      }
      composition[category] = categoryRules
    }
    catalog[compositionId] = composition
  }
  if (!Object.keys(catalog).length) throw new Error('Composition rules did not contain any usable compositions.')
  return catalog
}
