// Live source used by the Old.dex repository reader.
export const RULE_REPOSITORY_ROOT = 'https://tow.whfb.app'
export const RULE_PROXY_PREFIX = '/tow-source'

function cleanSourcePath(sourcePath: string) {
  if (!sourcePath) return '/'
  const path = sourcePath.startsWith('/') ? sourcePath : `/${sourcePath}`
  return path.replace(/\/+/g, '/')
}

const armyRouteOverrides: Record<string, string> = {
  'renegade-crowns': 'realms-of-men',
}

export function armySourcePath(armySlug: string) {
  return `/army/${armyRouteOverrides[armySlug] || armySlug}`
}

export function ruleReaderPath(sourcePath: string) {
  return `/rules/read${cleanSourcePath(sourcePath)}`
}

export function ruleIndexGroupPath(kind: 'advanced' | 'scenarios', sourcePath: string) {
  const clean = cleanSourcePath(sourcePath).replace(/^\//, '')
  return `/rules/index/${kind}/${clean}`
}

export function normalizeRepositoryPath(value: string) {
  try {
    const url = new URL(value, RULE_REPOSITORY_ROOT)
    if (url.origin !== RULE_REPOSITORY_ROOT) return null
    return cleanSourcePath(url.pathname)
  } catch {
    return null
  }
}
