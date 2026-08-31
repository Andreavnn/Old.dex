import { loadLiveUnitProfile } from '../data/liveBuilderUnits'
import type { ProfileKey, PrototypeEquipmentOption, PrototypeWeapon } from '../data/builderPrototype'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { applyProfileEffects, incrementCharacteristic, isMountProfileName, normalizedModelName, optionAppliesToProfile, profileRoleForName } from '../domain/profileEffects'
import { weaponIsEquipped } from '../domain/loadout'
import { persistentModelCharacteristicModifiers } from '../domain/canonicalProfiles'
import { resolveArmourSave } from '../core/profileMath'
import { loadMagicItemReference } from './magicItemReference'
import { getSavedArmyList } from './savedLists'
import { reportAppError } from './appErrors'
import type { SavedGame } from './games'

export type MatchProfileRow = {
  name: string
  profile: Record<string, string>
  count: number
}

export type MatchWeaponSnapshot = {
  id: string
  name: string
  kind: 'melee' | 'missile'
  range: string
  strength: string
  ap: string
  rules: string[]
  count: number
}

export type MatchUnitProfileSnapshot = {
  name: string
  troopType: string
  rows: MatchProfileRow[]
  equipment: string[]
  rules: Array<{ label: string; path: string }>
  weapons: MatchWeaponSnapshot[]
}


type MatchMagicProfileEffect = {
  ownerId: string
  ownerLabel: string
  shield: boolean
  override: Partial<Record<ProfileKey, string | number>>
}

function magicEffectApplies(effect: MatchMagicProfileEffect, profileName: string) {
  if (effect.ownerId === 'unit' || !effect.ownerId) return !isMountProfileName(profileName)
  const profile = normalizedModelName(profileName)
  const owner = normalizedModelName(effect.ownerLabel)
  return Boolean(owner && (profile.includes(owner) || owner.includes(profile)))
}

async function selectedMagicProfileEffects(rosterRow: BuilderRosterSelection) {
  const effects: MatchMagicProfileEffect[] = []
  await Promise.allSettled((rosterRow.magicItems || []).map(async (item) => {
    let body = ''
    if (item.slug) {
      try {
        const reference = await loadMagicItemReference({ name: item.name, type: item.type, itemPath: `/magic-item/${item.slug}`, collectionName: item.source })
        body = `${reference.bodyText || ''} ${reference.summary || ''}`.replace(/\s+/g, ' ').trim()
      } catch {
        body = ''
      }
    }

    const override: Partial<Record<ProfileKey, string | number>> = {}
    const armour = body.match(/(?:armour save(?: of)?|gains? (?:an? )?)(2\+|3\+|4\+|5\+|6\+)(?: armour save)?/i)
      || body.match(/\b(2\+|3\+|4\+|5\+|6\+)\s+armour save\b/i)
    if (armour) override.Sv = armour[1]
    const ward = body.match(/(?:Ward\s+save(?:\s+of)?\s*\(?\s*(2\+|3\+|4\+|5\+|6\+)\s*\)?|(2\+|3\+|4\+|5\+|6\+)\s+Ward\s+save)/i)
    if (ward) override.Ward = ward[1] || ward[2]
    const regeneration = body.match(/Regeneration\s*\(?\s*([2-6]\+)\s*\)?/i)
    if (regeneration) override.Rn = regeneration[1]
    const persistent = persistentModelCharacteristicModifiers(body)
    for (const [key, amount] of Object.entries(persistent) as Array<[ProfileKey, number]>) override[key] = amount

    effects.push({
      ownerId: String(item.ownerId || 'unit'),
      ownerLabel: String(item.ownerLabel || rosterRow.name),
      shield: item.type === 'armor' && /\bshield\b/i.test(`${item.name} ${body}`),
      override,
    })
  }))
  return effects
}

