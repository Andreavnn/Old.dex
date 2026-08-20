import type { PrototypeEquipmentOption, PrototypeUnit, PrototypeWeapon, SelectionMode } from '../data/builderPrototype'
import type { BuilderRosterSelection } from './rosterTypes'
import { applyMagicalMaelstromSelections, magicalMaelstromWizardLevel, wizardLevelFromName } from './wizard'

export function isHandWeaponName(name: string) {
  return /^hand weapons?$/i.test(String(name || '').trim())
}

export function isShieldName(name: string) {
  return /\bshields?\b/i.test(String(name || '').trim())
}

export function selectionModeForWeapon(weapon: PrototypeWeapon): SelectionMode {
  if (isHandWeaponName(weapon.name) && !weapon.requiresSelection) return 'unit-toggle'
  return weapon.selectionMode || 'unit-toggle'
}

export function selectionModeForEquipment(option: PrototypeEquipmentOption): SelectionMode {
  // Shield selection is a unit-level decision regardless of per-model pricing.
  if (isShieldName(option.name) || option.kind === 'armour') return 'unit-toggle'
  return option.selectionMode || 'unit-toggle'
}

export function isPerModelWeaponSelection(weapon: PrototypeWeapon) {
  return selectionModeForWeapon(weapon) === 'per-model-count'
}

export function isPerModelEquipmentSelection(option: PrototypeEquipmentOption) {
  return selectionModeForEquipment(option) === 'per-model-count'
}

export function weaponAllocationGroup(weapon: PrototypeWeapon) {
  return weapon.allocationGroup || (isPerModelWeaponSelection(weapon) ? `weapon:${weapon.id}` : '')
}

export function equipmentAllocationGroup(option: PrototypeEquipmentOption) {
  return option.allocationGroup || (isPerModelEquipmentSelection(option) ? `equipment:${option.id}` : '')
}

export function weaponSelectionCost(weapon: PrototypeWeapon, modelCount: number, count = 0) {
  if (isPerModelWeaponSelection(weapon)) return Math.max(0, count) * Math.max(0, Number(weapon.points) || 0)
  const quantity = (weapon.costMode === 'per-model' || weapon.perModel) ? Math.max(1, modelCount) : 1
  return Math.max(0, Number(weapon.points) || 0) * quantity
}

export function equipmentSelectionCost(option: PrototypeEquipmentOption, modelCount: number, count = 0) {
  if (isPerModelEquipmentSelection(option)) return Math.max(0, count) * Math.max(0, Number(option.points) || 0)
  const quantity = (option.costMode === 'per-model' || option.perModel) ? Math.max(1, modelCount) : 1
  return Math.max(0, Number(option.points) || 0) * quantity
}

export function unitSelectionPointBreakdown(input: {
  unit: PrototypeUnit
  modelCount: number
  selectedWeapons: PrototypeWeapon[]
  selectedEquipment: PrototypeEquipmentOption[]
  weaponCounts?: ReadonlyMap<string, number>
  equipmentCounts?: ReadonlyMap<string, number>
  magicPoints?: number
  magicalMaelstrom?: boolean
}) {
  const modelCount = Math.max(1, Number(input.modelCount) || 1)
  const weaponCounts = input.weaponCounts || new Map<string, number>()
  const equipmentCounts = input.equipmentCounts || new Map<string, number>()
  const basePoints = input.unit.basePointsPerModel !== undefined
    ? Math.max(0, Number(input.unit.basePointsPerModel) || 0) * modelCount
    : Math.max(0, Number(input.unit.points) || 0)
  const weaponPoints = input.selectedWeapons.reduce(
    (sum, weapon) => sum + weaponSelectionCost(weapon, modelCount, weaponCounts.get(weapon.id) || 0),
    0,
  )
  const equipmentPoints = input.selectedEquipment.reduce(
    (sum, option) => sum + (input.magicalMaelstrom && wizardLevelFromName(option.name) > 0 ? 0 : equipmentSelectionCost(option, modelCount, equipmentCounts.get(option.id) || 0)),
    0,
  )
  const magicPoints = Math.max(0, Number(input.magicPoints) || 0)
  const optionPoints = weaponPoints + equipmentPoints + magicPoints
  return { basePoints, weaponPoints, equipmentPoints, magicPoints, optionPoints, totalPoints: basePoints + optionPoints }
}

export function unitUsesMixedWeaponAllocation(unit: PrototypeUnit) {
  return unit.weapons.some(isPerModelWeaponSelection)
}


