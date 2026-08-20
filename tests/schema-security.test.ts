import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDataLiteral } from '../src/domain/dataLiteral'
import { parseArmyDataDocument, parseBuilderRoster, parseMagicItemDataDocument, parseSavedArmyLists, parseRuleDocument } from '../src/domain/schemas'
import { parseCompositionRuleCatalog } from '../src/domain/composition'

test('Data-only literal parser accepts object data, comments and trailing commas', () => {
  assert.deepEqual(parseDataLiteral(`{ // x\n core: { minPercent: 25, units: [{ ids: ['a'], max: 2, },], }, enabled: true }`), { core: { minPercent: 25, units: [{ ids: ['a'], max: 2 }] }, enabled: true })
})
test('Data-only literal parser rejects executable identifiers', () => assert.throws(() => parseDataLiteral('{ value: window.location }')))
test('Data-only literal parser rejects functions', () => assert.throws(() => parseDataLiteral('{ value: function () {} }')))
test('Roster schema drops invalid records and normalizes counts', () => {
  const rows = parseBuilderRoster([{ instanceId: '1', unitId: 'u', name: 'Unit', category: 'Core', totalPoints: 10, basePoints: 10, unitSize: '1 model', options: [], specialRules: [], keywords: [], weaponCounts: { a: -2, b: 3 } }, { nope: true }])
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].weaponCounts, { b: 3 })
})
test('Saved-list schema validates nested roster', () => {
  const rows = parseSavedArmyLists([{ id: 'x', name: 'List', army: 'a', armyName: 'A', composition: 'grand-army', compositionName: 'Grand Army', rule: 'open-war', points: 2000, options: [], description: '', roster: [{ bad: true }], createdAt: '2026-01-01', updatedAt: '2026-01-01' }])
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].roster, [])
})
test('Rule cache schema rejects incomplete documents', () => assert.throws(() => parseRuleDocument({ title: 'x', transport: 'direct' })))

test('Composition catalog schema rejects empty/non-data catalogs', () => {
  assert.throws(() => parseCompositionRuleCatalog([]))
  assert.throws(() => parseCompositionRuleCatalog({ bad: 'not-an-object' }))
})
test('Composition catalog schema normalizes supported rule fields', () => {
  assert.deepEqual(parseCompositionRuleCatalog({ grand: { core: { minPercent: 25, units: [{ ids: ['u'], max: 2, requiresMounted: true }] } } }), { grand: { core: { minPercent: 25, units: [{ ids: ['u'], max: 2, requiresMounted: true }] } } })
})
test('Army data ingress requires at least one usable collection row', () => {
  assert.throws(() => parseArmyDataDocument({ meta: 'only' }, 'army'))
  const data = parseArmyDataDocument({ core: [{ id: 'u', name_en: 'Unit' }, null, 'bad'], version: '1' }, 'army')
  assert.equal(Array.isArray(data.core) ? data.core.length : 0, 1)
})
test('Magic-item ingress requires named typed items', () => {
  assert.throws(() => parseMagicItemDataDocument({ common: [{ name_en: 'No type' }] }))
  assert.equal(parseMagicItemDataDocument({ common: [{ name_en: 'Sword', type: 'weapon' }] }).common.length, 1)
})
