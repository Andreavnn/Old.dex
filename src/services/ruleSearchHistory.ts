import { isRecord } from '../domain/schemas'
import { readJson, writeJson } from './storage'

export type RuleSearchHistoryEntry = {
  name: string
  to: string
  count: number
  lastUsed: string
}

const STORAGE_KEY = 'olddex.rule-search-history.v1'
const MAX_ENTRIES = 24

function parseHistory(value: unknown): RuleSearchHistoryEntry[] {
  if (!Array.isArray(value)) throw new Error('Rule-search history must be an array.')
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.to !== 'string') return []
    return [{ name: item.name, to: item.to, count: Math.max(1, Number(item.count) || 1), lastUsed: typeof item.lastUsed === 'string' ? item.lastUsed : new Date(0).toISOString() }]
  })
}

function readAll() {
  return readJson(STORAGE_KEY, parseHistory, [])
}

function writeAll(entries: RuleSearchHistoryEntry[]) {
  writeJson(STORAGE_KEY, entries.slice(0, MAX_ENTRIES))
}

export function getRuleSearchHistory() {
  return readAll().sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
  })
}

export function recordRuleSearchSelection(name: string, to: string) {
  const entries = readAll()
  const existing = entries.find((entry) => entry.to === to)
  if (existing) {
    existing.name = name
    existing.count = Math.max(1, Number(existing.count) || 0) + 1
    existing.lastUsed = new Date().toISOString()
  } else {
    entries.push({ name, to, count: 1, lastUsed: new Date().toISOString() })
  }

  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
  })
  writeAll(entries)
}