function allocationCount(counts: ReadonlyMap<string, number> | Record<string, number>, id: string) {
  return typeof (counts as ReadonlyMap<string, number>).get === 'function'
    ? (counts as ReadonlyMap<string, number>).get(id)
    : (counts as Record<string, number>)[id]
}

export function weaponIsUniversalHandWeapon(unit: PrototypeUnit, weapon: PrototypeWeapon) {
  return unit.assumesHandWeapon !== false && isHandWeaponName(weapon.name) && !weapon.requiresSelection
}

export function weaponIsEquipped(unit: PrototypeUnit, weapon: PrototypeWeapon, selectedIds: ReadonlySet<string>, counts: ReadonlyMap<string, number> | Record<string, number> = {}) {
  if (weaponIsUniversalHandWeapon(unit, weapon)) return true
  if (isPerModelWeaponSelection(weapon)) {
    const count = allocationCount(counts, weapon.id)
    return Math.max(0, Number(count) || 0) > 0
  }
  return selectedIds.has(weapon.id)
}

export function weaponIsOptionalChoice(unit: PrototypeUnit, weapon: PrototypeWeapon) {
  if (weaponIsUniversalHandWeapon(unit, weapon) || weapon.alwaysIncluded) return false
  return !(weapon.default && weapon.locked)
}

export function ensureUniversalHandWeapon(unit: PrototypeUnit): PrototypeUnit {
  if (unit.assumesHandWeapon === false) return unit
  const existing = unit.weapons.find((weapon) => isHandWeaponName(weapon.name) && !weapon.requiresSelection)
  if (existing) {
    existing.default = true
    existing.locked = true
    existing.alwaysIncluded = true
    existing.selectionMode = 'unit-toggle'
    existing.costMode = 'flat'
    existing.stackable = false
    existing.perModel = false
    existing.exclusiveGroup = undefined
    existing.allocationGroup = undefined
    return unit
  }
  unit.weapons.unshift({
    id: 'hand-weapon',
    name: 'Hand weapon',
    kind: 'melee',
    range: 'Combat',
    strength: 'S',
    ap: '—',
    rules: [],
    points: 0,
    default: true,
    locked: true,
    alwaysIncluded: true,
    selectionMode: 'unit-toggle',
    costMode: 'flat',
    path: '/weapons-of-war/hand-weapon',
  })
  return unit
}

export type WeaponAllocationState = {
  selectedIds: Set<string>
  counts: Map<string, number>
}

export function normalizeWeaponAllocation(
  unit: PrototypeUnit,
  selectedIds: Iterable<string>,
  counts: ReadonlyMap<string, number> | Record<string, number>,
  modelCount: number,
): WeaponAllocationState {
  const selected = new Set(selectedIds)
  const next = new Map<string, number>()
  const readCount = (id: string) => allocationCount(counts, id)
  const capacity = Math.max(1, modelCount)

  // Choices are capped only against their explicit allocation group. This avoids
  // treating every melee or missile option in a unit as one global bucket.
  const grouped = new Map<string, PrototypeWeapon[]>()
  unit.weapons.filter(isPerModelWeaponSelection).forEach((weapon) => {
    const group = weaponAllocationGroup(weapon)
    const rows = grouped.get(group) || []
    rows.push(weapon)
    grouped.set(group, rows)
  })

  grouped.forEach((weapons) => {
    let remaining = capacity
    for (const weapon of weapons) {
      const minimum = Math.max(0, Number(weapon.minimum) || 0)
      const maximum = Math.min(capacity, Number(weapon.maximum) > 0 ? Number(weapon.maximum) : capacity)
      const requested = Math.max(0, Number(readCount(weapon.id)) || 0)
      const value = requested > 0 ? Math.min(Math.max(minimum || 1, requested), maximum, remaining) : 0
      if (value > 0) {
        next.set(weapon.id, value)
        selected.add(weapon.id)
        remaining -= value
      } else {
        selected.delete(weapon.id)
      }
    }
  })

  unit.weapons.filter((weapon) => !isPerModelWeaponSelection(weapon)).forEach((weapon) => {
    if (weaponIsUniversalHandWeapon(unit, weapon)) selected.add(weapon.id)
  })

  return { selectedIds: selected, counts: next }
}

