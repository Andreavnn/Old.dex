import type { BuilderRosterMagicItem, BuilderRosterSelection } from '../domain/rosterTypes'
import { parseSavedArmyLists } from '../domain/schemas'
import { readJson, readStorage, removeStorage, writeJson } from './storage'

export type SavedArmyList = {
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
  roster?: BuilderRosterSelection[]
  locked?: boolean
  actualPoints?: number
  validationStatus?: 'valid' | 'invalid' | 'warning'
  enemyRoster?: boolean
  createdAt: string
  updatedAt: string
}

const KEY = 'olddex.saved-lists.v2'
const LEGACY_KEY = 'olddex.saved-lists.v1'

function cloneRoster(rows: BuilderRosterSelection[]) {
  return rows.map((row) => ({
    ...row,
    options: [...(row.options || [])],
    includedEquipment: [...(row.includedEquipment || [])],
    optionalSelections: [...(row.optionalSelections || [])],
    specialRules: (row.specialRules || []).map((rule) => ({ ...rule })),
    keywords: (row.keywords || []).map((rule) => ({ ...rule })),
    weaponIds: [...(row.weaponIds || [])],
    equipmentIds: [...(row.equipmentIds || [])],
    magicItems: (row.magicItems || []).map((item) => ({ ...item })),
    magicPools: (row.magicPools || []).map((pool) => ({ ...pool })),
    weaponCounts: { ...(row.weaponCounts || {}) },
    equipmentCounts: { ...(row.equipmentCounts || {}) },
    loreSelections: [...(row.loreSelections || [])],
  }))
}

function readAll(): SavedArmyList[] {
  // Presence of the v2 key is authoritative even when it contains an empty array;
  // otherwise deleting all lists could resurrect legacy v1 data on the next read.
  if (readStorage(KEY) !== null) return readJson(KEY, parseSavedArmyLists, []) as SavedArmyList[]
  const legacy = readJson(LEGACY_KEY, parseSavedArmyLists, []) as SavedArmyList[]
  if (legacy.length && writeAll(legacy)) removeStorage(LEGACY_KEY)
  return legacy
}

function writeAll(rows: SavedArmyList[]) {
  return writeJson(KEY, rows.map((row) => ({ ...row, roster: cloneRoster(row.roster || []) })))
}

export function createSavedArmyList(input: Omit<SavedArmyList, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString()
  const row: SavedArmyList = { ...input, roster: cloneRoster(input.roster || []), id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: now, updatedAt: now }
  writeAll([row, ...readAll()])
  return row
}

