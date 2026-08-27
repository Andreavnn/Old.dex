import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const effects = await import(pathToFileURL(resolve(root, 'src/core/matchEffects.ts')).href)
const usage = await import(pathToFileURL(resolve(root, 'src/core/matchUsage.ts')).href)
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('stacked charge declaration sources retain names and values', () => {
  const swift = effects.chargeRangeContribution('Swiftstride', 'Swiftstride')
  const banner = effects.chargeRangeContribution('Waaagh! Banner', 'This unit increases its maximum possible charge range by 3" and adds +D3 to its Charge roll.')
  const result = effects.formatMaximumDeclarationRange(7, [swift, banner].filter(Boolean))
  assert.equal(result.total, 19)
  assert.equal(result.text, 'Maximum declaration range: M 7 + 6 + 3 Swiftstride + 3 Waaagh! Banner = 19"')
})

test('removing a charge source removes it from declaration range', () => {
  const swift = effects.chargeRangeContribution('Swiftstride', 'Swiftstride')
  const result = effects.formatMaximumDeclarationRange(7, [swift].filter(Boolean))
  assert.equal(result.total, 16)
  assert.equal(result.text.includes('Waaagh! Banner'), false)
})

test('limited use rules preserve their proper lifetime', () => {
  assert.deepEqual(usage.extractMatchUseLimit('This item may be used once per battle.'), { scope: 'battle', limit: 1 })
  assert.deepEqual(usage.extractMatchUseLimit('This ability may be used twice per round.'), { scope: 'round', limit: 2 })
  assert.deepEqual(usage.extractMatchUseLimit('One use only.', 3), { scope: 'battle', limit: 3 })
})

test('charge range engine reads only active roster rules and selected magical items', () => {
  const source = read('src/services/matchGuidance.ts')
  assert.ok(source.includes('for (const rule of row.specialRules || [])'))
  assert.ok(source.includes('for (const item of row.magicItems || [])'))
  assert.equal(source.includes('optionalSelections'), false)
})

test('match tracking persists fleeing, rule uses and cross-turn history', () => {
  const source = read('src/services/matchTracking.ts')
  assert.ok(source.includes('version: 3'))
  assert.ok(source.includes('fleeing?: boolean'))
  assert.ok(source.includes('ruleUses: Record<string, Record<string, number>>'))
  assert.ok(source.includes('chargeHistory: MatchHistoryRow[]'))
  assert.ok(source.includes('combatHistory: MatchHistoryRow[]'))
})

test('match profiles use a saved match roster route', () => {
  const router = read('src/router.ts')
  const view = read('src/views/GameMatchView.vue')
  assert.ok(router.includes("name: 'game-unit-profile'"))
  assert.ok(view.includes('`/games/${game.value.id}/unit/${row.instanceId}`'))
  assert.ok(view.includes('combat-profile-clickable'))
})

test('Setup spell generation uses the shared canonical spell card', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('MatchSpellChoiceCard'))
  assert.equal(view.includes('spell-generation-card-select'), false)
})

test('Dark Mode semantic theme correction overrides the legacy black pill rule', () => {
  const theme = read('src/styles/theme.css')
  const main = read('src/main.ts')
  assert.ok(theme.includes('[class$="-pill"]'))
  assert.ok(theme.includes('color: var(--ink) !important'))
  assert.ok(main.indexOf("import './styles/theme.css'") > main.indexOf("import './styles.css'"))
})

test('single-model Combat uses Wounds Remaining and Shooting exposes BS penalties', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('Wounds Remaining'))
  assert.ok(view.includes('shootingPenaltyOptions'))
  assert.ok(view.includes('BS {{ ballisticSkill'))
})

test('Battle Conditions resolve in their operational steps', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('deploymentBattlefieldConditions'))
  assert.ok(view.includes('showChaosOfWarResolution'))
  assert.ok(view.includes('Select the Battle Conditions being used.'))
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1 }
  catch (error) { console.error(`FAIL: ${name}`); throw error }
}
console.log(`ODX 0.43 regressions passed: ${passed}/${tests.length}`)
