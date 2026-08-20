import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { parseBuilderRoster } from '../domain/schemas'
import { getSavedArmyList, saveSavedArmyListRoster } from './savedLists'
import { readJson, readStorage, removeStorage, writeJson } from './storage'

export type { BuilderRosterMagicItem, BuilderRosterRule, BuilderRosterSelection } from '../domain/rosterTypes'

const PREFIX = 'olddex.builder-roster.v2:'
const LEGACY_PREFIX = 'olddex.builder-roster.v1:'

function savedListId(builderPath: string) {
  try {
    const query = builderPath.includes('?') ? builderPath.slice(builderPath.indexOf('?') + 1) : ''
    return new URLSearchParams(query).get('list') || ''
  } catch {
    return ''
  }
}

function unsavedPathIdentity(builderPath: string) {
  try {
    const url = new URL(builderPath || '/lists/builder', 'https://olddex.local')
    url.searchParams.delete('list')
    return `${url.pathname}?${url.searchParams.toString()}`
  } catch {
    return builderPath || '/lists/builder'
  }
}

export function rosterStorageKey(builderPath: string) {
  return `${PREFIX}${encodeURIComponent(unsavedPathIdentity(builderPath))}`
}

function legacyRosterStorageKey(builderPath: string) {
  const listId = savedListId(builderPath)
  return `${LEGACY_PREFIX}${encodeURIComponent(listId ? `list:${listId}` : (builderPath || '/lists/builder'))}`
}

export function loadBuilderRoster(builderPath: string): BuilderRosterSelection[] {
  const listId = savedListId(builderPath)
  if (listId) return getSavedArmyList(listId)?.roster || []
  const currentKey = rosterStorageKey(builderPath)
  if (readStorage(currentKey) !== null) return readJson(currentKey, parseBuilderRoster, [])
  const legacyKey = legacyRosterStorageKey(builderPath)
  const legacy = readJson(legacyKey, parseBuilderRoster, [])
  if (legacy.length && writeJson(currentKey, legacy)) removeStorage(legacyKey)
  return legacy
}

export function saveBuilderRoster(builderPath: string, rows: BuilderRosterSelection[]) {
  const normalized = parseBuilderRoster(rows)
  const listId = savedListId(builderPath)
  if (listId) return saveSavedArmyListRoster(listId, normalized)
  return writeJson(rosterStorageKey(builderPath), normalized)
}

export function findBuilderRosterSelection(builderPath: string, instanceId: string) {
  return loadBuilderRoster(builderPath).find((row) => row.instanceId === instanceId) || null
}

export function updateBuilderRosterSelection(builderPath: string, instanceId: string, patch: Partial<BuilderRosterSelection>) {
  const rows = loadBuilderRoster(builderPath)
  const index = rows.findIndex((row) => row.instanceId === instanceId)
  if (index < 0) return false
  rows[index] = { ...rows[index], ...patch, instanceId: rows[index].instanceId }
  saveBuilderRoster(builderPath, rows)
  return true
}