function applyMagicProfileEffects(profileName: string, rawProfile: Record<string, string>, effects: MatchMagicProfileEffect[]) {
  const profile = { ...rawProfile } as Record<ProfileKey, string>
  let armourReplacement: string | undefined
  let shieldModifiers = 0

  for (const effect of effects) {
    if (!magicEffectApplies(effect, profileName)) continue
    if (effect.shield) shieldModifiers += 1
    for (const [key, rawValue] of Object.entries(effect.override) as Array<[ProfileKey, string | number]>) {
      if (key === 'Sv') { armourReplacement = String(rawValue); continue }
      if (key === 'Ward' || key === 'Rn') { profile[key] = String(rawValue); continue }
      const amount = Number(rawValue)
      if (Number.isFinite(amount) && amount) profile[key] = incrementCharacteristic(profile[key] || '—', amount)
    }
  }

  if (armourReplacement || shieldModifiers) {
    profile.Sv = resolveArmourSave(profile.Sv || '—', armourReplacement, Array.from({ length: shieldModifiers }, () => 1))
  }
  return profile
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

function weaponSelectionKey(value: string) {
  return String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function weaponCount(unit: NonNullable<Awaited<ReturnType<typeof loadLiveUnitProfile>>>, rosterRow: BuilderRosterSelection, weapon: PrototypeWeapon) {
  const stored = Math.max(0, Number(rosterRow.weaponCounts?.[weapon.id] || 0))
  if (stored > 0) return stored
  if (weapon.requiresSelection) {
    const source = unit.equipmentOptions.find((option) => option.id === weapon.requiresSelection)
    if (source && (rosterRow.equipmentIds || []).includes(source.id)) {
      const storedSourceCount = Math.max(0, Number(rosterRow.equipmentCounts?.[source.id] || 0))
      if (storedSourceCount > 0) return storedSourceCount
      if (source.kind === 'role' || source.addsProfile) return 1
      return Math.max(1, equipmentCount(rosterRow, source))
    }
    // Older saved rosters can retain the atomic weapon id while omitting the
    // parent option id. Preserve the roster's explicit weapon selection rather
    // than dropping a legitimate upgrade from Match/Shooting.
    if ((rosterRow.weaponIds || []).includes(weapon.id)) return Math.max(1, Number(rosterRow.modelCount || 1))
    return 0
  }
  return Math.max(1, Number(rosterRow.modelCount || 1))
}

function selectedWeapons(unit: NonNullable<Awaited<ReturnType<typeof loadLiveUnitProfile>>>, rosterRow: BuilderRosterSelection) {
  const selectedIds = new Set(rosterRow.weaponIds || [])
  const selectedEquipmentIds = new Set(rosterRow.equipmentIds || [])
  const selectedLabels = new Set([...(rosterRow.includedEquipment || []), ...(rosterRow.optionalSelections || [])].map(weaponSelectionKey))
  const selectedByParent = (weapon: PrototypeWeapon) => Boolean(weapon.requiresSelection && selectedEquipmentIds.has(weapon.requiresSelection))
  const selectedByLabel = (weapon: PrototypeWeapon) => selectedLabels.has(weaponSelectionKey(weapon.sourceName || weapon.name)) || selectedLabels.has(weaponSelectionKey(weapon.name))

  // Some OWB weapon upgrades are represented as an equipment/option selection
  // whose linked PrototypeWeapon carries requiresSelection. Treat that active
  // selection as the weapon being equipped even when an older roster snapshot
  // did not duplicate the weapon id into weaponIds. Label fallback covers older
  // snapshots that retained the human-readable selection but not its atomic id.
  for (const weapon of unit.weapons) {
    if (weapon.default || weapon.locked || weapon.alwaysIncluded || selectedByParent(weapon) || selectedByLabel(weapon)) selectedIds.add(weapon.id)
  }

  return unit.weapons
    .filter((weapon) => !weapon.requiresSelection || selectedByParent(weapon) || selectedIds.has(weapon.id))
    // Per-model weapons normally read weaponCounts. A source-linked parent or
    // preserved roster label is equally authoritative in an older snapshot, so
    // it must not disappear merely because that historic count field is absent.
    .filter((weapon) => selectedByParent(weapon) || selectedByLabel(weapon) || weaponIsEquipped(unit, weapon, selectedIds, rosterRow.weaponCounts || {}))
    .map((weapon) => {
      const storedCount = weaponCount(unit, rosterRow, weapon)
      const fallbackCount = selectedByLabel(weapon) && storedCount <= 0 ? Math.max(1, Number(rosterRow.modelCount || 1)) : storedCount
      return {
        id: weapon.id,
        name: weapon.name,
        kind: weapon.kind,
        range: String(weapon.range || (weapon.kind === 'missile' ? 'See rule' : 'Combat')),
        strength: String(weapon.strength || 'See rule'),
        ap: String(weapon.ap || '—'),
        rules: [...new Set(weapon.rules || [])],
        count: Math.max(1, fallbackCount),
      }
    })
}

async function selectedMagicWeapons(rosterRow: BuilderRosterSelection) {
  const rows: MatchWeaponSnapshot[] = []
  await Promise.allSettled((rosterRow.magicItems || []).filter((item) => item.type === 'weapon' && item.slug).map(async (item) => {
    try {
      const reference = await loadMagicItemReference({ name: item.name, type: 'weapon', itemPath: `/magic-item/${item.slug}`, collectionName: item.source })
      const range = String(reference.range || 'Combat')
      rows.push({
        id: `magic-${item.id}`,
        name: item.name,
        kind: /^combat$/i.test(range) ? 'melee' : 'missile',
        range,
        strength: String(reference.strength || 'See rule'),
        ap: String(reference.ap || 'See rule'),
        rules: [...new Set(reference.rules || [])],
        count: Math.max(1, Number(item.count || 1)),
      })
    } catch {
      // The roster still remains usable if a remote magic-weapon reference is unavailable.
    }
  }))
  return rows
}

export async function loadMatchUnitProfile(game: SavedGame, rosterRow: BuilderRosterSelection): Promise<MatchUnitProfileSnapshot | null> {
  const armySlug = gameArmySlug(game)
  if (!armySlug) return null

  const unit = await loadLiveUnitProfile(armySlug, game.playerArmyName, rosterRow.unitId, gameCompositionId(game)).catch((error) => {
    reportAppError(error, 'MATCH_UNIT_PROFILE_SOURCE', { gameId: game.id, unitId: rosterRow.unitId, instanceId: rosterRow.instanceId })
    return null
  })
  if (!unit) return null
  const resolvedUnit = unit

  const selectedIds = new Set(rosterRow.equipmentIds || [])
  const equipment = selectedEquipment(resolvedUnit, rosterRow)
  const rules = activeRules(resolvedUnit, selectedIds)
  const bigUnsSelected = equipment.some((option) => /^Big [’']Uns$/i.test(String(option.sourceName || option.name)))
  const modelCount = Math.max(1, Number(rosterRow.modelCount || 1))
  const optionalProfiles = (resolvedUnit.optionalProfiles || []).filter((row) => selectedIds.has(row.selectionId))
  const isBigUnProfile = (name: string) => /\bBig\s*[’']?Uns?\b/i.test(name)
  let baseProfiles = (resolvedUnit.profiles?.length ? resolvedUnit.profiles : [{ name: resolvedUnit.name, profile: resolvedUnit.profile }]).map((row) => ({ ...row, selectionId: undefined as string | undefined }))
  const explicitBigUnRows = baseProfiles.filter((row) => isBigUnProfile(row.name || ''))
  const explicitBigUnRoles = new Set(explicitBigUnRows.map((row) => profileRoleForName(resolvedUnit, row.name || resolvedUnit.name)))
  if (!bigUnsSelected) {
    baseProfiles = baseProfiles.filter((row) => !isBigUnProfile(row.name || ''))
  } else if (explicitBigUnRows.length) {
    baseProfiles = baseProfiles.filter((row) => {
      const name = row.name || resolvedUnit.name
      if (isBigUnProfile(name)) return true
      return !explicitBigUnRoles.has(profileRoleForName(resolvedUnit, name))
    })
  }
  let sourceRows = [...baseProfiles, ...optionalProfiles.map((row) => ({ ...row }))]

  // Preserve the canonical source order for rider, champion and special-model
  // rows while keeping true mount profiles after the models that ride them.
  // This avoids reordering source profile cards merely because a rider name
  // contains a mount word (for example Boss, Boar Boy, War Boar).
  sourceRows = sourceRows
    .map((row, index) => ({ ...row, index }))
    .sort((a, b) => {
      const aMount = profileRoleForName(resolvedUnit, a.name || resolvedUnit.name) === 'mount' ? 1 : 0
      const bMount = profileRoleForName(resolvedUnit, b.name || resolvedUnit.name) === 'mount' ? 1 : 0
      return aMount - bMount || a.index - b.index
    })

  function profileOwnerOption(entry: (typeof sourceRows)[number]) {
    const selectionId = String(entry.selectionId || '')
    if (selectionId) return resolvedUnit.equipmentOptions.find((candidate) => candidate.id === selectionId)
    const profileKey = normalizedModelName(String(entry.name || resolvedUnit.name))
    if (!profileKey) return undefined
    return resolvedUnit.equipmentOptions.find((candidate) => {
      const target = normalizedModelName(String(candidate.addsProfile || candidate.name || ''))
      return Boolean(target && target === profileKey)
    })
  }
  function selectedProfileOptionCount(entry: (typeof sourceRows)[number]) {
    const option = profileOwnerOption(entry)
    if (!option) return 1
    if (!equipment.some((candidate) => candidate.id === option.id)) return 0
    const stored = Math.max(0, Number(rosterRow.equipmentCounts?.[option.id] || 0))
    if (stored > 0) return stored
    const role = profileRoleForName(resolvedUnit, String(entry.name || resolvedUnit.name))
    // Command/special models are single models unless an explicit roster count
    // says otherwise. A unit-toggle option must not multiply a champion by the
    // unit's model count.
    if (role === 'champion' || role === 'special') return 1
    return Math.max(1, equipmentCount(rosterRow, option))
  }

  const championCount = sourceRows.reduce((sum, entry) => {
    if (profileRoleForName(resolvedUnit, String(entry.name || resolvedUnit.name)) !== 'champion') return sum
    return sum + selectedProfileOptionCount(entry)
  }, 0)

  function profileCount(entry: (typeof sourceRows)[number]) {
    const name = String(entry.name || resolvedUnit.name)
    const role = profileRoleForName(resolvedUnit, name)
    if (role === 'mount') return modelCount
    if (role === 'champion' || role === 'special') return selectedProfileOptionCount(entry)
    return Math.max(0, modelCount - championCount)
  }

  const rows = sourceRows.map((entry) => {
    const name = String(entry.name || rosterRow.name)
    const role = profileRoleForName(resolvedUnit, name)
    const explicitUpgradeRow = isBigUnProfile(name)
    const applyBigUnsFallback = bigUnsSelected && (role === 'unit' || role === 'champion') && !explicitUpgradeRow && !explicitBigUnRoles.has(role)
    let profile = applyProfileEffects({
      baseProfile: { ...entry.profile },
      profileName: name,
      unit: resolvedUnit,
      selectedEquipment: equipment,
      equipmentCount: (option) => equipmentCount(rosterRow, option),
      modelCount,
      activeRules: rules,
      bigUnsSelected: applyBigUnsFallback,
    })
    profile = applyPersistentOptionModifiers(resolvedUnit, name, profile, equipment)
    return { name, profile: cleanProfile(profile), count: profileCount(entry) }
  }).filter((entry) => Object.keys(entry.profile).length > 0 && entry.count > 0)

  const magicProfileEffects = await selectedMagicProfileEffects(rosterRow)
  const troopTypeForParry = String(rosterRow.troopType || resolvedUnit.details.troopType || '')
  const handWeaponForParry = Boolean(resolvedUnit.assumesHandWeapon || resolvedUnit.weapons.some((weapon) => /^hand weapons?$/i.test(String(weapon.sourceName || weapon.name)) && (weapon.default || weapon.locked || weapon.alwaysIncluded)))
  const resolvedRows = rows.map((row) => {
    let profile = magicProfileEffects.length ? applyMagicProfileEffects(row.name, row.profile, magicProfileEffects) : row.profile
    const magicShield = magicProfileEffects.some((effect) => effect.shield && magicEffectApplies(effect, row.name))
    if (magicShield && handWeaponForParry && /\b(?:Regular|Heavy) Infantry\b/i.test(troopTypeForParry) && profileRoleForName(resolvedUnit, row.name) !== 'mount') {
      const match = String(profile.Sv || '').match(/([2-6])\+/)
      if (match && Number(match[1]) > 3) profile = { ...profile, Sv: `${Math.max(3, Number(match[1]) - 1)}+` }
    }
    return { ...row, profile }
  })
  const weapons = [...selectedWeapons(resolvedUnit, rosterRow), ...(await selectedMagicWeapons(rosterRow))]

  const troopType = String(rosterRow.troopType || resolvedUnit.details.troopType || '')
  const parryRule = /\b(?:Regular|Heavy) Infantry\b/i.test(troopType)
    ? [{ label: 'Parry', path: '/troop-types-in-detail/parry' }]
    : []
  const mergedRules = [...new Map([
    ...(rosterRow.specialRules || []).map((rule) => [String(rule.label || '').toLowerCase(), { ...rule }] as const),
    ...rules.map((rule) => [String(rule.sourceName || rule.name).toLowerCase(), { label: rule.name, path: rule.path }] as const),
    ...parryRule.map((rule) => [rule.label.toLowerCase(), rule] as const),
  ]).values()]

  return {
    name: rosterRow.name,
    troopType,
    rows: resolvedRows,
    equipment: [...new Set([...(rosterRow.includedEquipment || []), ...(rosterRow.optionalSelections || [])])],
    rules: mergedRules,
    weapons,
  }
}
