import { parseDataLiteral } from '../domain/dataLiteral'
import { fetchWithTimeout } from './http'
import { reportAppError } from './appErrors'

const OWB_ROOT = 'https://raw.githubusercontent.com/nthiebes/old-world-builder/refs/heads/main'
const RULE_INDEX_URL = `${OWB_ROOT}/src/components/rules-index/rules-index-export.json`
const RULE_MAP_URL = `${OWB_ROOT}/src/components/rules-index/rules-map.js`
const BUNDLED_CATALOG_URL = '/data/owb-rule-catalog-v038.json'

export type OwbRuleIndexStat = Record<string, string | number | null | undefined> & { Name?: string }
export type OwbRuleIndexEntry = {
  url?: string
  page?: string
  stats?: OwbRuleIndexStat[]
  troopType?: string
  [key: string]: unknown
}
export type OwbRuleCatalog = {
  rules: Record<string, OwbRuleIndexEntry>
  synonyms: Record<string, string>
}

let catalogCache: OwbRuleCatalog | null = null
const STORAGE_KEY = 'olddex.owb-rule-catalog.v3'
const STORAGE_TTL_MS = 12 * 60 * 60 * 1000

type PersistedCatalog = { savedAt: number; catalog: OwbRuleCatalog }
type BundledCatalog = OwbRuleCatalog & { generatedFrom?: string }

async function loadBundledCatalog() {
  try {
    const response = await fetchWithTimeout(BUNDLED_CATALOG_URL, { cache: 'default', source: 'owb-rule-index-bundled', retries: 0 })
    const value = await response.json() as BundledCatalog
    if (!value?.rules || !value.synonyms || Object.keys(value.rules).length < 500) return null
    return { rules: value.rules, synonyms: value.synonyms } satisfies OwbRuleCatalog
  } catch {
    return null
  }
}

function readPersistedCatalog(allowStale = false) {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as PersistedCatalog | null
    if (!parsed?.catalog?.rules || !parsed.catalog.synonyms || !Number.isFinite(parsed.savedAt)) return null
    if (!allowStale && Date.now() - parsed.savedAt > STORAGE_TTL_MS) return null
    return parsed.catalog
  } catch { return null }
}

function persistCatalog(catalog: OwbRuleCatalog) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), catalog })) } catch { /* storage is an optional resilience cache */ }
}

/** Exact name normalizer used by Old World Builder's rules index. */
export function normalizeOwbRuleName(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/ *\([^)]*\) */g, '')
    .replace(/\{/g, '')
    .replace(/\}/g, '')
    .replace(/\*/g, '')
    .replace(/\[/g, '')
    .replace(/\]/g, '')
    .replace(/^[0-9]x /g, '')
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .trim()
}

function extractObjectLiteral(source: string, marker: string) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) throw new Error(`Old World Builder mapping '${marker}' was not found.`)
  const start = source.indexOf('{', markerIndex + marker.length)
  if (start < 0) throw new Error(`Old World Builder mapping '${marker}' could not be parsed.`)
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
    if (char === '"' || char === "'" || char === '`') { quote = char; continue }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  throw new Error(`Old World Builder mapping '${marker}' was incomplete.`)
}

function asRuleMap(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, OwbRuleIndexEntry>
  return value as Record<string, OwbRuleIndexEntry>
}
function asSynonyms(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, string>
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((row): row is [string, string] => typeof row[1] === 'string'))
}

export async function loadOwbRuleCatalog(force = false): Promise<OwbRuleCatalog> {
  if (!force && catalogCache) return catalogCache
  if (!force) {
    const persisted = readPersistedCatalog(false)
    if (persisted) { catalogCache = persisted; return persisted }
  }

  // Old.dex ships the current OWB rule index with the application so its core
  // name-to-rule resolver remains available even when raw.githubusercontent.com
  // is unavailable. A live OWB refresh still wins when it succeeds.
  const bundled = await loadBundledCatalog()
  const refresh = force ? `?olddex-refresh=${Date.now()}` : ''
  try {
    const [indexResponse, mapResponse] = await Promise.all([
      fetchWithTimeout(`${RULE_INDEX_URL}${refresh}`, { cache: force ? 'reload' : 'default', source: 'owb-rule-index' }),
      fetchWithTimeout(`${RULE_MAP_URL}${refresh}`, { cache: force ? 'reload' : 'default', source: 'owb-rule-map' }),
    ])
    const exportedRules = asRuleMap(await indexResponse.json())
    const mapSource = await mapResponse.text()
    const additions = asRuleMap(parseDataLiteral(extractObjectLiteral(mapSource, 'const additionalOWBRules')))
    const synonyms = asSynonyms(parseDataLiteral(extractObjectLiteral(mapSource, 'export const synonyms')))
    if (Object.keys(exportedRules).length < 500 || Object.keys(synonyms).length < 20) throw new Error('Old World Builder rule index was incomplete.')
    catalogCache = { rules: { ...exportedRules, ...additions }, synonyms }
    persistCatalog(catalogCache)
    return catalogCache
  } catch (error) {
    reportAppError(error, 'OWB_RULE_INDEX_LOAD')
    if (catalogCache) return catalogCache
    const stale = readPersistedCatalog(true)
    if (stale) { catalogCache = stale; return stale }
    if (bundled) { catalogCache = bundled; persistCatalog(bundled); return bundled }
    return { rules: {}, synonyms: {} }
  }
}

