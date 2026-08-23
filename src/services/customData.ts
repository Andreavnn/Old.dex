import builtInGrimgor from '../data/custom/grimgor-ironhide.json'
import { armies, type Army } from '../data/armies'
import type {
  ProfileKey,
  PrototypeEquipmentOption,
  PrototypeProfileRow,
  PrototypeUnit,
  PrototypeWeapon,
  RuleTone,
} from '../data/builderPrototype'
import { isRecord } from '../domain/schemas'
import { readJson, writeJson } from './storage'

const CUSTOM_DATA_STORAGE_KEY = 'olddex.custom-data.v1'
const BASE_PROFILE_KEYS: ProfileKey[] = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld']
const SAVE_PROFILE_KEYS: ProfileKey[] = ['Sv', 'Ward', 'Rn']

type CustomDataRecord = Record<string, unknown>

export type CustomDataImportResult = {
  packs: number
  units: number
  packNames: string[]
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function slug(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}


function records(value: unknown) {
  return Array.isArray(value) ? value.filter((row): row is CustomDataRecord => isRecord(row)) : []
}

function customPackRows(value: unknown): CustomDataRecord[] {
  if (Array.isArray(value)) return value.flatMap(customPackRows)
  if (!isRecord(value)) return []
  if (Array.isArray(value.units)) return [value]
  if (Array.isArray(value.customData)) return value.customData.flatMap(customPackRows)
  if (Array.isArray(value.packs)) return value.packs.flatMap(customPackRows)
  return []
}

function parseStoredCustomData(value: unknown) {
  return customPackRows(value)
}

function importedCustomPacks() {
  return readJson(CUSTOM_DATA_STORAGE_KEY, parseStoredCustomData, [] as CustomDataRecord[])
}

function packId(pack: CustomDataRecord, index = 0) {
  return slug(pack.id || pack.name || `custom-pack-${index + 1}`)
}

function unitProfileSource(unit: CustomDataRecord) {
  const custom = isRecord(unit._olddexCustom) ? unit._olddexCustom : {}
  if (isRecord(custom.profileLocked)) return custom.profileLocked
  if (isRecord(unit.profile)) return unit.profile
  const first = records(unit.profiles)[0]
  if (first && isRecord(first.stats)) return first.stats
  if (first && isRecord(first.profile)) return first.profile
  return null
}

function completeBaseProfile(unit: CustomDataRecord) {
  const source = unitProfileSource(unit)
  if (!source) return null
  const profile = {} as Record<ProfileKey, string>
  for (const key of BASE_PROFILE_KEYS) {
    const value = source[key]
    if (value === undefined || value === null || clean(value) === '') return null
    profile[key] = clean(value)
  }
  return profile
}

function saveValue(value: unknown) {
  if (value === undefined || value === null || clean(value) === '') return '—'
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric > 0 ? `${numeric}+` : '—'
  const text = clean(value)
  if (/^\d+$/.test(text)) return `${text}+`
  return text
}

function completeProfile(unit: CustomDataRecord) {
  const profile = completeBaseProfile(unit)
  if (!profile) return null
  const saves = isRecord(unit.saves) ? unit.saves : {}
  profile.Sv = saveValue(unit.armourSave ?? saves.armour ?? saves.armor ?? unit.save)
  profile.Ward = saveValue(unit.wardSave ?? saves.ward)
  profile.Rn = saveValue(unit.regenerationSave ?? saves.regen ?? saves.regeneration)
  return profile
}

function customUnitCategory(unit: CustomDataRecord): PrototypeUnit['category'] | null {
  const value = clean(unit.category || unit.unitCategory).toLowerCase()
  if (/general|character/.test(value)) return 'Characters'
  if (/^core\b/.test(value)) return 'Core'
  if (/^special\b/.test(value)) return 'Special'
  if (/^rare\b/.test(value)) return 'Rare'
  if (/mercenar/.test(value)) return 'Mercenaries'
  if (/all(?:y|ies)/.test(value)) return 'Allies'
  return null
}

function validUnitRows(pack: CustomDataRecord) {
  return records(pack.units).filter((unit) => {
    const name = clean(unit.name || unit.name_en)
    const id = clean(unit.sourceId || unit.id)
    return Boolean(name && id && completeBaseProfile(unit) && customUnitCategory(unit))
  })
}

function resolveArmy(pack: CustomDataRecord): Army | null {
  const candidate = clean(pack.factionName || pack.faction || pack.army || pack.armyName)
  const key = slug(candidate)
  if (!key) return null
  return armies.find((army) =>
    slug(army.slug) === key
    || slug(army.dataKey) === key
    || slug(army.name) === key
  ) || null
}

function compositionCandidates(pack: CustomDataRecord, unit: CustomDataRecord) {
  const custom = isRecord(unit._olddexCustom) ? unit._olddexCustom : {}
  const values: unknown[] = [
    unit.armyComposition,
    unit.composition,
    custom.compositions,
    pack.armyComposition,
    pack.compositionRule,
    pack.composition,
  ]
  const out: string[] = []
  for (const value of values) {
    if (Array.isArray(value)) value.forEach((row) => { if (clean(row)) out.push(clean(row)) })
    else if (isRecord(value)) Object.keys(value).forEach((row) => { if (clean(row)) out.push(clean(row)) })
    else if (clean(value)) out.push(clean(value))
  }
  return [...new Set(out)]
}

function compositionMatches(pack: CustomDataRecord, unit: CustomDataRecord, army: Army, compositionId: string) {
  const requested = compositionCandidates(pack, unit)
  if (!requested.length) return true
  const composition = army.compositions.find((row) => row.id === compositionId)
  const accepted = new Set([
    slug(compositionId),
    slug(composition?.name),
    slug(`${army.name} ${composition?.name || compositionId}`),
    slug(`${army.name} — ${composition?.name || compositionId}`),
  ])
  if (composition?.name === 'Grand Army') {
    accepted.add(slug('Grand Army'))
    accepted.add(slug(`${army.name} Grand Army`))
    accepted.add(slug(`${army.name} — Grand Army`))
  }
  return requested.some((value) => {
    const normalized = slug(value)
    if (accepted.has(normalized)) return true
    if (composition?.name === 'Grand Army' && /\bgrand-army\b/.test(normalized)) return true
    return false
  })
}

function unitId(pack: CustomDataRecord, unit: CustomDataRecord) {
  const explicit = slug(unit.sourceId)
  if (explicit) return explicit.startsWith('custom-') ? explicit : `custom-${explicit}`
  const id = slug(unit.id || unit.name)
  const prefix = slug(pack.id || pack.name)
  return id.startsWith('custom-') ? id : `custom-${prefix ? `${prefix}-` : ''}${id}`
}

function ruleTone(name: string, notes: string): RuleTone {
  const text = `${name} ${notes}`.toLowerCase()
  if (/\b(start of|strategy|rallying cry|waaagh)\b/.test(text)) return 'strategy'
  if (/\b(move|movement|march|charge reaction)\b/.test(text)) return 'movement'
  if (/\b(shoot|missile|ranged)\b/.test(text)) return 'shooting'
  if (/\b(spell|magic|wizard|dispel)\b/.test(text)) return 'magic'
  if (/\b(challenge|combat|to hit|to wound|attack|hatred|furious charge)\b/.test(text)) return 'combat'
  if (/\b(reaction|when charged)\b/.test(text)) return 'reaction'
  return 'passive'
}

function ruleTiming(tone: RuleTone) {
  if (tone === 'strategy') return 'Strategy'
  if (tone === 'movement') return 'Movement'
  if (tone === 'shooting') return 'Shooting'
  if (tone === 'combat') return 'Combat'
  if (tone === 'magic') return 'Magic'
  if (tone === 'reaction') return 'Reaction'
  return 'Passive'
}

function rulePath(name: string) {
  const unique = /^(?:Da Immortulz|Best of da Best|Da Bigst Boys)$/i.test(name)
  return unique ? '' : `/special-rules/${slug(name.replace(/\s*\([^)]*\)\s*$/, ''))}`
}

function customSpecialRules(unit: CustomDataRecord): PrototypeUnit['specialRules'] {
  const custom = isRecord(unit._olddexCustom) ? unit._olddexCustom : {}
  const customText = isRecord(custom.customRuleText) ? custom.customRuleText : {}
  const sourceRows = records(unit.specialRules)
  const names = sourceRows.length
    ? sourceRows
    : (Array.isArray(unit.ruleNames) ? unit.ruleNames.map((name) => ({ name } as CustomDataRecord)) : [])
  const seen = new Set<string>()
  return names.flatMap((row) => {
    const name = clean(row.name || row.label)
    if (!name) return []
    const key = name.toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    const notes = clean(row.notes || customText[name])
    const tone = ruleTone(name, notes)
    return [{
      name,
      sourceName: name,
      path: rulePath(name),
      timing: ruleTiming(tone),
      tone,
      summary: notes,
      keywords: [],
    }]
  })
}

function customWeapons(unit: CustomDataRecord): PrototypeWeapon[] {
  return records(unit.weapons).flatMap((row) => {
    const name = clean(row.name)
    if (!name) return []
    const kind = /missile|ranged|shoot/i.test(clean(row.kind || row.type)) ? 'missile' : 'melee'
    const rules = Array.isArray(row.rules) ? row.rules.map(clean).filter(Boolean) : []
    return [{
      id: slug(row.id || name),
      name,
      sourceName: name,
      kind,
      range: clean(row.range) || (kind === 'melee' ? 'Combat' : '—'),
      strength: clean(row.strength) || 'S',
      ap: clean(row.ap) || '—',
      rules,
      points: Math.max(0, Number(row.points) || 0),
      default: row.active !== false,
      locked: row.alwaysActive !== false,
      alwaysIncluded: row.alwaysActive !== false,
      selectionMode: 'unit-toggle',
      costMode: 'flat',
      note: clean(row.notes) || undefined,
      ruleLinks: rules.map((label) => ({ label, path: `/special-rules/${slug(label.replace(/\s*\([^)]*\)\s*$/, ''))}` })),
    }]
  })
}

function equipmentKind(type: string): PrototypeEquipmentOption['kind'] {
  if (/armou?r/i.test(type)) return 'armour'
  return 'equipment'
}

function customEquipment(unit: CustomDataRecord): PrototypeEquipmentOption[] {
  const weaponIds = new Set(customWeapons(unit).map((weapon) => weapon.id))
  return records(unit.equipment).flatMap((row) => {
    const name = clean(row.name)
    const id = slug(row.id || name)
    if (!name || weaponIds.has(id)) return []
    const type = clean(row.type)
    const notes = clean(row.notes)
    const override: Partial<Record<ProfileKey, string>> = {}
    const armour = notes.match(/\bArmou?r (?:Value|save)\s+(?:of\s+)?(\d+)\+/i)
    const ward = notes.match(/\b(\d+)\+\s+Ward save\b/i)
    const regen = notes.match(/\bRegeneration\s*\((\d+)\+\)/i)
    if (armour) override.Sv = `${armour[1]}+`
    if (ward) override.Ward = `${ward[1]}+`
    if (regen) override.Rn = `${regen[1]}+`
    return [{
      id,
      name,
      sourceName: name,
      points: Math.max(0, Number(row.points) || 0),
      default: row.active !== false,
      locked: row.alwaysActive !== false,
      alwaysIncluded: row.alwaysActive !== false,
      profileOverride: Object.keys(override).length ? override : undefined,
      kind: equipmentKind(type),
      note: notes || undefined,
      costMode: 'flat',
      selectionMode: 'unit-toggle',
    }]
  })
}

function profileRows(pack: CustomDataRecord, unit: CustomDataRecord, army: Army, compositionId: string, rosterUnitId: string, base: Record<ProfileKey, string>): PrototypeProfileRow[] {
  const rows = records(unit.profiles)
  if (!rows.length) {
    return [{
      name: clean(unit.name || unit.name_en),
      profile: { ...base },
      identity: {
        factionId: army.dataKey,
        compositionId,
        rosterUnitId,
        rulesPath: `custom-data:${packId(pack)}`,
        profileId: slug(unit.id || unit.name),
        source: 'custom-data',
      },
    }]
  }
  const result = rows.flatMap((row, index) => {
    const source = isRecord(row.stats) ? row.stats : (isRecord(row.profile) ? row.profile : null)
    if (!source) return []
    const profile = {} as Record<ProfileKey, string>
    for (const key of BASE_PROFILE_KEYS) {
      const value = source[key]
      if (value === undefined || value === null || clean(value) === '') return []
      profile[key] = clean(value)
    }
    for (const key of SAVE_PROFILE_KEYS) profile[key] = base[key]
    const name = clean(row.name) || clean(unit.name || unit.name_en)
    return [{
      name,
      profile,
      identity: {
        factionId: army.dataKey,
        compositionId,
        rosterUnitId,
        rulesPath: `custom-data:${packId(pack)}`,
        profileId: slug(row.id || name || `profile-${index + 1}`),
        source: 'custom-data' as const,
      },
    }]
  })
  return result.length ? result : [{
    name: clean(unit.name || unit.name_en),
    profile: { ...base },
    identity: {
      factionId: army.dataKey,
      compositionId,
      rosterUnitId,
      rulesPath: `custom-data:${packId(pack)}`,
      profileId: slug(unit.id || unit.name),
      source: 'custom-data',
    },
  }]
}

function normalizeCustomUnit(pack: CustomDataRecord, unit: CustomDataRecord, army: Army, compositionId: string): PrototypeUnit | null {
  const base = completeProfile(unit)
  const category = customUnitCategory(unit)
  if (!base || !category || !compositionMatches(pack, unit, army, compositionId)) return null
  const id = unitId(pack, unit)
  const name = clean(unit.name || unit.name_en)
  if (!id || !name) return null
  const custom = isRecord(unit._olddexCustom) ? unit._olddexCustom : {}
  const packCustom = isRecord(pack._olddexCustom) ? pack._olddexCustom : {}
  const profiles = profileRows(pack, unit, army, compositionId, id, base)
  const primary = profiles.find((row) => slug(row.name) === slug(name)) || profiles[0]
  const command = records(unit.command)
  const generalCommand = command.find((row) => /^General$/i.test(clean(row.name)))
  const forcedGeneral = Boolean(unit.mustBeGeneral || custom.mustBeGeneral)
  const generalEligible = category === 'Characters' && unit.cannotBeGeneral !== true && (unit.generalEligible !== false || Boolean(generalCommand) || Boolean(unit.isGeneral))
  const defaultGeneral = forcedGeneral || Boolean(unit.isGeneral) || Boolean(generalCommand && generalCommand.active !== false && generalCommand.alwaysActive !== false)
  const equipmentOptions = customEquipment(unit)
  if (generalEligible) equipmentOptions.push({
    id: 'general',
    name: 'General',
    points: 0,
    default: defaultGeneral,
    locked: forcedGeneral,
    alwaysIncluded: forcedGeneral,
    kind: 'role',
    costMode: 'flat',
    selectionMode: 'unit-toggle',
  })
  const weapons = customWeapons(unit)
  const hasHandWeapon = weapons.some((weapon) => /^Hand weapons?$/i.test(weapon.name))
  const pointValue = Math.max(0, Number(unit.points) || 0)
  const pointStatus = clean(custom.pointsStatus || packCustom.pointsStatus || (pointValue ? 'PRICED' : 'UNPRICED'))
  const status = clean(custom.status || 'CUSTOM')
  return {
    id,
    name,
    sourceName: name,
    category,
    points: pointValue,
    unitSize: clean(unit.unitSize) || `${Math.max(1, Number(unit.minimum || unit.startModels) || 1)} model`,
    profile: { ...primary.profile },
    profileIdentity: primary.identity,
    profiles,
    weapons,
    equipmentOptions,
    details: {
      troopType: clean(unit.troopType || unit.unitType),
      baseSize: clean(unit.baseSize),
      publication: `Custom Data${status ? ` — ${status}` : ''}`,
      army: army.name,
      unitCategory: category,
      notes: pointStatus === 'UNPRICED' ? 'Custom unit data is marked UNPRICED.' : undefined,
    },
    specialRules: customSpecialRules(unit),
    keywords: [
      ...(category === 'Characters' ? [{ label: 'Character', path: '/characters/characters' }] : []),
      { label: 'Custom Unit', path: '/model-profiles/model-profiles' },
    ],
    minimumModels: Math.max(1, Number(unit.minimum || unit.startModels) || 1),
    maximumModels: Math.max(1, Number(unit.maximum || unit.minimum || unit.startModels) || 1),
    named: Boolean(unit.named),
    mustBeGeneral: forcedGeneral,
    cannotBeGeneral: Boolean(unit.cannotBeGeneral),
    additionalDetails: [
      { label: 'Custom data', value: clean(pack.name || pack.id) || 'Imported custom data' },
      { label: 'Status', value: status || 'CUSTOM' },
      { label: 'Points status', value: pointStatus || (pointValue ? 'PRICED' : 'UNPRICED') },
    ],
    assumesHandWeapon: hasHandWeapon || !weapons.length,
    sourceKind: 'custom',
  }
}

function allCustomPacks() {
  const merged = new Map<string, CustomDataRecord>()
  const builtIns = customPackRows(builtInGrimgor)
  const imported = importedCustomPacks()
  // User packs may add new units, but a bundled pack with the same id remains
  // authoritative so app updates cannot be shadowed by an older local copy.
  imported.forEach((pack, index) => merged.set(packId(pack, index), pack))
  builtIns.forEach((pack, index) => merged.set(packId(pack, imported.length + index), pack))
  return [...merged.values()]
}

export function customUnitsForArmy(dataKey: string, compositionId: string): PrototypeUnit[] {
  const army = armies.find((row) => row.dataKey === dataKey || row.slug === dataKey)
  if (!army) return []
  const units: PrototypeUnit[] = []
  for (const pack of allCustomPacks()) {
    const target = resolveArmy(pack)
    if (!target || target.slug !== army.slug) continue
    for (const rawUnit of validUnitRows(pack)) {
      const unit = normalizeCustomUnit(pack, rawUnit, army, compositionId)
      if (unit) units.push(unit)
    }
  }
  const byId = new Map<string, PrototypeUnit>()
  units.forEach((unit) => byId.set(unit.id, unit))
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function customUnitForArmy(dataKey: string, compositionId: string, unitIdValue: string) {
  return customUnitsForArmy(dataKey, compositionId).find((unit) => unit.id === unitIdValue) || null
}

export function importCustomDataJson(text: string): CustomDataImportResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Custom data must be valid JSON.')
  }
  const packs = customPackRows(value)
  if (!packs.length) throw new Error('No custom-data pack with a units array was found in this JSON file.')

  const accepted = packs.filter((pack) => {
    const army = resolveArmy(pack)
    return Boolean(army && validUnitRows(pack).length)
  })
  if (!accepted.length) {
    throw new Error('Custom data did not contain a complete unit profile with a recognized roster category for a recognized Old.dex faction.')
  }

  const existing = new Map<string, CustomDataRecord>()
  importedCustomPacks().forEach((pack, index) => existing.set(packId(pack, index), pack))
  accepted.forEach((pack, index) => existing.set(packId(pack, index), pack))
  if (!writeJson(CUSTOM_DATA_STORAGE_KEY, [...existing.values()])) {
    throw new Error('Custom data could not be saved in this browser.')
  }

  return {
    packs: accepted.length,
    units: accepted.reduce((sum, pack) => sum + validUnitRows(pack).length, 0),
    packNames: accepted.map((pack) => clean(pack.name || pack.id) || 'Custom data'),
  }
}
