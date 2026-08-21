import { armies } from '../data/armies'
import { validateArmyDataDocument } from '../domain/schemas'
import { parseDataLiteral } from '../domain/dataLiteral'
import { parseCompositionRuleCatalog } from '../domain/composition'
import type { CompositionRuleCatalog } from '../domain/composition'
export type { CompositionRuleCatalog } from '../domain/composition'
import type { ArmyDataDocument, MagicItemDataDocument } from '../domain/rawArmyData'
import { fetchWithTimeout } from './http'
import { reportAppError } from './appErrors'
import { clearOwbRuleCatalog, loadOwbRuleCatalog } from './owbRuleResolver'

// Old.dex deliberately uses the same structured army source as Old World Builder.
// Source URLs remain isolated here so views never need to know where the data lives.
const RAW_DATA_ROOT = 'https://raw.githubusercontent.com/nthiebes/old-world-builder/refs/heads/main/public/games/the-old-world'
const SHARED_DATA_KEYS = ['magic-items']
const memoryCache = new Map<string, unknown>()

function dataUrl(dataKey: string, force = false) {
  const suffix = force ? `?olddex-refresh=${Date.now()}` : ''
  return `${RAW_DATA_ROOT}/${encodeURIComponent(dataKey)}.json${suffix}`
}

export async function loadArmyData(dataKey: 'magic-items', force?: boolean): Promise<MagicItemDataDocument>
export async function loadArmyData(dataKey: string, force?: boolean): Promise<ArmyDataDocument>
export async function loadArmyData(dataKey: string, force = false): Promise<ArmyDataDocument | MagicItemDataDocument> {
  if (!force && memoryCache.has(dataKey)) return memoryCache.get(dataKey) as ArmyDataDocument | MagicItemDataDocument
  const response = await fetchWithTimeout(dataUrl(dataKey, force), { cache: force ? 'reload' : 'default', source: `army-data:${dataKey}` })
  const data = validateArmyDataDocument(await response.json(), dataKey)
  memoryCache.set(dataKey, data)
  return data
}

export async function initializeBuilderData() {
  const keys = [...new Set([...armies.map((army) => army.dataKey), ...SHARED_DATA_KEYS])]
  const results = await Promise.allSettled(keys.map((key) => loadArmyData(key, false)))
  const failures = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return []
    reportAppError(result.reason, 'BUILDER_DATA_INITIALIZE_FAILED', { dataKey: keys[index] })
    return [keys[index]]
  })
  if (failures.length === keys.length) throw new Error('Builder data could not be initialized from any configured source.')
  return { attempted: keys.length, loaded: keys.length - failures.length, failures }
}

export function clearArmyDataCache() {
  memoryCache.clear()
}

export async function forceRefreshBuilderData(onProgress?: (completed: number, total: number) => void) {
  clearArmyDataCache()
  clearOwbRuleCatalog()
  const keys = [...new Set([...armies.map((army) => army.dataKey), ...SHARED_DATA_KEYS])]
  const total = keys.length + 1
  let completed = 0
  const failures: string[] = []

  for (const key of keys) {
    try {
      await loadArmyData(key, true)
    } catch (error) {
      reportAppError(error, 'BUILDER_DATA_REFRESH_FAILED', { dataKey: key })
      failures.push(key)
    } finally {
      completed += 1
      onProgress?.(completed, total)
    }
  }

  try {
    const catalog = await loadOwbRuleCatalog(true)
    if (Object.keys(catalog.rules).length < 500) throw new Error('Old World Builder rules index did not refresh completely.')
  } catch (error) {
    reportAppError(error, 'BUILDER_RULE_INDEX_REFRESH_FAILED')
    failures.push('owb-rule-index')
  } finally {
    completed += 1
    onProgress?.(completed, total)
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    const cacheNames = await window.caches.keys()
    await Promise.all(cacheNames.filter((name) => name.toLowerCase().includes('olddex')).map((name) => window.caches.delete(name)))
  }

  if (failures.length) {
    throw new Error(`Unable to refresh ${failures.length} data source${failures.length === 1 ? '' : 's'}.`)
  }

  return { refreshed: total, refreshedAt: new Date().toISOString() }
}

const RULES_SOURCE = 'https://raw.githubusercontent.com/nthiebes/old-world-builder/refs/heads/main/src/utils/rules.js'
let compositionRuleCache: CompositionRuleCatalog | null = null

function extractExportedObject(source: string, marker: string) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) throw new Error('Composition rules export was not found.')
  const start = source.indexOf('{', markerIndex + marker.length)
  if (start < 0) throw new Error('Composition rules object could not be parsed.')
  let depth = 0
  let quote = ''
  let escaped = false
  let lineComment = false
  let blockComment = false
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]
    if (lineComment) { if (char === '\n') lineComment = false; continue }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; index += 1 }; continue }
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if ((char === '"' || char === "'" || char === '`')) { quote = char; continue }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  throw new Error('Composition rules object was incomplete.')
}

export async function loadCompositionRules(force = false): Promise<CompositionRuleCatalog> {
  if (!force && compositionRuleCache) return compositionRuleCache
  const suffix = force ? `?olddex-refresh=${Date.now()}` : ''
  const response = await fetchWithTimeout(`${RULES_SOURCE}${suffix}`, { cache: force ? 'reload' : 'default', source: 'composition-rules' })
  const source = await response.text()
  const literal = extractExportedObject(source, 'export const rules')
  compositionRuleCache = parseCompositionRuleCatalog(parseDataLiteral(literal))
  return compositionRuleCache
}
