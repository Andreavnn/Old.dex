import type { PrototypeEquipmentOption, PrototypeUnit, PrototypeWeapon } from '../data/builderPrototype'
import { isPerModelWeaponSelection, weaponIsUniversalHandWeapon } from './loadout'
import { wizardLevelFromName } from './wizard'

export type UnitSelectionState = {
  equipmentIds: Set<string>
  weaponIds: Set<string>
}

export type NormalizeSelectionOptions = {
  startingWizardLevel?: number
  mounted?: boolean
}

export function isWizardParentOption(option: PrototypeEquipmentOption) {
  return /^Wizard$/i.test(String(option.name || '').trim())
}

export function isWizardLevelOption(option: PrototypeEquipmentOption) {
  return wizardLevelFromName(option.name) > 0
}

export function selectionContains(state: UnitSelectionState, id: string) {
  return state.equipmentIds.has(id) || state.weaponIds.has(id)
}

export function equipmentRequirementsMet(option: PrototypeEquipmentOption, state: UnitSelectionState, mounted = false) {
  if (option.requiresSelection && !selectionContains(state, option.requiresSelection)) return false
  if (option.requiresAllSelections?.length && option.requiresAllSelections.some((id) => !selectionContains(state, id))) return false
  if (option.requiresAnySelection?.length && !option.requiresAnySelection.some((id) => selectionContains(state, id))) return false
  if (option.forbidsSelection?.some((id) => selectionContains(state, id))) return false
  if (option.requiresMounted && !mounted) return false
  return true
}

export function weaponRequirementsMet(weapon: PrototypeWeapon, state: UnitSelectionState, mounted = false) {
  if (weapon.requiresSelection && !selectionContains(state, weapon.requiresSelection)) return false
  if (weapon.requiresMounted && !mounted) return false
  return true
}

function wizardGroupKey(option: PrototypeEquipmentOption) {
  if (option.exclusiveGroup) return option.exclusiveGroup
  if (option.requiresSelection) return `${option.requiresSelection}:wizard-level`
  return 'wizard-level'
}

function chooseWizardLevel(rows: PrototypeEquipmentOption[], selected: PrototypeEquipmentOption[], startingWizardLevel: number) {
  const nonStarting = selected.filter((option) => wizardLevelFromName(option.name) !== startingWizardLevel)
  return nonStarting.at(-1)
    || rows.find((option) => wizardLevelFromName(option.name) === startingWizardLevel)
    || rows.find((option) => option.default || option.locked)
    || selected.at(-1)
    || rows[0]
}

function pruneDependentEquipment(unit: PrototypeUnit, equipment: Set<string>, weapons: Set<string>, mounted: boolean) {
  let changed = true
  while (changed) {
    changed = false
    const state = { equipmentIds: equipment, weaponIds: weapons }
    for (const option of unit.equipmentOptions) {
      if (!equipment.has(option.id)) continue
      if (!equipmentRequirementsMet(option, state, mounted)) {
        equipment.delete(option.id)
        changed = true
      }
    }
  }
}

/**
 * Authoritative normalization for option dependencies, exclusive choices,
 * Wizard level state, mounted-only choices, and included defaults.
 */
