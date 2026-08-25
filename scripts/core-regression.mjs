import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const semantics = await import(pathToFileURL(resolve(root, 'src/core/sourceSemantics.ts')).href)
const profile = await import(pathToFileURL(resolve(root, 'src/core/profileMath.ts')).href)
const timing = await import(pathToFileURL(resolve(root, 'src/core/matchTiming.ts')).href)

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('Shield is canonical shield equipment', () => assert.equal(semantics.canonicalSelectionKind('Shield', 'options'), 'shield'))
test('Shield is never a weapon semantic name', () => assert.equal(semantics.isWeaponSemanticName('Shield'), false))
test('Shield remains shield even in OWB equipment section', () => assert.equal(semantics.canonicalSelectionKind('Shield', 'equipment'), 'shield'))
test('Full plate armour is armour', () => assert.equal(semantics.canonicalSelectionKind('Full plate armour', 'armor'), 'armour'))
test('Great weapon remains a weapon', () => assert.equal(semantics.canonicalSelectionKind('Great weapon', 'equipment'), 'weapon'))
test('Additional hand weapon remains a weapon', () => assert.equal(semantics.canonicalSelectionKind('Additional hand weapon', 'equipment'), 'weapon'))
test('Cavalry spear remains a weapon', () => assert.equal(semantics.canonicalSelectionKind('Cavalry spear', 'equipment'), 'weapon'))
test('Compound weapon/shield descriptor is partitioned', () => {
  const row = semantics.partitionDescriptorParts(['Hand weapon', 'Shield'], 'options')
  assert.deepEqual(row.weaponParts, ['Hand weapon'])
  assert.deepEqual(row.nonWeaponParts, ['Shield'])
})
test('Black Orc Bigboss Full Plate + Shield resolves to 3+', () => assert.equal(profile.resolveArmourSave('—', '4+', [1]), '3+'))
test('Armour replacement is applied before multiple modifiers', () => assert.equal(profile.resolveArmourSave('6+', '4+', [1, 1]), '2+'))
test('Armour saves cannot improve past 2+', () => assert.equal(profile.resolveArmourSave('2+', undefined, [3]), '2+'))
test('No save modifier preserves replacement armour', () => assert.equal(profile.resolveArmourSave('6+', '4+', []), '4+'))

test('Rallying Cry resolves at Command, not Rally', () => {
  const rows = timing.analyzeMatchRuleTiming('Rallying Cry', 'During the Command sub-phase, this character may make a Leadership test. If passed, a fleeing unit may immediately make a Rally test.')
  assert.deepEqual([...new Set(rows.map((row) => row.step))], ['command'])
})
test('Impetuous is a Required Charge Test provider', () => {
  const rows = timing.analyzeMatchRuleTiming('Impetuous', 'During the Declare Charges & Charge Reactions sub-phase, this unit must make a Leadership test. If this test is failed, it must declare a charge if possible.')
  assert.ok(rows.some((row) => row.step === 'required-charges' && row.intent === 'required-charge-test'))
})
test('Required-charge modifier does not create a second semantic phase', () => {
  const rows = timing.analyzeMatchRuleTiming('Quell Impetuosity', 'During the Required Charge Tests step, friendly units within 6 inches may re-roll an Impetuous test.')
  assert.ok(rows.some((row) => row.step === 'required-charges'))
  assert.equal(rows.some((row) => row.step === 'declare-charges'), false)
})
test('Passive duration reference to Shooting creates no Shooting task', () => {
  const rows = timing.analyzeMatchRuleTiming('Example', 'This bonus lasts until the beginning of the Shooting phase.')
  assert.equal(rows.length, 0)
})
test('Conveyance routes to Remaining Moves', () => assert.ok(timing.analyzeMatchRuleTiming('Spell', 'This is a Conveyance spell.').some((row) => row.step === 'remaining-moves')))
test('Assailment routes to Fight', () => assert.ok(timing.analyzeMatchRuleTiming('Spell', 'This is an Assailment spell.').some((row) => row.step === 'fight')))
test('Magic Missile routes to Special Shooting', () => assert.ok(timing.analyzeMatchRuleTiming('Spell', 'This is a Magic Missile.').some((row) => row.step === 'special-shooting')))
test('Ambushers is recognized as a deployment rule', () => assert.ok(timing.analyzeMatchRuleTiming('Ambushers', 'This unit may be held in reserve.').some((row) => row.step === 'deploy-armies')))
test('Close Order is recognized as a formation rule', () => assert.equal(timing.isFormationRuleName('Close Order'), true))

test('No versioned runtime stylesheets remain', () => {
  for (const name of ['styles-v033.css','styles-v034.css','styles-v035.css','styles-v036.css','styles-v037.css','styles-v038.css']) assert.equal(existsSync(resolve(root, 'src', name)), false)
})
test('Obsolete versioned match guidance services are removed', () => {
  assert.equal(existsSync(resolve(root, 'src/services/gameTurnGuidanceV033.ts')), false)
  assert.equal(existsSync(resolve(root, 'src/services/gameTurnGuidanceV034.ts')), false)
})
test('gameSetup no longer owns turn guidance', () => assert.equal(/loadTurnStepGuidance|loadStartOfRoundGuidance|loadFriendlyDeploymentGuidance/.test(readFileSync(resolve(root, 'src/services/gameSetup.ts'), 'utf8')), false))
test('OWB rule paths cannot classify weapons', () => {
  const source = readFileSync(resolve(root, 'src/data/liveBuilderUnits.ts'), 'utf8')
  assert.equal(/path\.startsWith\(['"]\/weapons-of-war\//.test(source), false)
  assert.ok(source.includes('partitionDescriptorParts'))
})
test('Profile compatibility facade delegates to canonical core', () => assert.ok(readFileSync(resolve(root, 'src/domain/profileEffects.ts'), 'utf8').includes("export * from '../core/profileEngine'")))

after: {
  let passed = 0
  for (const [name, fn] of tests) {
    try { await fn(); passed += 1 }
    catch (error) { console.error(`FAIL: ${name}`); throw error }
  }
  console.log(`ODX core regressions passed: ${passed}/${tests.length}`)
}
