import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const includedRoots = ['src']
const includedFiles = [
  'index.html',
  'package.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'vite.config.ts',
  'vite.review.config.ts',
]

function walk(dir) {
  const rows = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) rows.push(...walk(path))
    else rows.push(path)
  }
  return rows
}

export function applicationSourceFingerprint() {
  const paths = []
  for (const dir of includedRoots) paths.push(...walk(join(root, dir)))
  for (const file of includedFiles) {
    const path = join(root, file)
    try { if (statSync(path).isFile()) paths.push(path) } catch { /* optional */ }
  }
  paths.sort((a, b) => a.localeCompare(b))

  const hash = createHash('sha256')
  for (const path of paths) {
    const rel = relative(root, path).replaceAll('\\', '/')
    hash.update(rel)
    hash.update('\0')
    hash.update(readFileSync(path))
    hash.update('\0')
  }
  return hash.digest('hex')
}
