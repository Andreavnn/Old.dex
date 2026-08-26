import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const semantics = await import(pathToFileURL(resolve(root, 'src/core/sourceSemantics.ts')).href)
const profile = await import(pathToFileURL(resolve(root, 'src/core/profileMath.ts')).href)
const timing = await import(pathToFileURL(resolve(root, 'src/core/matchTiming.ts')).href)
const visibility = await import(pathToFileURL(resolve(root, 'src/core/matchTurnVisibility.ts')).href)
const matchEffects = await import(pathToFileURL(resolve(root, 'src/core/matchEffects.ts')).href)
const breakTests = await import(pathToFileURL(resolve(root, 'src/core/breakTest.ts')).href)
const randomHappenings = await import(pathToFileURL(resolve(root, 'src/core/randomHappeningTable.ts')).href)

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('Shield is canonical shield equipment', () => assert.equal(semantics.canonicalSelectionKind('Shield', 'options'), 'shield'))
test('Shield is never a weapon semantic name', () => assert.equal(semantics.isWeaponSemanticName('Shield'), false))
test('Shield remains shield even in OWB equipment section', () => assert.equal(semantics.canonicalSelectionKind('Shield', 'equipment'), 'shield'))
test('Full plate armour is armour', () => assert.equal(semantics.canonicalSelectionKind('Full plate armour', 'armor'), 'armour'))
test('Great weapon remains a weapon', () => assert.equal(semantics.canonicalSelectionKind('Great weapon', 'equipment'), 'weapon'))
test('Additional hand weapon remains a weapon', () => assert.equal(semantics.canonicalSelectionKind('Additional hand weapon', 'equipment'), 'weapon'))
test('Cavalry spear remains a weapon', () => assert.equal(semantics.canonicalSelectionKind('Cavalry spear', 'equipment'), 'weapon'))
test('Longbow remains a ranged weapon semantic selection', () => assert.equal(semantics.canonicalSelectionKind('Longbow', 'equipment'), 'weapon'))
test('OWB Warbows remain missile weapon selections', () => { assert.equal(semantics.canonicalSelectionKind('Warbows', 'equipment'), 'weapon'); assert.equal(semantics.isMissileWeaponSemanticName('Warbows'), true) })
test('OWB Bolt thrower remains a missile weapon selection', () => { assert.equal(semantics.canonicalSelectionKind('Bolt thrower', 'equipment'), 'weapon'); assert.equal(semantics.isMissileWeaponSemanticName('Bolt thrower'), true) })
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
test('Combined Declare Charges & Charge Reactions wording does not flip own-turn Impetuous to enemy turn', () => {
  const rows = timing.analyzeMatchRuleTiming('Impetuous', 'If during the Declare Charges & Charge Reactions sub-phase of its turn this unit is able to declare a charge, it must make a Leadership test. If failed, it must declare a charge.')
  assert.ok(rows.some((row) => row.step === 'required-charges' && row.turn === 'own'))
  assert.equal(rows.some((row) => row.turn === 'enemy'), false)
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
test('Counter Charge is an enemy-turn charge reaction only', () => {
  const rows = timing.analyzeMatchRuleTiming('Counter Charge', 'When a unit with this special rule is charged, it may declare a Counter Charge charge reaction.')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].step, 'declare-charges')
  assert.equal(rows[0].turn, 'enemy')
  assert.equal(rows[0].intent, 'reaction')
})
test('Own-turn roster rules are hidden while viewing the enemy turn', () => {
  assert.equal(visibility.matchRuleVisibleForTurn({ ownerSide: 'player', viewSide: 'opponent', turn: 'own', intent: 'required-charge-test', step: 'required-charges' }), false)
})
test('Opponent-turn reactions cross the turn boundary', () => {
  assert.equal(visibility.matchRuleVisibleForTurn({ ownerSide: 'player', viewSide: 'opponent', turn: 'enemy', intent: 'reaction', step: 'declare-charges' }), true)
})
test('Untimed friendly rules do not leak into enemy movement', () => {
  assert.equal(visibility.matchRuleVisibleForTurn({ ownerSide: 'player', viewSide: 'opponent', turn: 'either', intent: 'reminder', step: 'remaining-moves' }), false)
})
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
test('Canonical match workflow combines charge resolution and combat-result break resolution', () => {
  const games = readFileSync(resolve(root, 'src/services/games.ts'), 'utf8')
  assert.equal(/id: 'first-turn'/.test(games), false)
  assert.equal(/id: 'charge-moves'/.test(games), false)
  assert.equal(/id: 'follow-up'/.test(games), false)
  assert.equal(/id: 'break-test'/.test(games), false)
  assert.ok(games.includes("label: 'Declare & Resolve Charges'"))
  assert.ok(games.includes("label: 'Combat Result & Break Tests'"))
})
test('Waaagh Banner structured effects add three inches to maximum charge range', () => {
  const effects = matchEffects.extractChargeMatchEffects('Waaagh! Banner', 'A unit carrying the Waaagh! Banner increases its maximum possible charge range by 3" and adds +D3 to its Charge roll.')
  assert.equal(effects.maximumChargeRangeBonus, 3)
  assert.equal(effects.chargeRollModifier, 'D3')
})
test('Break Test bands use Leadership and combat-result difference', () => {
  const bands = breakTests.breakTestBands(8, 2)
  assert.equal(bands.modifiedThreshold, 6)
  assert.match(bands.giveGround, /2–6/)
  assert.match(bands.fallBack, /7–8/)
  assert.match(bands.breakAndFlee, /9–12/)
})
test('Random happenings preserve D6 table rows instead of flattening the page', () => {
  const parsed = randomHappenings.parseRandomHappeningTable('<h1>Disruptive Weather</h1><table><tr><th>D6</th><th>Result</th></tr><tr><td>1</td><td>Mud: Units suffer -1 M.</td></tr><tr><td>2</td><td>Storm: Roll for lightning.</td></tr></table>', '/random/disruptive-weather')
  assert.deepEqual(parsed.results.map((row) => [row.roll, row.title]), [['1', 'Mud'], ['2', 'Storm']])
})
test('Combat casualties are stored outside per-turn state and persist across rounds', () => {
  const tracking = readFileSync(resolve(root, 'src/services/matchTracking.ts'), 'utf8')
  assert.ok(tracking.includes('units: Record<string, MatchPersistentUnitState>'))
  assert.ok(tracking.includes('casualties?: number'))
  const view = readFileSync(resolve(root, 'src/views/GameMatchView.vue'), 'utf8')
  assert.ok(view.includes('next.units[instanceId]'))
})
test('Combat fight roster is not limited to successful chargers', () => {
  const view = readFileSync(resolve(root, 'src/views/GameMatchView.vue'), 'utf8')
  const line = view.match(/const combatFightUnits[^\n]+/)?.[0] || ''
  assert.ok(line.includes('playerRoster.value.filter'))
  assert.equal(line.includes('chargeSuccessful'), false)
})
test('Scenario maps are centrally defined for every pitched battle scenario', () => {
  const maps = readFileSync(resolve(root, 'src/data/scenarioMaps.ts'), 'utf8')
  for (const slug of ['open-battle','meeting-engagement','flank-attack','command-and-control','mountain-pass','break-point']) assert.ok(maps.includes(`'${slug}'`))
})
test('Match tips use one canonical collapsible component', () => {
  const view = readFileSync(resolve(root, 'src/views/GameMatchView.vue'), 'utf8')
  assert.ok(view.includes('MatchTipPanel'))
  assert.ok(view.includes('tipsVisible'))
  assert.equal(/<aside[^>]+game-tip-card/.test(view), false)
})
test('Match profile snapshot carries selected ranged weapons into Shooting', () => {
  const source = readFileSync(resolve(root, 'src/services/matchUnitProfiles.ts'), 'utf8')
  const view = readFileSync(resolve(root, 'src/views/GameMatchView.vue'), 'utf8')
  assert.ok(source.includes('weaponIsEquipped'))
  assert.ok(source.includes("kind: 'melee' | 'missile'"))
  assert.ok(view.includes('Units able to shoot'))
  assert.ok(view.includes("weapon.kind === 'missile'"))
})

after: {
  let passed = 0
  for (const [name, fn] of tests) {
    try { await fn(); passed += 1 }
    catch (error) { console.error(`FAIL: ${name}`); throw error }
  }
  console.log(`ODX core regressions passed: ${passed}/${tests.length}`)
}
