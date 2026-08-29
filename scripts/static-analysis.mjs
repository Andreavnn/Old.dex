import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')

const root = process.cwd()
const failures = []
const warnings = []

function filesUnder(dir) {
  const rows = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) rows.push(...filesUnder(path))
    else rows.push(path)
  }
  return rows
}

const sourceFiles = filesUnder(join(root, 'src')).filter((path) => /\.(ts|tsx|vue|css)$/.test(path))
for (const path of sourceFiles) {
  const rel = relative(root, path).replaceAll('\\', '/')
  const source = readFileSync(path, 'utf8')
  if (/\.(ts|tsx)$/.test(path) || path.endsWith('.vue')) {
    const script = path.endsWith('.vue') ? (source.match(/<script(?:\s+setup)?(?:\s+lang="ts")?[^>]*>([\s\S]*?)<\/script>/)?.[1] || '') : source
    if (script) {
      const file = ts.createSourceFile(rel, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      for (const diagnostic of file.parseDiagnostics) failures.push(`${rel}: TypeScript parse error: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`)
    }
  }
  if (rel !== 'src/services/http.ts' && /\bfetch\s*\(/.test(source)) failures.push(`${rel}: direct fetch() bypasses services/http.ts`)
  if (rel !== 'src/services/storage.ts' && /\blocalStorage\b/.test(source)) failures.push(`${rel}: direct localStorage access bypasses services/storage.ts`)
  if (/\b(?:eval|Function)\s*\(/.test(source)) failures.push(`${rel}: executable dynamic-code API is forbidden`)
}

const styleFiles = sourceFiles.filter((path) => path.endsWith('.css'))
const styleText = styleFiles.map((path) => readFileSync(path, 'utf8')).join('\n')
const importantCount = (styleText.match(/!important/g) || []).length
if (importantCount > 150) failures.push(`runtime CSS contains ${importantCount} !important declarations (hard limit 150)`); else if (importantCount > 100) warnings.push(`runtime CSS contains ${importantCount} legacy !important declarations; continue consolidating specificity during maintenance passes`)
const versionMarkers = (styleText.match(/v0\.\d+/gi) || []).length
if (versionMarkers > 0) failures.push(`runtime CSS contains ${versionMarkers} version-specific v0.x markers (limit 0)`)
if (styleFiles.length !== 1 || !styleFiles[0].endsWith('/src/styles.css')) failures.push(`runtime styles must remain consolidated in src/styles.css (found ${styleFiles.length} CSS files)`)

const obsoleteFiles = [
  'scripts/inline-preview.mjs',
  'scripts/verify-preview.mjs',
  'scripts/source-fingerprint.mjs',
  'src/components/BootAudioSetting.vue',
  'src/components/SegmentTabs.vue',
  'src/views/ArmyView.vue',
  'src/data/changelogLatest.ts',
]
for (const rel of obsoleteFiles) if (existsSync(join(root, rel))) failures.push(`obsolete/dead file remains: ${rel}`)
if (!existsSync(join(root, '.gitignore'))) failures.push('repository .gitignore is missing')

// Service-worker precache paths must map to real public assets. A missing entry
// can abort installation or cache the SPA shell under the wrong content type.
const sw = readFileSync(join(root, 'public/sw.js'), 'utf8')
const coreLiteral = sw.match(/const CORE = \[([\s\S]*?)\]/)?.[1] || ''
for (const match of coreLiteral.matchAll(/['"](\/[^'"]+)['"]/g)) {
  const path = match[1]
  if (path === '/') continue
  if (!existsSync(join(root, 'public', path.replace(/^\//, '')))) failures.push(`service worker precaches missing public asset: ${path}`)
}

const loadout = readFileSync(join(root, 'src/domain/loadout.ts'), 'utf8')
if (/selectionModeFor(?:Weapon|Equipment)[\s\S]{0,220}stackable/.test(loadout)) failures.push('selection mode still falls back to legacy stackable state')
if (!loadout.includes('isShieldSemanticName')) failures.push('loadout must delegate Shield identity to core/sourceSemantics')
const semantics = readFileSync(join(root, 'src/core/sourceSemantics.ts'), 'utf8')
if (!semantics.includes("return 'shield'")) failures.push('canonical Shield semantic invariant is missing')
const profileFacade = readFileSync(join(root, 'src/domain/profileEffects.ts'), 'utf8')
if (!profileFacade.includes("export * from '../core/profileEngine'")) failures.push('domain/profileEffects must be a compatibility facade over the canonical profile engine')
const matchGuidanceFacade = readFileSync(join(root, 'src/services/matchGuidance.ts'), 'utf8')
if (matchGuidanceFacade.split(/\r?\n/).filter(Boolean).length > 12 || /fetchRuleDocument|chargeRangeContribution|extractMatchUseLimit/.test(matchGuidanceFacade)) failures.push('services/matchGuidance must remain a thin compatibility facade over matchIntelligence')
const matchRosterFacade = readFileSync(join(root, 'src/services/matchRosterProfiles.ts'), 'utf8')
if (matchRosterFacade.split(/\r?\n/).filter(Boolean).length > 6 || /loadMagicItemReference|persistentModelCharacteristicModifiers|resolveArmourSave/.test(matchRosterFacade)) failures.push('services/matchRosterProfiles must remain a thin compatibility facade over matchUnitProfiles')
const forbiddenRuntimeFiles = ['gameTurnGuidanceV033.ts','gameTurnGuidanceV034.ts','gameLocksV034.ts','matchTrackingV036.ts','matchUnitProfilesV036.ts','magicItemReferenceV038.ts']
for (const name of forbiddenRuntimeFiles) if (sourceFiles.some((path) => path.endsWith(`/services/${name}`))) failures.push(`obsolete versioned runtime service remains: ${name}`)
if (sourceFiles.some((path) => /styles-v\d+\.css$/.test(path))) failures.push('version-suffixed runtime stylesheet remains')

// Relative dependency graph: every local import must resolve and the combined
// type/runtime source graph must remain acyclic. Shared DTOs belong in domain modules.
const codeFiles = sourceFiles.filter((path) => /\.(ts|tsx|vue)$/.test(path))
const codeSet = new Set(codeFiles.map((path) => path.replaceAll('\\', '/')))
const graph = new Map(codeFiles.map((path) => [path.replaceAll('\\', '/'), []]))
function resolveRelative(fromPath, specifier) {
  const base = join(fromPath.slice(0, fromPath.lastIndexOf('/')), specifier).replaceAll('\\', '/')
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.vue`, `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.vue`]
  const code = candidates.find((candidate) => codeSet.has(candidate))
  if (code) return code
  try { if (statSync(base).isFile()) return '__asset__' } catch { /* unresolved below */ }
  return null
}
for (const path of codeFiles) {
  const normalizedPath = path.replaceAll('\\', '/')
  const source = readFileSync(path, 'utf8')
  const script = path.endsWith('.vue') ? (source.match(/<script(?:\s+setup)?(?:\s+lang="ts")?[^>]*>([\s\S]*?)<\/script>/)?.[1] || '') : source
  const importRe = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"](\.[^'"]+)['"]/g
  for (const match of script.matchAll(importRe)) {
    const resolved = resolveRelative(normalizedPath, match[1])
    if (!resolved) failures.push(`${relative(root, path).replaceAll('\\', '/')}: unresolved relative import ${match[1]}`)
    else if (resolved !== '__asset__') graph.get(normalizedPath).push(resolved)
  }
}
const state = new Map()
const stack = []
function visit(node) {
  const status = state.get(node) || 0
  if (status === 1) {
    const start = stack.indexOf(node)
    const cycle = [...stack.slice(start), node].map((path) => relative(root, path).replaceAll('\\', '/')).join(' -> ')
    failures.push(`dependency cycle: ${cycle}`)
    return
  }
  if (status === 2) return
  state.set(node, 1); stack.push(node)
  for (const dependency of graph.get(node) || []) visit(dependency)
  stack.pop(); state.set(node, 2)
}
for (const node of graph.keys()) visit(node)

if (warnings.length) warnings.forEach((row) => process.stderr.write(`WARN: ${row}\n`))
if (failures.length) {
  failures.forEach((row) => process.stderr.write(`FAIL: ${row}\n`))
  process.exit(1)
}
process.stdout.write(`ODX static analysis passed: ${sourceFiles.length} source files checked; ${importantCount} !important declarations; ${versionMarkers} style version markers.\n`)
