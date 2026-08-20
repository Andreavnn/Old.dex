import type { PrototypeEquipmentOption } from '../data/builderPrototype'

export function wizardLevelFromName(value: string) {
  const match = String(value || '').match(/(?:Level\s*(\d+)\s*Wizard|Wizard\s*Level\s*(\d+)|level\s*(\d+)\s*wizard)/i)
  return match ? Number(match[1] || match[2] || match[3] || 0) : 0
}

export function wizardLevelsFromLabels(values: Iterable<string>) {
  const levels: number[] = []
  for (const value of values) {
    const direct = wizardLevelFromName(value)
    if (direct > 0) levels.push(direct)
    for (const match of String(value || '').matchAll(/level\s*(\d+)\s*wizard/gi)) {
      const level = Number(match[1])
      if (Number.isFinite(level) && level > 0 && level !== direct) levels.push(level)
    }
  }
  return levels
}

export function wizardLevelGroupId(option: PrototypeEquipmentOption) {
  return option.exclusiveGroup || (option.requiresSelection ? `${option.requiresSelection}-wizard-level` : 'wizard-level')
}

export function wizardLevelOptionsByGroup(options: PrototypeEquipmentOption[]) {
  const groups = new Map<string, PrototypeEquipmentOption[]>()
  for (const option of options) {
    if (wizardLevelFromName(option.name) <= 0) continue
    const key = wizardLevelGroupId(option)
    groups.set(key, [...(groups.get(key) || []), option])
  }
  for (const rows of groups.values()) rows.sort((a, b) => wizardLevelFromName(a.name) - wizardLevelFromName(b.name))
  return groups
}

/** Normal maximum Wizard level represented by the unit's source options. */
export function maximumWizardLevel(options: PrototypeEquipmentOption[], fallback = 0) {
  const levels = options.map((option) => wizardLevelFromName(option.name)).filter((level) => level > 0)
  return levels.length ? Math.max(...levels) : Math.max(0, fallback)
}

/** Magical Maelstrom makes an existing Wizard one level higher than its normal maximum. */
export function magicalMaelstromWizardLevel(options: PrototypeEquipmentOption[], fallback = 0) {
  const maximum = maximumWizardLevel(options, fallback)
  return maximum > 0 ? maximum + 1 : 0
}

/**
 * Select the highest normal level option in every active Wizard owner group.
 * The +1 itself is a composition effect, not a purchasable equipment option.
 */
export function applyMagicalMaelstromSelections(options: PrototypeEquipmentOption[], selectedIds: Iterable<string>) {
  const selected = new Set(selectedIds)
  const groups = wizardLevelOptionsByGroup(options)
  for (const rows of groups.values()) {
    const ownerId = rows[0]?.requiresSelection
    const ownerIsActive = !ownerId || selected.has(ownerId) || rows.some((row) => selected.has(row.id) || row.default || row.locked)
    if (!ownerIsActive) continue
    rows.forEach((row) => selected.delete(row.id))
    const highest = rows.at(-1)
    if (highest) selected.add(highest.id)
  }
  return selected
}
