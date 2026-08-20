import { RULE_PROXY_PREFIX, RULE_REPOSITORY_ROOT, normalizeRepositoryPath } from '../data/ruleRepository'
import type { RuleDocument, RuleIndexGroup } from '../domain/ruleTypes'
import { parseRuleDocument } from '../domain/schemas'
import { fetchWithTimeout } from './http'
import { readJson, writeJson, storageKeys, removeStorage } from './storage'
import { reportAppError } from './appErrors'
import {
  extractRepositoryVersion,
  isHiddenRepositoryPath,
  parseRuleIndexHierarchy,
  readerMarkdownDocument,
  scrubHtml,
} from './ruleContentTransform'

export type { RuleDocument, RuleIndexEntry, RuleIndexGroup } from '../domain/ruleTypes'

const CACHE_PREFIX = 'olddex.rule-content.v15:'
const LEGACY_CACHE_PREFIXES = [
  'olddex.rule-content.v14:', 'olddex.rule-content.v13:', 'olddex.rule-content.v12:', 'olddex.rule-content.v11:',
  'olddex.rule-content.v10:', 'olddex.rule-content.v9:', 'olddex.rule-content.v8:', 'olddex.rule-content.v7:',
  'olddex.rule-content.v6:', 'olddex.rule-content.v5:', 'olddex.rule-content.v4:', 'olddex.rule-content.v3:',
  'olddex.rule-content.v2:', 'olddex.rule-content.v1:',
]
const MAX_CACHE_AGE_MS = 12 * 60 * 60 * 1000

function cacheKey(path: string) {
  return `${CACHE_PREFIX}${path}`
}

function readCache(path: string): RuleDocument | null {
  const parsed = readJson(cacheKey(path), parseRuleDocument, null)
  if (!parsed?.fetchedAt || Date.now() - new Date(parsed.fetchedAt).getTime() > MAX_CACHE_AGE_MS) return null
  return parsed
}

function writeCache(document: RuleDocument) {
  return writeJson(cacheKey(document.sourcePath), document)
}

async function fetchViaProxy(sourcePath: string, force: boolean) {
  const response = await fetchWithTimeout(`${RULE_PROXY_PREFIX}${sourcePath}`, {
    source: `rules-proxy:${sourcePath}`,
    cache: force ? 'reload' : 'default',
    headers: { Accept: 'text/html' },
  })
  const document = scrubHtml(await response.text(), sourcePath)
  document.transport = 'proxy'
  return document
}

async function fetchDirect(sourcePath: string, force: boolean) {
  const response = await fetchWithTimeout(`${RULE_REPOSITORY_ROOT}${sourcePath}`, {
    source: `rules-direct:${sourcePath}`,
    cache: force ? 'reload' : 'default',
    headers: { Accept: 'text/html' },
  })
  const document = scrubHtml(await response.text(), sourcePath)
  document.transport = 'direct'
  return document
}

async function fetchViaReader(sourcePath: string, force: boolean) {
  const sourceUrl = `${RULE_REPOSITORY_ROOT}${sourcePath}`
  const response = await fetchWithTimeout(`https://r.jina.ai/${sourceUrl}`, {
    source: `rules-reader:${sourcePath}`,
    cache: 'no-store',
    headers: force ? { Accept: 'text/plain', 'X-No-Cache': 'true' } : { Accept: 'text/plain' },
  })
  return readerMarkdownDocument(await response.text(), sourcePath)
}

export async function fetchRuleDocument(rawPath: string, force = false): Promise<RuleDocument> {
  const sourcePath = normalizeRepositoryPath(rawPath) || rawPath
  if (!sourcePath.startsWith('/') || sourcePath.startsWith('//')) throw new Error('Invalid rules path.')
  if (isHiddenRepositoryPath(sourcePath)) throw new Error('This duplicate rules page is not exposed by Old.dex.')

  if (!force) {
    const cached = readCache(sourcePath)
    if (cached) return cached
  }

  const attempts: Array<() => Promise<RuleDocument>> = []
  if (typeof window !== 'undefined' && window.location.protocol !== 'file:') attempts.push(() => fetchViaProxy(sourcePath, force))
  attempts.push(() => fetchDirect(sourcePath, force))
  attempts.push(() => fetchViaReader(sourcePath, force))

  let lastError: unknown
  for (const attempt of attempts) {
    try {
      const document = await attempt()
      writeCache(document)
      return document
    } catch (error) {
      lastError = reportAppError(error, 'RULE_TRANSPORT_FAILED', { sourcePath })
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to load rule content.')
}

export async function fetchRuleIndexHierarchy(force = false): Promise<RuleIndexGroup[]> {
  const document = await fetchRuleDocument('/', force)
  return parseRuleIndexHierarchy(document.html)
}

async function fetchRawVersionFromPath(sourcePath: string, force: boolean) {
  const attempts: Array<() => Promise<string>> = []

  if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
    attempts.push(async () => {
      const response = await fetchWithTimeout(`${RULE_PROXY_PREFIX}${sourcePath}`, {
        source: `rules-version-proxy:${sourcePath}`,
        cache: force ? 'reload' : 'default',
        headers: { Accept: 'text/html' },
      })
      return response.text()
    })
  }

  attempts.push(async () => {
    const response = await fetchWithTimeout(`${RULE_REPOSITORY_ROOT}${sourcePath}`, {
      source: `rules-version-direct:${sourcePath}`,
      cache: force ? 'reload' : 'default',
      headers: { Accept: 'text/html' },
    })
    return response.text()
  })

  attempts.push(async () => {
    const response = await fetchWithTimeout(`https://r.jina.ai/${RULE_REPOSITORY_ROOT}${sourcePath}`, {
      source: `rules-version-reader:${sourcePath}`,
      cache: 'no-store',
      headers: force ? { Accept: 'text/plain', 'X-No-Cache': 'true' } : { Accept: 'text/plain' },
    })
    return response.text()
  })

  for (const attempt of attempts) {
    try {
      const version = extractRepositoryVersion(await attempt())
      if (version) return version
    } catch (error) {
      reportAppError(error, 'RULE_VERSION_TRANSPORT_FAILED', { sourcePath })
    }
  }
  return null
}

export async function fetchRuleRepositoryVersion(force = false) {
  for (const sourcePath of ['/faq', '/errata']) {
    const version = await fetchRawVersionFromPath(sourcePath, force)
    if (version) return version
  }

  for (const sourcePath of ['/faq', '/errata']) {
    const cached = readCache(sourcePath)
    if (cached?.version) return cached.version
  }
  return null
}

export function clearRuleContentCache() {
  storageKeys()
    .filter((key) => key.startsWith(CACHE_PREFIX) || LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
    .forEach(removeStorage)
}

export async function forceRefreshRulePages(paths: string[], onProgress?: (completed: number, total: number) => void) {
  clearRuleContentCache()
  const uniquePaths = [...new Set(paths.map((path) => normalizeRepositoryPath(path) || path))]
  let cursor = 0
  let completed = 0
  let failed = 0
  const workerCount = Math.min(4, Math.max(1, uniquePaths.length))

  async function worker() {
    while (cursor < uniquePaths.length) {
      const index = cursor
      cursor += 1
      try {
        await fetchRuleDocument(uniquePaths[index], true)
      } catch (error) {
        failed += 1
        reportAppError(error, 'RULE_PAGE_REFRESH_FAILED', { sourcePath: uniquePaths[index] })
      } finally {
        completed += 1
        onProgress?.(completed, uniquePaths.length)
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return { refreshed: uniquePaths.length - failed, failed, total: uniquePaths.length, refreshedAt: new Date().toISOString() }
}