export function clearOwbRuleCatalog() {
  catalogCache = null
  if (typeof window !== 'undefined') { try { window.localStorage.removeItem(STORAGE_KEY); window.localStorage.removeItem('olddex.owb-rule-catalog.v2'); window.localStorage.removeItem('olddex.owb-rule-catalog.v1') } catch { /* optional cache */ } }
}

function candidateNames(value: string) {
  const normalized = normalizeOwbRuleName(value)
  const rows = [normalized]
  // A small compatibility fallback for already-normalized Old.dex labels. The
  // authoritative aliasing remains OWB's own synonym table.
  const singular = normalized.replace(/\bweapons$/, 'weapon').replace(/\bspears$/, 'spear').replace(/\bbows$/, 'bow')
  if (singular !== normalized) rows.push(singular)
  return [...new Set(rows.filter(Boolean))]
}

export function resolveOwbRuleFromCatalog(catalog: OwbRuleCatalog, value: string) {
  for (const candidate of candidateNames(value)) {
    const synonym = catalog.synonyms[candidate]
    const key = synonym || candidate
    const entry = catalog.rules[key]
    if (entry) return { key, normalized: candidate, synonym, entry, path: entry.url ? `/${String(entry.url).replace(/^\/+/, '')}` : '' }
  }
  return null
}

export async function resolveOwbRule(value: string, force = false) {
  return resolveOwbRuleFromCatalog(await loadOwbRuleCatalog(force), value)
}

export function splitOwbSourceList(value: string, catalog?: OwbRuleCatalog) {
  const clean = String(value || '').trim()
  if (!clean) return []
  if (catalog && resolveOwbRuleFromCatalog(catalog, clean)) return [clean]

  // First split only at top-level separators. Then, when the OWB resolver is
  // available, greedily re-join adjacent pieces if OWB identifies the joined
  // phrase as one canonical entity. This is what keeps names such as
  // “Bigger, Choppier Axe” intact even when they appear inside a longer list.
  const parts: string[] = []
  const separators: string[] = []
  let current = ''
  let round = 0
  let square = 0
  let brace = 0
  const push = (separator = '') => {
    const row = current.trim()
    if (row) {
      parts.push(row)
      if (separator) separators.push(separator)
    }
    current = ''
  }
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index]
    if (char === '(') round += 1
    else if (char === ')') round = Math.max(0, round - 1)
    else if (char === '[') square += 1
    else if (char === ']') square = Math.max(0, square - 1)
    else if (char === '{') brace += 1
    else if (char === '}') brace = Math.max(0, brace - 1)
    if ((char === ',' || char === '+') && round === 0 && square === 0 && brace === 0) { push(char); continue }
    current += char
  }
  push()
  if (!catalog || parts.length < 2) return parts

  const rows: string[] = []
  let index = 0
  while (index < parts.length) {
    let matched = ''
    let matchedEnd = index
    // Longest match wins. Limiting the look-ahead keeps malformed source text
    // from turning a whole option paragraph into one expensive search.
    const maxEnd = Math.min(parts.length - 1, index + 5)
    for (let end = maxEnd; end > index; end -= 1) {
      let candidate = parts[index]
      for (let cursor = index; cursor < end; cursor += 1) {
        const separator = separators[cursor] === '+' ? ' + ' : ', '
        candidate += `${separator}${parts[cursor + 1]}`
      }
      if (resolveOwbRuleFromCatalog(catalog, candidate)) {
        matched = candidate
        matchedEnd = end
        break
      }
    }
    if (matched) {
      rows.push(matched)
      index = matchedEnd + 1
    } else {
      rows.push(parts[index])
      index += 1
    }
  }
  return rows
}

export function owbStatsRows(entry: OwbRuleIndexEntry | undefined) {
  return Array.isArray(entry?.stats) ? entry!.stats!.filter((row) => row && typeof row === 'object') : []
}
