import { loadLiveUnitProfile } from '../data/liveBuilderUnits'
import type { ProfileKey, PrototypeEquipmentOption } from '../data/builderPrototype'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { applyProfileEffects, incrementCharacteristic, optionAppliesToProfile, profileRoleForName } from '../domain/profileEffects'
import { getSavedArmyList } from './savedLists'
import type { SavedGame } from './games'

export type MatchProfileRowV036 = {
  name: string
  profile: Record<string, string>
}

export type MatchUnitProfileSnapshotV036 = {
  name: string
  troopType: string
  rows: MatchProfileRowV036[]
  equipment: string[]
  rules: Array<{ label: string; path: string }>
}

function gameArmySlug(game: SavedGame) {
  return game.playerArmyId || getSavedArmyList(game.playerListId)?.army || ''
}

function gameCompositionId(game: SavedGame) {
  return getSavedArmyList(game.playerListId)?.composition || ''
}

function cleanProfile(row: Record<string, unknown>) {
  const profile: Record<string, string> = {}
  for (const [key, value] of Object.entries(row || {})) {
    const text = String(value ?? '').trim()
    if (text) profile[key] = text
  }
  return profile
}

function selectedEquipment(unit: Awaited<ReturnType<typeof loadLiveUnitProfile>>, rosterRow: BuilderRosterSelection) {
  if (!unit) return [] as PrototypeEquipmentOption[]
  const selectedIds = new Set(rosterRow.equipmentIds || [])
  return unit.equipmentOptions.filter((option) => selectedIds.has(option.id) || Boolean(option.default || option.locked))
}

function equipmentCount(rosterRow: BuilderRosterSelection, option: PrototypeEquipmentOption) {
  const stored = Number(rosterRow.equipmentCounts?.[option.id] || 0)
  if (Number.isFinite(stored) && stored > 0) return stored
  return (rosterRow.equipmentIds || []).includes(option.id) || option.default || option.locked ? Math.max(1, Number(rosterRow.modelCount || 1)) : 0
}

function activeRules(unit: NonNullable<Awaited<ReturnType<typeof loadLiveUnitProfile>>>, selectedIds: Set<string>) {
  return unit.specialRules.filter((rule) => !rule.requiresSelection || selectedIds.has(rule.requiresSelection) || (rule.requiresAnySelection || []).some((id) => selectedIds.has(id)))
}

function applyPersistentOptionModifiers(
  unit: NonNullable<Awaited<ReturnType<typeof loadLiveUnitProfile>>>,
  profileName: string,
  profile: Record<ProfileKey, string>,
  equipment: PrototypeEquipmentOption[],
) {
  const next = { ...profile }
  for (const option of equipment) {
    if (!optionAppliesToProfile(unit, option, profileName)) continue
    if (/^Big [’']Uns$/i.test(String(option.sourceName || option.name))) continue
    for (const [key, amount] of Object.entries(option.profileModifiers || {}) as Array<[ProfileKey, number]>) {
      if (!Number.isFinite(Number(amount)) || !amount || ['Sv', 'Ward', 'Rn'].includes(key)) continue
      next[key] = incrementCharacteristic(next[key] || '—', Number(amount))
    }
  }
  return next
}

export async function loadMatchUnitProfileV036(game: SavedGame, rosterRow: BuilderRosterSelection): Promise<MatchUnitProfileSnapshotV036 | null> {
  const armySlug = gameArmySlug(game)
  if (!armySlug) return null
  const unit = await loadLiveUnitProfile(armySlug, game.playerArmyName, rosterRow.unitId, gameCompositionId(game))
  if (!unit) return null

  const selectedIds = new Set(rosterRow.equipmentIds || [])
  const equipment = selectedEquipment(unit, rosterRow)
  const rules = activeRules(unit, selectedIds)
  const bigUnsSelected = equipment.some((option) => /^Big [’']Uns$/i.test(String(option.sourceName || option.name)))
  const modelCount = Math.max(1, Number(rosterRow.modelCount || 1))
  const optionalProfiles = (unit.optionalProfiles || []).filter((row) => selectedIds.has(row.selectionId))
  const isBigUnProfile = (name: string) => /\bBig\s*[’']?Uns?\b/i.test(name)
  let baseProfiles = (unit.profiles?.length ? unit.profiles : [{ name: unit.name, profile: unit.profile }]).map((row) => ({ ...row }))
  const explicitBigUnRows = baseProfiles.filter((row) => isBigUnProfile(row.name || ''))
  const explicitBigUnRoles = new Set(explicitBigUnRows.map((row) => profileRoleForName(unit, row.name || unit.name)))
  if (!bigUnsSelected) {
    baseProfiles = baseProfiles.filter((row) => !isBigUnProfile(row.name || ''))
  } else if (explicitBigUnRows.length) {
    baseProfiles = baseProfiles.filter((row) => {
      const name = row.name || unit.name
      if (isBigUnProfile(name)) return true
      return !explicitBigUnRoles.has(profileRoleForName(unit, name))
    })
  }
  let sourceRows = [...baseProfiles, ...optionalProfiles]

  // Preserve the same semantic display order as roster profiles: unit, champion,
  // special model, then mount. This also prevents selected mount rows from
  // displacing the unit's fighting profile in the match reference.
  sourceRows = sourceRows
    .map((row, index) => ({ ...row, index }))
    .sort((a, b) => {
      const weight = { unit: 0, champion: 1, special: 2, mount: 3 } as const
      return weight[profileRoleForName(unit, a.name || unit.name)] - weight[profileRoleForName(unit, b.name || unit.name)] || a.index - b.index
    })

  const rows = sourceRows.map((entry) => {
    const name = String(entry.name || rosterRow.name)
    const role = profileRoleForName(unit, name)
    const explicitUpgradeRow = isBigUnProfile(name)
    const applyBigUnsFallback = bigUnsSelected && (role === 'unit' || role === 'champion') && !explicitUpgradeRow && !explicitBigUnRoles.has(role)
    let profile = applyProfileEffects({
      baseProfile: { ...entry.profile },
      profileName: name,
      unit,
      selectedEquipment: equipment,
      equipmentCount: (option) => equipmentCount(rosterRow, option),
      modelCount,
      activeRules: rules,
      bigUnsSelected: applyBigUnsFallback,
    })
    profile = applyPersistentOptionModifiers(unit, name, profile, equipment)
    return { name, profile: cleanProfile(profile) }
  }).filter((entry) => Object.keys(entry.profile).length > 0)

  return {
    name: rosterRow.name,
    troopType: String(rosterRow.troopType || unit.details.troopType || ''),
    rows,
    equipment: [...new Set([...(rosterRow.includedEquipment || []), ...(rosterRow.optionalSelections || [])])],
    rules: (rosterRow.specialRules || []).map((rule) => ({ ...rule })),
  }
}
