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
  | 'over-under'
  | 'monster-mash'

export const compositionOptions: Array<{ value: CompositionOptionId; label: string }> = [
  { value: 'battle-march-magical-items', label: 'Battle March Magical Items' },
  { value: 'limit-magical-items-75', label: 'Magical Item - Point Limit 75 pts' },
  { value: 'limit-magical-items-50', label: 'Magical Item - Point Limit 50 pts' },
  { value: 'limit-one-magic', label: 'Magical Category - Limit 1' },
  { value: 'magical-maelstrom', label: 'Magical Maelstrom' },
  { value: 'allow-allies', label: 'Allow Allied Units' },
  { value: 'allow-mercenaries', label: 'Allow Mercenary Units' },
  { value: 'allow-custom-units', label: 'Allow Custom Units' },
  { value: 'over-under', label: 'Over / Under' },
  { value: 'monster-mash', label: 'Monster Mash' },
]

export const battleMarchLockedOptions = new Set<CompositionOptionId>([
  'battle-march-magical-items',
])


export const compositionOptionDescriptions: Partial<Record<CompositionOptionId, string>> = {
  'battle-march-magical-items': 'Allows magical items from the Battle March campaign to be taken by models.',
  'limit-magical-items-75': 'Limits magical items costing more than 75 points from being purchased by units.',
  'limit-magical-items-50': 'Limits magical items costing more than 50 points from being purchased by units.',
  'limit-one-magic': 'Only one magical item from each item category may be selected across the entire army roster.',
  'magical-maelstrom': 'Increases all Wizard levels to their maximum level, plus 1, for no additional points cost.',
  'over-under': 'Allows the roster to be up to 10 points over the selected points limit and remain valid with a warning.',
  'monster-mash': 'Allows one non-character Monstrous Creature, War Machine or Chariot to be selected as a Core unit.',
  'allow-allies': 'Allows eligible allied units permitted by the selected army composition.',
  'allow-mercenaries': 'Allows eligible mercenary units permitted by the selected army composition.',
  'allow-custom-units': 'Enables the Custom Units roster category for future custom unit data.',
}

export function compositionOptionDescription(option: CompositionOptionId) {
  return compositionOptionDescriptions[option] || ''
}


export function emptyCompositionOptionState(): Record<CompositionOptionId, boolean> {
  return Object.fromEntries(compositionOptions.map((option) => [option.value, false])) as Record<CompositionOptionId, boolean>
}
