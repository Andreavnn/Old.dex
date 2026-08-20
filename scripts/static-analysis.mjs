import { readFileSync, readdirSync, statSync } from 'node:fs'
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

// Preview verification runs after `build:review`. Static analysis inspects the
// canonical source and the generator contract, never a checked-in preview artifact.
const previewBuilder = readFileSync(join(root, 'scripts/inline-preview.mjs'), 'utf8')
if (!previewBuilder.includes('ODX-STANDALONE-PREVIEW')) failures.push('review builder must mark preview.html as a generated artifact')
if (!previewBuilder.includes('SOURCE-SHA256')) failures.push('review builder must fingerprint the canonical application source')

const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
const importantCount = (styles.match(/!important/g) || []).length
if (importantCount > 20) failures.push(`src/styles.css contains ${importantCount} !important declarations (limit 20)`)
const versionMarkers = (styles.match(/v0\.\d+/gi) || []).length
if (versionMarkers > 0) failures.push(`src/styles.css contains ${versionMarkers} version-specific markers (limit 0)`)

const loadout = readFileSync(join(root, 'src/domain/loadout.ts'), 'utf8')
if (/selectionModeFor(?:Weapon|Equipment)[\s\S]{0,220}stackable/.test(loadout)) failures.push('selection mode still falls back to legacy stackable state')
if (!/isShieldName\(option\.name\)[\s\S]{0,80}unit-toggle/.test(loadout)) failures.push('Shield unit-toggle invariant is missing')

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
