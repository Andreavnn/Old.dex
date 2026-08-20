import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applicationSourceFingerprint } from './source-fingerprint.mjs'

const root = process.cwd()
const distDir = join(root, 'dist-review')
const entryPath = join(distDir, 'index.html')
const outputPath = join(root, 'preview.html')

if (!existsSync(entryPath)) {
  throw new Error('dist-review/index.html is missing. Run the Vite review build first.')
}

let html = readFileSync(entryPath, 'utf8')

function localAssetPath(reference) {
  const clean = reference.replace(/^\.\//, '').replace(/^\//, '')
  const path = resolve(distDir, clean)
  if (!path.startsWith(resolve(distDir))) throw new Error(`Unsafe asset path: ${reference}`)
  return path
}

html = html.replace(/<link\b([^>]*?)href=["']([^"']+\.css)["']([^>]*)>/gi, (full, before, href) => {
  if (/^(?:https?:|data:)/i.test(href)) return full
  const cssPath = localAssetPath(href)
  if (!existsSync(cssPath)) throw new Error(`Review CSS asset missing: ${href}`)
  return `<style data-odx-inlined-from="${href}">\n${readFileSync(cssPath, 'utf8')}\n</style>`
})

html = html.replace(/<script\b([^>]*?)src=["']([^"']+\.js)["']([^>]*)><\/script>/gi, (full, before, src) => {
  if (/^(?:https?:|data:)/i.test(src)) return full
  const jsPath = localAssetPath(src)
  if (!existsSync(jsPath)) throw new Error(`Review JavaScript asset missing: ${src}`)
  const attrs = `${before} `.includes('type=') ? before : `${before} type="module"`
  return `<script${attrs} data-odx-inlined-from="${src}">\n${readFileSync(jsPath, 'utf8')}\n</script>`
})

const remainingLocalRuntimeRefs = [
  ...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["'](?!https?:|data:|#)([^"']+)["']/gi),
].map((match) => match[1])
if (remainingLocalRuntimeRefs.length) {
  throw new Error(`Standalone review still contains local runtime references: ${remainingLocalRuntimeRefs.join(', ')}`)
}

const fingerprint = applicationSourceFingerprint()
const marker = `<!-- ODX-STANDALONE-PREVIEW | GENERATED-ARTIFACT | SOURCE-SHA256:${fingerprint} | DO-NOT-EDIT -->`
html = html.replace(/<!doctype html>/i, `<!doctype html>\n${marker}`)
html = html.replace(/<title>.*?<\/title>/is, '<title>Old.dex GUI v0.52 Standalone Review Preview</title>')
writeFileSync(outputPath, html)
process.stdout.write(`Standalone review preview written to preview.html (${fingerprint.slice(0, 12)}…).\n`)