export function normalizeEquipmentCounts(
  unit: PrototypeUnit,
  selectedIds: Iterable<string>,
  counts: ReadonlyMap<string, number> | Record<string, number>,
  modelCount: number,
) {
  const selected = new Set(selectedIds)
  const next = new Map<string, number>()
  const readCount = (id: string) => allocationCount(counts, id)
  unit.equipmentOptions.forEach((option) => {
    if (!isPerModelEquipmentSelection(option)) return
    if (!selected.has(option.id)) return
    const minimum = Math.max(1, Number(option.minimum) || 1)
    const maximum = Math.min(Math.max(1, modelCount), Number(option.maximum) > 0 ? Number(option.maximum) : Math.max(1, modelCount))
    const value = Math.min(maximum, Math.max(minimum, Number(readCount(option.id)) || minimum))
    next.set(option.id, value)
  })
  return { selectedIds: selected, counts: next }
}

function wizardLevel(value: string) {
  const match = String(value || '').match(/(?:Level\s*(\d+)\s*Wizard|Wizard\s*Level\s*(\d+))/i)
  return match ? Number(match[1] || match[2] || 0) : 0
}

export function defaultUnitSelection(unit: PrototypeUnit) {
  ensureUniversalHandWeapon(unit)
  const modelCount = Math.max(1, Number(unit.minimumModels || 1))
  const weaponIds = unit.weapons.filter((weapon) => weapon.default || weapon.locked || weaponIsUniversalHandWeapon(unit, weapon)).map((weapon) => weapon.id)
  const equipmentIds = unit.equipmentOptions.filter((option) => !wizardLevel(option.name) && (option.default || option.locked)).map((option) => option.id)
  const levels = unit.equipmentOptions.filter((option) => wizardLevel(option.name) > 0)
  const wizardGroups = new Map<string, PrototypeEquipmentOption[]>()
  levels.forEach((option) => {
    const key = option.exclusiveGroup || (option.requiresSelection ? `${option.requiresSelection}-wizard-level` : 'wizard-level')
    const rows = wizardGroups.get(key) || []
    rows.push(option)
    wizardGroups.set(key, rows)
  })
  const startingLevel = Math.max(0, Number(unit.baseWizardLevel || 0))
  wizardGroups.forEach((rows) => {
    rows.sort((a, b) => wizardLevel(a.name) - wizardLevel(b.name))
    const sourceStarting = rows.find((option) => option.default && option.locked)
    const fallback = wizardGroups.size === 1 && startingLevel > 0 ? rows.find((option) => wizardLevel(option.name) === startingLevel) : undefined
    const startingWizard = sourceStarting || fallback
    if (startingWizard && !equipmentIds.includes(startingWizard.id)) equipmentIds.push(startingWizard.id)
  })
  const forcedGeneralOption = unit.mustBeGeneral ? unit.equipmentOptions.find((option) => option.kind === 'role' && /^General$/i.test(option.name)) : undefined
  if (forcedGeneralOption && !equipmentIds.includes(forcedGeneralOption.id)) equipmentIds.push(forcedGeneralOption.id)

  const equipmentCounts = new Map<string, number>()
  unit.equipmentOptions.filter((option) => isPerModelEquipmentSelection(option) && equipmentIds.includes(option.id)).forEach((option) => equipmentCounts.set(option.id, modelCount))
  let weaponCounts = new Map<string, number>()
  unit.weapons.filter((weapon) => isPerModelWeaponSelection(weapon) && weaponIds.includes(weapon.id)).forEach((weapon) => weaponCounts.set(weapon.id, modelCount))
  const normalizedWeapons = normalizeWeaponAllocation(unit, weaponIds, weaponCounts, modelCount)
  weaponCounts = normalizedWeapons.counts

  return { modelCount, weaponIds: [...normalizedWeapons.selectedIds], equipmentIds, weaponCounts, equipmentCounts, forcedGeneralOption }
}

