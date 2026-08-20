import { readJson, writeJson } from './storage'

const KEY = 'olddex.favorite-units.v1'

function parseKeys(value: unknown) {
  if (!Array.isArray(value)) throw new Error('Favorite-unit data must be an array.')
  return new Set(value.filter((row): row is string => typeof row === 'string'))
}

function readKeys() {
  return readJson(KEY, parseKeys, new Set<string>())
}

function writeKeys(keys: Set<string>) {
  writeJson(KEY, [...keys].sort())
}

export function favoriteUnitKey(armySlug: string, unitId: string) {
  return `${armySlug}:${unitId}`
}

export function isFavoriteUnit(armySlug: string, unitId: string) {
  return readKeys().has(favoriteUnitKey(armySlug, unitId))
}

export function favoriteUnitIdsForArmy(armySlug: string) {
  const prefix = `${armySlug}:`
  return new Set([...readKeys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)))
}

export function setFavoriteUnit(armySlug: string, unitId: string, favorite: boolean) {
  const keys = readKeys()
  const key = favoriteUnitKey(armySlug, unitId)
  favorite ? keys.add(key) : keys.delete(key)
  writeKeys(keys)
  return favorite
}

export function toggleFavoriteUnit(armySlug: string, unitId: string) {
  return setFavoriteUnit(armySlug, unitId, !isFavoriteUnit(armySlug, unitId))
}
