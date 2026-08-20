import test from 'node:test'
import assert from 'node:assert/strict'
import { battleMarchPointPresets, emptyCompositionOptionState, normalizePointsForRule } from '../src/data/listBuilder'
import type { BuilderRosterSelection } from '../src/domain/rosterTypes'
import { validateRoster } from '../src/services/rosterValidation'

function row(id: string, category: BuilderRosterSelection['category'], options: string[] = []): BuilderRosterSelection {
  return { instanceId: id, unitId: id, name: id, category, totalPoints: 100, basePoints: 100, unitSize: '10 models', modelCount: 10, options, specialRules: [], keywords: [], magicItems: [] }
}
function validate(roster: BuilderRosterSelection[], optionIds: string[] = []) {
  return validateRoster({ roster, points: 2000, armySlug: 'fixture', compositionId: 'grand-army', compositionRuleId: 'open-war', ruleCatalog: { 'grand-army': { characters: {}, core: {} } }, compositionOptionIds: optionIds })
}
const baseRoster = () => [row('general', 'Characters', ['General']), row('core1', 'Core'), row('core2', 'Core'), row('core3', 'Core')]

test('Battle March out-of-range points normalize to 500', () => assert.equal(normalizePointsForRule('battle-march', 1000), 500))
test('Valid Battle March points remain unchanged', () => assert.equal(normalizePointsForRule('battle-march', 600), 600))
test('Battle March presets are 500 / 600 / 750', () => assert.deepEqual(battleMarchPointPresets, [500, 600, 750]))
test('Composition options initialize false', () => assert.equal(Object.values(emptyCompositionOptionState()).every((value) => value === false), true))
test('Missing General is rejected', () => assert.ok(validate([row('a', 'Core'), row('b', 'Core'), row('c', 'Core')]).some((issue) => /exactly one General/i.test(issue.message))))
test('Two Generals are rejected', () => assert.ok(validate([row('g1', 'Characters', ['General']), row('g2', 'Characters', ['General']), row('a', 'Core'), row('b', 'Core'), row('c', 'Core')]).some((issue) => /only one General/i.test(issue.message))))
test('Two Battle Standard Bearers are rejected', () => assert.ok(validate([...baseRoster(), row('b1', 'Characters', ['Battle Standard Bearer']), row('b2', 'Characters', ['Battle Standard Bearer'])]).some((issue) => /at most one Battle Standard Bearer/i.test(issue.message))))
test('Duplicate one-per-army Magic Item is rejected', () => {
  const roster = baseRoster();
  const item = { id: 'x', name: 'Unique Item', points: 10, type: 'talisman' as const, source: 'fixture', stackable: false, onePerArmy: true, slug: 'unique-item', count: 1 }
  roster[0].magicItems = [item, { ...item, id: 'x2' }]
  assert.ok(validate(roster).some((issue) => /only be selected once/i.test(issue.message)))
})
test('50-point Magic Item cap rejects 51', () => {
  const roster = baseRoster(); roster[0].magicItems = [{ id: 'x', name: 'Item', points: 51, type: 'talisman', source: 'fixture', stackable: false, onePerArmy: true, slug: 'item', count: 1 }]
  assert.ok(validate(roster, ['limit-magical-items-50']).some((issue) => /limited to/i.test(issue.message)))
})
test('Under-75 cap rejects 75', () => {
  const roster = baseRoster(); roster[0].magicItems = [{ id: 'x', name: 'Item', points: 75, type: 'talisman', source: 'fixture', stackable: false, onePerArmy: true, slug: 'item', count: 1 }]
  assert.ok(validate(roster, ['limit-magical-items-75']).some((issue) => /limited to/i.test(issue.message)))
})
test('Under-75 cap allows 74', () => {
  const roster = baseRoster(); roster[0].magicItems = [{ id: 'x', name: 'Item', points: 74, type: 'talisman', source: 'fixture', stackable: false, onePerArmy: true, slug: 'item', count: 1 }]
  assert.equal(validate(roster, ['limit-magical-items-75']).some((issue) => /limited to/i.test(issue.message)), false)
})
test('Allies disabled is rejected', () => assert.ok(validate([...baseRoster(), row('ally', 'Allies')]).some((issue) => /Allies are not enabled/i.test(issue.message))))
test('Open War requires 3 qualifying non-character units', () => assert.ok(validate([row('general', 'Characters', ['General']), row('a', 'Core'), row('b', 'Core')]).some((issue) => /at least 3 qualifying/i.test(issue.message))))

test('Limit 1 Magic rejects a second item from the same magic-item category across the roster', () => {
  const magicItem = (id: string, name: string) => ({ id, name, points: 10, type: 'weapon' as const, source: 'test', stackable: false, onePerArmy: false, slug: id, count: 1 })
  const roster = baseRoster()
  roster[0].magicItems = [magicItem('one', 'One')]
  roster[1].magicItems = [magicItem('two', 'Two')]
  const issues = validate(roster, ['limit-one-magic'])
  assert.ok(issues.some((issue) => /Magical Category - Limit 1 allows only one Magic Weapon/i.test(issue.message)))
})
