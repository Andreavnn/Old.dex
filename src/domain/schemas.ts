import type { BuilderRosterMagicItem, BuilderRosterRule, BuilderRosterSelection } from './rosterTypes'
import type { BuilderCategory } from '../data/builderPrototype'
import type { ArmyDataDocument, MagicItemDataDocument, RawRecord } from './rawArmyData'

export type UnknownRecord = Record<string, unknown>

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function asRecord(value: unknown, label = 'record'): UnknownRecord {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`)
  return value
}

export function asArray(value: unknown, label = 'array'): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value
}

function validatedRecordArray(value: unknown) {
  if (!Array.isArray(value)) return null
  return value.filter((row): row is RawRecord => isRecord(row))
}

export function parseMagicItemDataDocument(value: unknown): MagicItemDataDocument {
  if (!isRecord(value)) throw new Error('Magic-item data must be an object keyed by source.')
  const result: MagicItemDataDocument = {}
  let usableRows = 0
  for (const [source, rows] of Object.entries(value)) {
    if (!Array.isArray(rows)) continue
    result[source] = rows.filter((row): row is RawRecord => {
      if (!isRecord(row)) return false
      const name = String(row.name_en || row.name || '').trim()
      const type = String(row.type || '').trim()
      return Boolean(name && type)
    })
    usableRows += result[source].length
  }
  if (!usableRows) throw new Error('Magic-item data did not contain any usable items.')
  return result
}

export function parseArmyDataDocument(value: unknown, dataKey: string): ArmyDataDocument {
  if (!isRecord(value)) throw new Error(`Army data '${dataKey}' must be an object keyed by category/source.`)
  const result: ArmyDataDocument = {}
  let collectionRows = 0
  for (const [key, entry] of Object.entries(value)) {
    const records = validatedRecordArray(entry)
    if (records) {
      // Collection rows are allowed to be heterogeneous, but malformed scalar
      // entries are removed at ingress so downstream normalizers only see objects.
      result[key] = records
      collectionRows += records.length
      continue
    }
    // Preserve non-collection metadata only when it is JSON-safe scalar/object data.
    if (entry === null || ['string', 'number', 'boolean'].includes(typeof entry) || isRecord(entry)) result[key] = entry
  }
  if (!collectionRows) throw new Error(`Army data '${dataKey}' did not contain any usable collection rows.`)
  return result
}

export function validateArmyDataDocument(value: unknown, dataKey: string): ArmyDataDocument | MagicItemDataDocument {
  return dataKey === 'magic-items' ? parseMagicItemDataDocument(value) : parseArmyDataDocument(value, dataKey)
}

const builderCategories = new Set<BuilderCategory>(['General', 'Characters', 'Core', 'Special', 'Rare', 'Mercenaries', 'Allies', 'Custom Units'])
const magicTypes = new Set<BuilderRosterMagicItem['type']>(['weapon', 'armor', 'talisman', 'enchanted-item', 'arcane-item', 'banner'])

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === 'string') : []
}

function numberRecord(value: unknown) {
  if (!isRecord(value)) return undefined
  const out: Record<string, number> = {}
  Object.entries(value).forEach(([key, row]) => {
    const number = Number(row)
    if (Number.isFinite(number) && number >= 0) out[key] = number
  })
  return out
}

function rosterRules(value: unknown): BuilderRosterRule[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!isRecord(row)) return []
    const label = typeof row.label === 'string' ? row.label : ''
    const path = typeof row.path === 'string' ? row.path : ''
    return label ? [{ label, path }] : []
  })
}

function magicItems(value: unknown): BuilderRosterMagicItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!isRecord(row)) return []
    const type = String(row.type || '') as BuilderRosterMagicItem['type']
    if (!magicTypes.has(type)) return []
    const id = String(row.id || '')
    const name = String(row.name || '')
    if (!id || !name) return []
    return [{
      id,
      name,
      points: Math.max(0, Number(row.points) || 0),
      type,
      source: String(row.source || ''),
      stackable: Boolean(row.stackable),
      maximum: Number(row.maximum) > 0 ? Number(row.maximum) : undefined,
      onePerArmy: row.onePerArmy !== false,
      slug: String(row.slug || ''),
      count: Math.max(1, Number(row.count) || 1),
      baseId: typeof row.baseId === 'string' ? row.baseId : undefined,
      ownerId: typeof row.ownerId === 'string' ? row.ownerId : undefined,
      ownerLabel: typeof row.ownerLabel === 'string' ? row.ownerLabel : undefined,
      poolMaxPoints: Number(row.poolMaxPoints) > 0 ? Number(row.poolMaxPoints) : undefined,
    }]
  })
}

export function parseBuilderRosterSelection(value: unknown): BuilderRosterSelection | null {
  if (!isRecord(value)) return null
  const instanceId = String(value.instanceId || '')
  const unitId = String(value.unitId || '')
  const name = String(value.name || '')
  const category = String(value.category || '') as BuilderCategory
  if (!instanceId || !unitId || !name || !builderCategories.has(category)) return null
  const magicPools = Array.isArray(value.magicPools) ? value.magicPools.flatMap((row) => {
    if (!isRecord(row)) return []
    const ownerId = String(row.ownerId || '')
    const ownerLabel = String(row.ownerLabel || '')
    const maxPoints = Number(row.maxPoints)
    return ownerId && ownerLabel && Number.isFinite(maxPoints) && maxPoints >= 0 ? [{ ownerId, ownerLabel, maxPoints }] : []
  }) : undefined
  return {
    instanceId,
    unitId,
    name,
    category,
    totalPoints: Math.max(0, Number(value.totalPoints) || 0),
    basePoints: Math.max(0, Number(value.basePoints) || 0),
    unitSize: String(value.unitSize || '1 model'),
    modelCount: Number(value.modelCount) > 0 ? Number(value.modelCount) : undefined,
    maximumModels: Number(value.maximumModels) > 0 ? Number(value.maximumModels) : undefined,
    named: typeof value.named === 'boolean' ? value.named : undefined,
    custom: typeof value.custom === 'boolean' ? value.custom : undefined,
    mustBeGeneral: typeof value.mustBeGeneral === 'boolean' ? value.mustBeGeneral : undefined,
    cannotBeGeneral: typeof value.cannotBeGeneral === 'boolean' ? value.cannotBeGeneral : undefined,
    troopType: typeof value.troopType === 'string' ? value.troopType : undefined,
    leadership: Number.isFinite(Number(value.leadership)) ? Number(value.leadership) : undefined,
    generalEligible: typeof value.generalEligible === 'boolean' ? value.generalEligible : undefined,
    hierophantEligible: typeof value.hierophantEligible === 'boolean' ? value.hierophantEligible : undefined,
    options: strings(value.options),
    includedEquipment: strings(value.includedEquipment),
    optionalSelections: strings(value.optionalSelections),
    specialRules: rosterRules(value.specialRules),
    keywords: rosterRules(value.keywords),
    weaponIds: strings(value.weaponIds),
    equipmentIds: strings(value.equipmentIds),
    magicItems: magicItems(value.magicItems),
    magicPools,
    weaponCounts: numberRecord(value.weaponCounts),
    equipmentCounts: numberRecord(value.equipmentCounts),
    loreSelections: strings(value.loreSelections),
  }
}

export function parseBuilderRoster(value: unknown): BuilderRosterSelection[] {
  if (!Array.isArray(value)) throw new Error('Roster data must be an array.')
  return value.map(parseBuilderRosterSelection).filter((row): row is BuilderRosterSelection => Boolean(row))
}

export type PersistedSavedArmyList = {
  id: string
  name: string
  army: string
  armyName: string
  composition: string
  compositionName: string
  rule: string
  points: number
  options: string[]
  description: string
  roster: BuilderRosterSelection[]
  locked?: boolean
  actualPoints?: number
  validationStatus?: 'valid' | 'invalid' | 'warning'
  enemyRoster?: boolean
  createdAt: string
  updatedAt: string
}

export function parseSavedArmyLists(value: unknown): PersistedSavedArmyList[] {
  if (!Array.isArray(value)) throw new Error('Saved-list data must be an array.')
  return value.flatMap((row) => {
    if (!isRecord(row)) return []
    const id = String(row.id || '')
    const name = String(row.name || '')
    if (!id || !name) return []
    return [{
      id,
      name,
      army: String(row.army || ''),
      armyName: String(row.armyName || ''),
      composition: String(row.composition || ''),
      compositionName: String(row.compositionName || ''),
      rule: String(row.rule || ''),
      points: Math.max(0, Number(row.points) || 0),
      options: strings(row.options),
      description: String(row.description || ''),
      roster: Array.isArray(row.roster) ? parseBuilderRoster(row.roster) : [],
      locked: typeof row.locked === 'boolean' ? row.locked : undefined,
      actualPoints: Number.isFinite(Number(row.actualPoints)) ? Math.max(0, Number(row.actualPoints)) : undefined,
      validationStatus: ['valid', 'invalid', 'warning'].includes(String(row.validationStatus)) ? String(row.validationStatus) as PersistedSavedArmyList['validationStatus'] : undefined,
      enemyRoster: typeof row.enemyRoster === 'boolean' ? row.enemyRoster : undefined,
      createdAt: String(row.createdAt || new Date(0).toISOString()),
      updatedAt: String(row.updatedAt || row.createdAt || new Date(0).toISOString()),
    }]
  })
}

export type RuleDocumentShape = {
  title: string
  sourcePath: string
  html: string
  fetchedAt: string
  transport: 'proxy' | 'direct' | 'reader'
  version?: string
}

export function parseRuleDocument(value: unknown): RuleDocumentShape {
  const row = asRecord(value, 'rule cache document')
  const transport = String(row.transport || '') as RuleDocumentShape['transport']
  if (!['proxy', 'direct', 'reader'].includes(transport)) throw new Error('Rule cache transport is invalid.')
  const document = {
    title: String(row.title || ''),
    sourcePath: String(row.sourcePath || ''),
    html: String(row.html || ''),
    fetchedAt: String(row.fetchedAt || ''),
    transport,
    version: typeof row.version === 'string' ? row.version : undefined,
  }
  if (!document.title || !document.sourcePath || !document.html || !document.fetchedAt) throw new Error('Rule cache document is incomplete.')
  return document
}
