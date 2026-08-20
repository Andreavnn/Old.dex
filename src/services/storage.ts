import { reportAppError } from './appErrors'

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readStorage(key: string): string | null {
  if (!storageAvailable()) return null
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    reportAppError(error, 'STORAGE_READ_FAILED', { key })
    return null
  }
}

export function writeStorage(key: string, value: string) {
  if (!storageAvailable()) return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (error) {
    reportAppError(error, 'STORAGE_WRITE_FAILED', { key })
    return false
  }
}

export function removeStorage(key: string) {
  if (!storageAvailable()) return false
  try {
    window.localStorage.removeItem(key)
    return true
  } catch (error) {
    reportAppError(error, 'STORAGE_REMOVE_FAILED', { key })
    return false
  }
}

export function storageKeys() {
  if (!storageAvailable()) return [] as string[]
  try {
    return Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).filter((key): key is string => Boolean(key))
  } catch (error) {
    reportAppError(error, 'STORAGE_KEYS_FAILED')
    return [] as string[]
  }
}

export function readJson<T>(key: string, parse: (value: unknown) => T, fallback: T): T {
  const raw = readStorage(key)
  if (!raw) return fallback
  try {
    return parse(JSON.parse(raw))
  } catch (error) {
    reportAppError(error, 'STORAGE_DATA_INVALID', { key })
    return fallback
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    return writeStorage(key, JSON.stringify(value))
  } catch (error) {
    reportAppError(error, 'STORAGE_SERIALIZE_FAILED', { key })
    return false
  }
}
