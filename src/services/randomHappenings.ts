import { parseRandomHappeningTable, type RandomHappeningTable } from '../core/randomHappeningTable'
import { fetchRuleDocument } from './ruleContent'

export type { RandomHappeningResult, RandomHappeningTable } from '../core/randomHappeningTable'
export { parseRandomHappeningTable } from '../core/randomHappeningTable'

const cache = new Map<string, Promise<RandomHappeningTable>>()

export function loadRandomHappeningTable(path: string) {
  const key = String(path || '').trim()
  const found = cache.get(key)
  if (found) return found
  const pending = fetchRuleDocument(key).then((document) => parseRandomHappeningTable(document.html, key))
  cache.set(key, pending)
  return pending
}

export function clearRandomHappeningTables() { cache.clear() }