export function normalizeUnitSelections(
  unit: PrototypeUnit,
  equipmentIds: Iterable<string>,
  weaponIds: Iterable<string>,
  options: NormalizeSelectionOptions = {},
): UnitSelectionState {
  const startingWizardLevel = Math.max(0, Number(options.startingWizardLevel || unit.baseWizardLevel || 0))
  const mounted = Boolean(options.mounted)
  const equipment = new Set(equipmentIds)
  const weapons = new Set(weaponIds)

  pruneDependentEquipment(unit, equipment, weapons, mounted)

  const equipmentGroups = new Map<string, PrototypeEquipmentOption[]>()
  for (const option of unit.equipmentOptions) {
    if (!option.exclusiveGroup || isWizardLevelOption(option)) continue
    const rows = equipmentGroups.get(option.exclusiveGroup) || []
    rows.push(option)
    equipmentGroups.set(option.exclusiveGroup, rows)
  }
  for (const rows of equipmentGroups.values()) {
    const selected = rows.filter((option) => equipment.has(option.id))
    if (selected.length <= 1) continue
    const chosen = [...selected].reverse().find((option) => !option.default) || selected[0]
    for (const option of selected) if (option.id !== chosen?.id) equipment.delete(option.id)
  }

  // Included/default equipment returns only while its prerequisites remain valid
  // and no explicit replacement in the same group is active.
  for (const option of unit.equipmentOptions.filter((candidate) => candidate.default && candidate.locked && !isWizardLevelOption(candidate))) {
    const state = { equipmentIds: equipment, weaponIds: weapons }
    if (!equipmentRequirementsMet(option, state, mounted)) continue
    const replacementSelected = option.exclusiveGroup && unit.equipmentOptions.some((candidate) => candidate.id !== option.id && candidate.exclusiveGroup === option.exclusiveGroup && equipment.has(candidate.id))
    if (!replacementSelected) equipment.add(option.id)
  }

  // Normalize each Wizard owner/group independently. This prevents one model's
  // Wizard upgrade from clearing another model/command option's starting level.
  const wizardGroups = new Map<string, PrototypeEquipmentOption[]>()
  for (const option of unit.equipmentOptions.filter(isWizardLevelOption)) {
    if (option.requiresSelection && !equipment.has(option.requiresSelection)) {
      equipment.delete(option.id)
      continue
    }
    const key = wizardGroupKey(option)
    const rows = wizardGroups.get(key) || []
    rows.push(option)
    wizardGroups.set(key, rows)
  }
  for (const rows of wizardGroups.values()) {
    rows.sort((a, b) => wizardLevelFromName(a.name) - wizardLevelFromName(b.name))
    const selected = rows.filter((option) => equipment.has(option.id))
    const groupStarting = rows.find((option) => option.default && option.locked)
      ? wizardLevelFromName(rows.find((option) => option.default && option.locked)!.name)
      : startingWizardLevel
    if (selected.length > 1) {
      const chosen = chooseWizardLevel(rows, selected, groupStarting)
      rows.forEach((option) => equipment.delete(option.id))
      if (chosen) equipment.add(chosen.id)
    } else if (!selected.length && groupStarting > 0) {
      const fallback = rows.find((option) => wizardLevelFromName(option.name) === groupStarting) || rows.find((option) => option.default && option.locked)
      if (fallback) equipment.add(fallback.id)
    }
  }

  pruneDependentEquipment(unit, equipment, weapons, mounted)

  const currentState = { equipmentIds: equipment, weaponIds: weapons }
  for (const weapon of unit.weapons) if (!weaponRequirementsMet(weapon, currentState, mounted)) weapons.delete(weapon.id)

  const weaponGroups = new Map<string, PrototypeWeapon[]>()
  for (const weapon of unit.weapons) {
    if (!weapon.exclusiveGroup || isPerModelWeaponSelection(weapon)) continue
    const rows = weaponGroups.get(weapon.exclusiveGroup) || []
    rows.push(weapon)
    weaponGroups.set(weapon.exclusiveGroup, rows)
  }
  for (const rows of weaponGroups.values()) {
    const selected = rows.filter((weapon) => weapons.has(weapon.id))
    if (selected.length <= 1) continue
    const chosen = [...selected].reverse().find((weapon) => !weapon.default) || selected[0]
    for (const weapon of selected) if (weapon.id !== chosen.id) weapons.delete(weapon.id)
  }

  for (const weapon of unit.weapons.filter((candidate) => candidate.default && candidate.locked)) {
    const state = { equipmentIds: equipment, weaponIds: weapons }
    if (!weaponRequirementsMet(weapon, state, mounted)) continue
    const replacementSelected = weapon.exclusiveGroup && !isPerModelWeaponSelection(weapon)
      && unit.weapons.some((candidate) => candidate.id !== weapon.id && candidate.exclusiveGroup === weapon.exclusiveGroup && !isPerModelWeaponSelection(candidate) && weapons.has(candidate.id))
    if (!replacementSelected || weaponIsUniversalHandWeapon(unit, weapon)) weapons.add(weapon.id)
  }

  return { equipmentIds: equipment, weaponIds: weapons }
}

export function selectExclusiveEquipment(unit: PrototypeUnit, selectedIds: Iterable<string>, option: PrototypeEquipmentOption) {
  const next = new Set(selectedIds)
  if (isWizardLevelOption(option)) {
    const key = wizardGroupKey(option)
    unit.equipmentOptions.filter((candidate) => isWizardLevelOption(candidate) && wizardGroupKey(candidate) === key).forEach((candidate) => next.delete(candidate.id))
  } else if (option.exclusiveGroup) {
    unit.equipmentOptions.filter((candidate) => candidate.exclusiveGroup === option.exclusiveGroup && !isWizardLevelOption(candidate)).forEach((candidate) => next.delete(candidate.id))
  }
  option.replaces?.forEach((id) => next.delete(id))
  next.add(option.id)
  return next
}

export function selectExclusiveWeapon(unit: PrototypeUnit, selectedIds: Iterable<string>, weapon: PrototypeWeapon) {
  const next = new Set(selectedIds)
  if (weapon.exclusiveGroup && !isPerModelWeaponSelection(weapon)) {
    unit.weapons.filter((candidate) => candidate.exclusiveGroup === weapon.exclusiveGroup && !isPerModelWeaponSelection(candidate)).forEach((candidate) => next.delete(candidate.id))
  }
  next.add(weapon.id)
  return next
}
