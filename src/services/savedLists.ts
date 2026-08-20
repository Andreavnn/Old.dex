import type { BuilderRosterSelection } from '../domain/rosterTypes'
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
  })
}

export function savedArmyListRoute(row: SavedArmyList) {
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
