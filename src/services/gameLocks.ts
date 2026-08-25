import { readStorage, writeStorage } from './storage'

const KEY = 'olddex.game-locks.v1'

function readLockedIds() {
  try {
    const value = JSON.parse(readStorage(KEY) || '[]')
    return new Set(Array.isArray(value) ? value.map(String).filter(Boolean) : [])
  } catch {
    return new Set<string>()
  }
}

function writeLockedIds(ids: Set<string>) {
  writeStorage(KEY, JSON.stringify([...ids]))
}

export function lockedGameIds() { return readLockedIds() }

export function isGameLocked(id: string) {
  return Boolean(id) && readLockedIds().has(id)
}

export function setGameLocked(id: string, locked: boolean) {
  if (!id) return false
  const ids = readLockedIds()
  if (locked) ids.add(id)
  else ids.delete(id)
  writeLockedIds(ids)
  return locked
}

export function clearGameLock(id: string) {
  if (!id) return
  const ids = readLockedIds()
  if (!ids.delete(id)) return
  writeLockedIds(ids)
}
