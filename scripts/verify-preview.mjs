import { readFileSync, statSync } from 'node:fs'
import { applicationSourceFingerprint } from './source-fingerprint.mjs'

const preview = readFileSync('preview.html', 'utf8')
const failures = []
const fingerprint = applicationSourceFingerprint()

if (!preview.includes('ODX-STANDALONE-PREVIEW')) failures.push('preview.html is missing the generated-artifact marker')
if (!preview.includes(`SOURCE-SHA256:${fingerprint}`)) failures.push('preview.html source fingerprint does not match the packaged application source')
if (/src=["']\/?src\/main\.ts["']/i.test(preview)) failures.push('preview.html still depends on raw TypeScript/Vue source')
if (/<script\b[^>]*src=["'](?!https?:|data:)[^"']+["']/i.test(preview)) failures.push('preview.html contains a local external script dependency')
if (/<link\b[^>]*href=["'](?!https?:|data:|#)[^"']+["']/i.test(preview)) failures.push('preview.html contains a local external link dependency')
if (statSync('preview.html').size < 25_000) failures.push('preview.html is unexpectedly small for a standalone application snapshot')

const sourceText = [
  readFileSync('src/main.ts', 'utf8'),
  readFileSync('src/App.vue', 'utf8'),
].join('\n')
if (/preview\.html/i.test(sourceText)) failures.push('application source must not depend on the generated preview artifact')

if (failures.length) {
  for (const failure of failures) process.stderr.write(`FAIL: ${failure}\n`)
  process.exit(1)
}
process.stdout.write('Standalone review preview contract passed.\n')
