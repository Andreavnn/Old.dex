export type CompositionRuleId =
  | 'open-war'
  | 'grand-melee'
  | 'combined-arms'
  | 'grand-melee-combined-arms'
  | 'battle-march'

export const compositionRules: Array<{ value: CompositionRuleId; label: string }> = [
  { value: 'open-war', label: 'Open War' },
  { value: 'grand-melee', label: 'Grand Melee' },
  { value: 'combined-arms', label: 'Combined Arms' },
  { value: 'grand-melee-combined-arms', label: 'Grand Melee — Combined Arms' },
  { value: 'battle-march', label: 'Battle March' },
]

export const standardPointPresets = [500, 1000, 1500, 2000, 2500]
export const battleMarchPointPresets = [500, 600, 750]

export function pointPresetsForRule(rule: CompositionRuleId) {
  return rule === 'battle-march' ? battleMarchPointPresets : standardPointPresets
}

export function normalizePointsForRule(rule: CompositionRuleId, current: number) {
  if (rule === 'battle-march' && (current < 500 || current > 750)) return 500
  return current
}

export function compositionRuleLabel(rule: string) {
  return compositionRules.find((item) => item.value === rule)?.label || 'Open War'
}


export type CompositionOptionId =
  | 'battle-march-magical-items'
  | 'limit-magical-items-75'
  | 'limit-magical-items-50'
  | 'limit-one-magic'
  | 'magical-maelstrom'
  | 'allow-allies'
  | 'allow-mercenaries'
  | 'allow-custom-units'

export const compositionOptions: Array<{ value: CompositionOptionId; label: string }> = [
  { value: 'battle-march-magical-items', label: 'Battle March Magical Items' },
  { value: 'limit-magical-items-75', label: 'Magical Item - Point Limit 75 pts' },
  { value: 'limit-magical-items-50', label: 'Magical Item - Point Limit 50 pts' },
  { value: 'limit-one-magic', label: 'Magical Category - Limit 1' },
  { value: 'magical-maelstrom', label: 'Magical Maelstrom' },
  { value: 'allow-allies', label: 'Allow Allied Units' },
  { value: 'allow-mercenaries', label: 'Allow Mercenary Units' },
  { value: 'allow-custom-units', label: 'Allow Custom Units' },
]

export const battleMarchLockedOptions = new Set<CompositionOptionId>([
  'battle-march-magical-items',
])


export function emptyCompositionOptionState(): Record<CompositionOptionId, boolean> {
  return Object.fromEntries(compositionOptions.map((option) => [option.value, false])) as Record<CompositionOptionId, boolean>
}