export function createDefaultRosterSelection(unit: PrototypeUnit, instanceId: string, config: { magicalMaelstrom?: boolean } = {}): BuilderRosterSelection {
  const defaults = defaultUnitSelection(unit)
  const { modelCount, weaponIds, weaponCounts, equipmentCounts, forcedGeneralOption } = defaults
  const equipmentIds = config.magicalMaelstrom ? [...applyMagicalMaelstromSelections(unit.equipmentOptions, defaults.equipmentIds)] : defaults.equipmentIds
  const activeSelection = new Set([...weaponIds, ...equipmentIds])
  const specialRules = unit.specialRules
    .filter((rule) => (!rule.requiresSelection || activeSelection.has(rule.requiresSelection)) && (!rule.requiresAnySelection?.length || rule.requiresAnySelection.some((id) => activeSelection.has(id))))
    .map((rule) => ({ label: rule.name, path: rule.path || rule.keywords[0]?.path || '/special-rules/what-are-special-rules' }))

  const selectedWeapons = unit.weapons.filter((weapon) => weaponIds.includes(weapon.id))
  const selectedEquipment = unit.equipmentOptions.filter((option) => equipmentIds.includes(option.id))
  const points = unitSelectionPointBreakdown({ unit, modelCount, selectedWeapons, selectedEquipment, weaponCounts, equipmentCounts, magicalMaelstrom: config.magicalMaelstrom })
  const maelstromLevel = config.magicalMaelstrom ? magicalMaelstromWizardLevel(unit.equipmentOptions, Number(unit.baseWizardLevel || 0)) : 0
  const displayEquipment = selectedEquipment.filter((option) => !(config.magicalMaelstrom && wizardLevelFromName(option.name) > 0))
  const maelstromLabels = maelstromLevel > 0 ? [`Wizard Level ${maelstromLevel}`, 'Magical Maelstrom'] : []
  const basePoints = points.basePoints

  return {
    instanceId,
    unitId: unit.id,
    name: unit.name,
    category: unit.category,
    totalPoints: points.totalPoints,
    basePoints,
    unitSize: `${modelCount} ${modelCount === 1 ? 'model' : 'models'}`,
    modelCount,
    maximumModels: unit.maximumModels,
    named: unit.named,
    mustBeGeneral: unit.mustBeGeneral,
    cannotBeGeneral: unit.cannotBeGeneral,
    troopType: unit.details.troopType,
    leadership: Number.parseInt(unit.profiles?.[0]?.profile.Ld || unit.profile.Ld || '', 10) || undefined,
    generalEligible: Boolean(unit.equipmentOptions.some((option) => option.kind === 'role' && /^General$/i.test(option.name))),
    hierophantEligible: Boolean(unit.equipmentOptions.some((option) => option.kind === 'role' && /^The Hierophant$/i.test(option.name))),
    options: [
      ...selectedWeapons.map((weapon) => weapon.name),
      ...displayEquipment.map((option) => option.name),
      ...maelstromLabels,
      ...(unit.mustBeGeneral && !forcedGeneralOption ? ['General'] : []),
    ],
    includedEquipment: [
      ...selectedWeapons.filter((weapon) => weapon.default || weapon.locked || weaponIsUniversalHandWeapon(unit, weapon)).map((weapon) => weapon.name),
      ...displayEquipment.filter((option) => option.default || option.locked).map((option) => option.name),
      ...(maelstromLevel > 0 ? maelstromLabels : []),
    ],
    optionalSelections: [
      ...selectedWeapons.filter((weapon) => !weapon.default && !weapon.locked && !weaponIsUniversalHandWeapon(unit, weapon)).map((weapon) => weapon.name),
      ...displayEquipment.filter((option) => !option.default && !option.locked).map((option) => option.name),
    ],
    specialRules,
    keywords: unit.keywords,
    weaponIds,
    equipmentIds,
    magicItems: [],
    magicPools: [
      ...(unit.magicAllowance && Number(unit.magicAllowance.maxPoints) > 0 ? [{ ownerId: 'unit', ownerLabel: unit.name, maxPoints: Number(unit.magicAllowance.maxPoints) }] : []),
      ...selectedEquipment.filter((option) => option.magicAllowance && Number(option.magicAllowance.maxPoints) > 0).map((option) => ({ ownerId: option.id, ownerLabel: option.name, maxPoints: Number(option.magicAllowance?.maxPoints || 0) })),
    ],
    weaponCounts: Object.fromEntries(weaponCounts),
    equipmentCounts: Object.fromEntries(equipmentCounts),
  }
}