export function getSavedArmyLists() {
  return readAll().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getSavedArmyList(id: string) {
  if (!id) return null
  return readAll().find((row) => row.id === id) || null
}

export function updateSavedArmyList(id: string, patch: Partial<Omit<SavedArmyList, 'id' | 'createdAt' | 'updatedAt' | 'roster'>>) {
  if (!id) return null
  const rows = readAll()
  const found = rows.find((row) => row.id === id)
  if (!found) return null
  Object.assign(found, patch)
  found.updatedAt = new Date().toISOString()
  writeAll(rows)
  return found
}

export function saveSavedArmyListRoster(id: string, roster: BuilderRosterSelection[]) {
  if (!id) return false
  const rows = readAll()
  const found = rows.find((row) => row.id === id)
  if (!found) return false
  found.roster = cloneRoster(roster)
  found.updatedAt = new Date().toISOString()
  writeAll(rows)
  return true
}

export function deleteSavedArmyLists(ids: string[]) {
  const wanted = new Set(ids.filter(Boolean))
  if (!wanted.size) return 0
  const rows = readAll()
  const next = rows.filter((row) => !wanted.has(row.id))
  writeAll(next)
  return rows.length - next.length
}


export function clearSavedArmyListsByType(enemyRoster: boolean) {
  const rows = readAll()
  const next = rows.filter((row) => Boolean(row.enemyRoster) !== enemyRoster)
  writeAll(next)
  return rows.length - next.length
}

export function duplicateSavedArmyList(id: string) {
  const source = getSavedArmyList(id)
  if (!source) return null
  return createSavedArmyList({
    name: `${source.name} Copy`,
    army: source.army,
    armyName: source.armyName,
    composition: source.composition,
    compositionName: source.compositionName,
    rule: source.rule,
    points: source.points,
    options: [...source.options],
    description: source.description,
    roster: cloneRoster(source.roster || []),
    locked: false,
    actualPoints: source.actualPoints,
    validationStatus: source.validationStatus,
    enemyRoster: source.enemyRoster,
  })
}

export function savedArmyListRoute(row: SavedArmyList) {
  if (row.enemyRoster) return { name: 'list-view', params: { listId: row.id } }
  return {
    name: 'list-builder',
    query: {
      list: row.id,
      army: row.army,
      composition: row.composition,
      rule: row.rule,
      points: String(row.points),
      name: row.name,
      ...(row.options.length ? { options: row.options.join(',') } : {}),
      ...(row.description ? { description: row.description } : {}),
    },
  }
}


function importRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function importName(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (!importRecord(value)) return ''
  return String(value.name_en || value.name || value.text_en || value.text || '').trim()
}
function importSlug(value: string) { return String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function importTitle(value: unknown) {
  const words = String(value || '').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').split(' ').filter(Boolean)
  return words.map((word, index) => { const lower = word.toLowerCase(); return index > 0 && ['of', 'the', 'and'].includes(lower) ? lower : lower.charAt(0).toUpperCase() + lower.slice(1) }).join(' ')
}
function importRules(value: unknown) {
  const source = Array.isArray(value) ? value : [value]
  const result: string[] = []
  for (const row of source) {
    const text = importName(row) || (typeof row === 'string' ? row : '')
    for (const name of String(text || '').split(',').map((entry) => entry.trim()).filter(Boolean)) if (!result.some((existing) => existing.toLowerCase() === name.toLowerCase())) result.push(name)
  }
  return result
}
function owbItemActive(value: Record<string, unknown>) { return Boolean(value.active || value.alwaysActive || value.equippedDefault) }
function owbSelectedNames(items: unknown, output: string[]) {
  if (!Array.isArray(items)) return
  for (const raw of items) {
    if (!importRecord(raw)) continue
    const name = importName(raw)
    if (name && owbItemActive(raw) && !output.some((existing) => existing.toLowerCase() === name.toLowerCase())) output.push(name)
    owbSelectedNames(raw.options, output)
  }
}
function owbSelectedOptionPoints(items: unknown, strength: number) {
  if (!Array.isArray(items)) return 0
  let points = 0
  for (const raw of items) {
    if (!importRecord(raw)) continue
    const active = owbItemActive(raw)
    const count = Math.max(0, Number(raw.stackableCount || raw.amount || raw.minimum || 0) || 0)
    if (raw.stackable && count) points += count * (Number(raw.points) || 0)
    else if (active) points += (Number(raw.points) || 0) * (raw.perModel ? strength : 1)
    if (active || raw.alwaysActive) points += owbSelectedOptionPoints(raw.options, strength)
  }
  return points
}
function owbMagicPoints(items: unknown, strength: number) {
  if (!Array.isArray(items)) return 0
  let total = 0
  for (const raw of items) {
    if (!importRecord(raw) || !Array.isArray(raw.selected)) continue
    for (const entry of raw.selected) {
      if (!importRecord(entry)) continue
      const amount = Math.max(1, Number(entry.amount) || 1)
      if (entry.perModel && Number(entry.perModelPoints)) total += amount * Number(entry.perModelPoints) * strength
      else if (Number(entry.perUnitPoints)) total += amount * Number(entry.perUnitPoints)
      else total += amount * (Number(entry.points) || 0)
    }
  }
  return total
}

function normalizeMagicType(value: unknown): BuilderRosterMagicItem['type'] {
  const clean = String(value || '').toLowerCase().replace(/[_\s]+/g, '-')
  if (/weapon/.test(clean)) return 'weapon'
  if (/armo(?:u)?r/.test(clean)) return 'armor'
  if (/talisman/.test(clean)) return 'talisman'
  if (/arcane/.test(clean)) return 'arcane-item'
  if (/banner/.test(clean)) return 'banner'
  return 'enchanted-item'
}
function owbMagicItems(items: unknown, ownerId: string, ownerLabel: string): BuilderRosterMagicItem[] {
  if (!Array.isArray(items)) return []
  const result: BuilderRosterMagicItem[] = []
  for (const raw of items) {
    if (!importRecord(raw)) continue
    const selected = Array.isArray(raw.selected) ? raw.selected : []
    const containerTypes = Array.isArray(raw.types) ? raw.types : []
    const poolMaxPoints = Math.max(0, Number(raw.maxPoints) || 0) || undefined
    for (const entry of selected) {
      if (!importRecord(entry)) continue
      const name = importName(entry)
      if (!name) continue
      const typeHint = entry.type || entry.itemType || entry.category || (containerTypes.length === 1 ? containerTypes[0] : '')
      const type = normalizeMagicType(typeHint)
      const count = Math.max(1, Number(entry.amount) || 1)
      const perCopy = entry.perModel && Number(entry.perModelPoints) ? Number(entry.perModelPoints) : Number(entry.perUnitPoints) || Number(entry.points) || 0
      const baseId = String(entry.id || importSlug(name))
      result.push({
        id: `import-magic-${ownerId}-${baseId}-${result.length}`,
        baseId,
        name,
        points: Math.max(0, perCopy),
        type,
        source: importName(raw) || 'Imported magical items',
        stackable: Boolean(entry.stackable || Number(entry.maximum) > 1 || count > 1),
        maximum: Number(entry.maximum) > 0 ? Number(entry.maximum) : undefined,
        onePerArmy: entry.onePerArmy !== false && !entry.stackable,
        slug: importSlug(name),
        count,
        ownerId,
        ownerLabel,
        poolMaxPoints,
      })
    }
  }
  return result
}
function owbNestedMagicItems(items: unknown, ownerId: string, ownerLabel: string): BuilderRosterMagicItem[] {
  if (!Array.isArray(items)) return []
  const result: BuilderRosterMagicItem[] = []
  for (const raw of items) {
    if (!importRecord(raw)) continue
    const name = importName(raw) || ownerLabel
    if (importRecord(raw.magic)) result.push(...owbMagicItems([raw.magic], `${ownerId}-${importSlug(name)}`, name))
    if (Array.isArray(raw.options)) result.push(...owbNestedMagicItems(raw.options, ownerId, ownerLabel))
  }
  return result
}
function owbAllMagicItems(unit: Record<string, unknown>, unitId: string, unitLabel: string) {
  return [...owbMagicItems(unit.items, 'unit', unitLabel), ...owbNestedMagicItems(unit.command, unitId, unitLabel)]
}
function owbNestedMagicPoints(items: unknown, strength: number) {
  if (!Array.isArray(items)) return 0
  let total = 0
  for (const raw of items) {
    if (!importRecord(raw)) continue
    if (importRecord(raw.magic)) total += owbMagicPoints([raw.magic], strength)
    if (Array.isArray(raw.options)) total += owbNestedMagicPoints(raw.options, strength)
  }
  return total
}

function owbUnitPoints(unit: Record<string, unknown>, strength: number) {
  let total = (Number(unit.points) || 0) * Math.max(1, strength)
  total += owbSelectedOptionPoints(unit.options, strength)
  total += owbSelectedOptionPoints(unit.equipment, strength)
  total += owbSelectedOptionPoints(unit.armor, strength)
  total += owbSelectedOptionPoints(unit.command, strength)
  total += owbSelectedOptionPoints(unit.mounts, strength)
  total += owbMagicPoints(unit.items, strength)
  total += owbNestedMagicPoints(unit.command, strength)
  return Math.max(0, total)
}
function owbRoster(value: Record<string, unknown>) {
  const categoryMap: Array<[string, BuilderRosterSelection['category']]> = [['characters','Characters'],['lords','Characters'],['heroes','Characters'],['core','Core'],['special','Special'],['rare','Rare'],['mercenaries','Mercenaries'],['allies','Allies']]
  const rows: BuilderRosterSelection[] = []
  let serial = 0
  for (const [key, category] of categoryMap) {
    const sourceRows = Array.isArray(value[key]) ? value[key] as unknown[] : []
    for (const raw of sourceRows) {
      if (!importRecord(raw)) continue
      const name = importName(raw)
      if (!name) continue
      const sourceId = String(raw.id || importSlug(name))
      const unitId = sourceId.split('.')[0] || importSlug(name)
      const strength = Math.max(1, Number(raw.strength || raw.minimum || 1) || 1)
      const selectedNames: string[] = []
      owbSelectedNames(raw.options, selectedNames)
      owbSelectedNames(raw.equipment, selectedNames)
      owbSelectedNames(raw.armor, selectedNames)
      owbSelectedNames(raw.command, selectedNames)
      owbSelectedNames(raw.mounts, selectedNames)
      const includedEquipment: string[] = []
      for (const group of [raw.equipment, raw.armor]) if (Array.isArray(group)) for (const item of group) if (importRecord(item) && owbItemActive(item)) { const label = importName(item); if (label) includedEquipment.push(label) }
      const specialRuleNames = importRules(raw.specialRules ?? raw.special_rules ?? raw.rules ?? raw.rule)
      const troopType = String(raw.troopType || raw.troop_type || raw.unitType || raw.type || '').trim()
      const activeLore = typeof raw.activeLore === 'string' ? [importTitle(raw.activeLore)] : Array.isArray(raw.activeLore) ? raw.activeLore.map(importTitle).filter(Boolean) : []
      const importedMagicItems = owbAllMagicItems(raw, unitId, name)
      for (const item of importedMagicItems) if (!selectedNames.some((existing) => existing.toLowerCase() === item.name.toLowerCase())) selectedNames.push(item.name)
      rows.push({
        instanceId: `import-${Date.now()}-${serial++}-${Math.random().toString(36).slice(2,7)}`,
        unitId,
        name,
        category,
        totalPoints: owbUnitPoints(raw, strength),
        basePoints: Math.max(0, (Number(raw.points) || 0) * strength),
        unitSize: `${strength} model${strength === 1 ? '' : 's'}`,
        modelCount: strength,
        maximumModels: Number(raw.maximum) > 0 ? Number(raw.maximum) : undefined,
        named: typeof raw.named === 'boolean' ? raw.named : undefined,
        troopType: troopType || undefined,
        options: selectedNames,
        includedEquipment,
        optionalSelections: selectedNames.filter((name) => !includedEquipment.some((included) => included.toLowerCase() === name.toLowerCase())),
        specialRules: specialRuleNames.map((label) => ({ label, path: `/special-rules/${importSlug(label.replace(/\s*\([^)]*\)\s*$/, ''))}` })),
        keywords: troopType ? [{ label: troopType, path: '/model-profiles/troop-type' }] : [],
        weaponIds: [],
        equipmentIds: [],
        magicItems: importedMagicItems,
        loreSelections: activeLore,
      })
    }
  }
  return rows
}
function asImportRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(importRecord)
  if (!importRecord(value)) return []
  if (Array.isArray(value.lists)) return value.lists.filter(importRecord)
  return [value]
}

/** Import native Old.dex JSON or Old World Builder .owb.json/.owb.lists.json data. */
export function importSavedArmyListData(value: unknown) {
  const imported: SavedArmyList[] = []
  for (const row of asImportRows(value)) {
    const native = 'roster' in row || 'armyName' in row || 'compositionName' in row
    if (native) {
      const parsed = parseSavedArmyLists([{ ...row, id: String(row.id || 'import'), createdAt: String(row.createdAt || new Date().toISOString()), updatedAt: String(row.updatedAt || new Date().toISOString()) }])[0]
      if (!parsed) continue
      imported.push(createSavedArmyList({ name: parsed.name, army: parsed.army, armyName: parsed.armyName || importTitle(parsed.army), composition: parsed.composition || parsed.army, compositionName: parsed.compositionName || (parsed.composition === parsed.army ? 'Grand Army' : importTitle(parsed.composition)), rule: parsed.rule || 'open-war', points: parsed.points || 2000, options: parsed.options || [], description: parsed.description || '', roster: parsed.roster || [], locked: Boolean(parsed.locked), actualPoints: parsed.actualPoints, validationStatus: parsed.validationStatus, enemyRoster: Boolean(parsed.enemyRoster) }))
      continue
    }
    const army = String(row.army || '').trim()
    const name = String(row.name || '').trim()
    if (!army || !name) continue
    const composition = String(row.armyComposition || army).trim() || army
    const roster = owbRoster(row)
    imported.push(createSavedArmyList({
      name,
      army,
      armyName: importTitle(army),
      composition,
      compositionName: composition === army ? 'Grand Army' : importTitle(composition),
      rule: String(row.compositionRule || 'open-war'),
      points: Math.max(0, Number(row.points) || 2000),
      options: [],
      description: String(row.description || ''),
      roster,
      locked: false,
      actualPoints: roster.reduce((sum, unit) => sum + unit.totalPoints, 0),
      validationStatus: 'warning',
      enemyRoster: false,
    }))
  }
  if (!imported.length) throw new Error('No compatible Old.dex or Old World Builder army list was found in this JSON file.')
  return imported
}

export function importSavedArmyListJson(text: string) {
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('The selected file is not valid JSON.') }
  return importSavedArmyListData(value)
}


export function savedArmyListExportJson(row: SavedArmyList) {
  return JSON.stringify({ format: 'olddex-army-roster', version: '0.64', ...row, roster: cloneRoster(row.roster || []) }, null, 2)
}

export function exportSavedArmyList(row: SavedArmyList) {
  const blob = new Blob([savedArmyListExportJson(row)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${importSlug(row.name) || 'olddex-roster'}.olddex.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
