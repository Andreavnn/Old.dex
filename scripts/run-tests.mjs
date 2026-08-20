import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

rmSync('.test-dist', { recursive: true, force: true })
run(process.platform === 'win32' ? 'tsc.cmd' : 'tsc', ['-p', 'tsconfig.test.json'])
writeFileSync('.test-dist/package.json', '{"type":"commonjs"}\n')

const compiledTests = readdirSync(join('.test-dist', 'tests'))
  .filter((name) => name.endsWith('.test.js'))
  .map((name) => join('.test-dist', 'tests', name))
const sourceTests = readdirSync('tests')
  .filter((name) => name.endsWith('.test.mjs'))
  .map((name) => join('tests', name))
run(process.execPath, ['--test', ...compiledTests, ...sourceTests])