/** Apply the Magical Maelstrom composition effect to an existing roster row. */
export function applyMagicalMaelstromToRosterSelection(unit: PrototypeUnit, row: BuilderRosterSelection): BuilderRosterSelection {
  const level = magicalMaelstromWizardLevel(unit.equipmentOptions, Number(unit.baseWizardLevel || 0))
  const currentlyWizard = level > 0 && (
    Number(unit.baseWizardLevel || 0) > 0
    || unit.equipmentOptions.some((option) => /^Wizard$/i.test(option.name) && (row.equipmentIds || []).includes(option.id))
    || (row.options || []).some((label) => wizardLevelFromName(label) > 0)
  )
  if (!currentlyWizard) return row

  const equipmentIds = [...applyMagicalMaelstromSelections(unit.equipmentOptions, row.equipmentIds || [])]
  const weaponIds = row.weaponIds || []
  const modelCount = Math.max(1, Number(row.modelCount || unit.minimumModels || 1))
  const weaponCounts = new Map(Object.entries(row.weaponCounts || {}).map(([id, count]) => [id, Number(count) || 0]))
  const equipmentCounts = new Map(Object.entries(row.equipmentCounts || {}).map(([id, count]) => [id, Number(count) || 0]))
  const selectedWeapons = unit.weapons.filter((weapon) => weaponIds.includes(weapon.id))
  const selectedEquipment = unit.equipmentOptions.filter((option) => equipmentIds.includes(option.id))
  const magicPoints = (row.magicItems || []).reduce((sum, item) => sum + Math.max(1, Number(item.count || 1)) * Math.max(0, Number(item.points || 0)), 0)
  const points = unitSelectionPointBreakdown({ unit, modelCount, selectedWeapons, selectedEquipment, weaponCounts, equipmentCounts, magicPoints, magicalMaelstrom: true })
  const replaceLabels = (values: string[] = []) => {
    const next = values.filter((label) => wizardLevelFromName(label) <= 0 && !/^Magical Maelstrom$/i.test(label))
    next.push(`Wizard Level ${level}`, 'Magical Maelstrom')
    return [...new Set(next)]
  }
  return {
    ...row,
    equipmentIds,
    options: replaceLabels(row.options),
    includedEquipment: replaceLabels(row.includedEquipment),
    optionalSelections: (row.optionalSelections || []).filter((label) => wizardLevelFromName(label) <= 0 && !/^Magical Maelstrom$/i.test(label)),
    totalPoints: points.totalPoints,
  }
}

/** Remove the composition-only +1/free-cost effect while keeping the selected normal Wizard level. */
export function removeMagicalMaelstromFromRosterSelection(unit: PrototypeUnit, row: BuilderRosterSelection): BuilderRosterSelection {
  if (!(row.options || []).some((label) => /^Magical Maelstrom$/i.test(label))) return row
  const equipmentIds = row.equipmentIds || []
  const modelCount = Math.max(1, Number(row.modelCount || unit.minimumModels || 1))
  const weaponCounts = new Map(Object.entries(row.weaponCounts || {}).map(([id, count]) => [id, Number(count) || 0]))
  const equipmentCounts = new Map(Object.entries(row.equipmentCounts || {}).map(([id, count]) => [id, Number(count) || 0]))
  const selectedWeapons = unit.weapons.filter((weapon) => (row.weaponIds || []).includes(weapon.id))
  const selectedEquipment = unit.equipmentOptions.filter((option) => equipmentIds.includes(option.id))
  const actualLevel = Math.max(0, ...selectedEquipment.map((option) => wizardLevelFromName(option.name)))
  const magicPoints = (row.magicItems || []).reduce((sum, item) => sum + Math.max(1, Number(item.count || 1)) * Math.max(0, Number(item.points || 0)), 0)
  const points = unitSelectionPointBreakdown({ unit, modelCount, selectedWeapons, selectedEquipment, weaponCounts, equipmentCounts, magicPoints })
  const stripMaelstromLabels = (values: string[] = []) => values.filter(
    (label) => wizardLevelFromName(label) <= 0 && !/^Magical Maelstrom$/i.test(label),
  )
  const actualWizardOption = selectedEquipment.find((option) => wizardLevelFromName(option.name) === actualLevel)
  const actualLabel = actualLevel > 0 ? `Wizard Level ${actualLevel}` : ''
  const options = stripMaelstromLabels(row.options)
  const includedEquipment = stripMaelstromLabels(row.includedEquipment)
  const optionalSelections = stripMaelstromLabels(row.optionalSelections)
  if (actualLabel) {
    options.push(actualLabel)
    if (actualWizardOption?.default || actualWizardOption?.locked) includedEquipment.push(actualLabel)
    else optionalSelections.push(actualLabel)
  }
  return {
    ...row,
    options: [...new Set(options)],
    includedEquipment: [...new Set(includedEquipment)],
    optionalSelections: [...new Set(optionalSelections)],
    totalPoints: points.totalPoints,
  }
}
