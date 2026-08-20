import test from 'node:test'
import assert from 'node:assert/strict'
import type { PrototypeEquipmentOption, PrototypeUnit, PrototypeWeapon } from '../src/data/builderPrototype'
import {
  createDefaultRosterSelection,
  removeMagicalMaelstromFromRosterSelection,
  ensureUniversalHandWeapon,
  equipmentSelectionCost,
  isPerModelEquipmentSelection,
  isPerModelWeaponSelection,
  normalizeWeaponAllocation,
  selectionModeForEquipment,
  selectionModeForWeapon,
  unitSelectionPointBreakdown,
  weaponIsEquipped,
  weaponIsOptionalChoice,
} from '../src/domain/loadout'
import { normalizeUnitSelections } from '../src/domain/selection'

function weapon(partial: Partial<PrototypeWeapon> & Pick<PrototypeWeapon, 'id' | 'name'>): PrototypeWeapon {
  return { kind: 'melee', range: 'Combat', strength: 'S', ap: '—', rules: [], points: 0, default: false, ...partial }
}
function option(partial: Partial<PrototypeEquipmentOption> & Pick<PrototypeEquipmentOption, 'id' | 'name'>): PrototypeEquipmentOption {
  return { points: 0, default: false, ...partial }
}
function unit(partial: Partial<PrototypeUnit> = {}): PrototypeUnit {
  return {
    id: 'fixture', name: 'Fixture Unit', category: 'Core', points: 100, unitSize: '10+ models',
    profile: { M: '4', WS: '4', BS: '3', S: '3', T: '3', W: '1', I: '3', A: '1', Ld: '8', Sv: '6+', Ward: '—', Rn: '—' },
    weapons: [], equipmentOptions: [], details: { troopType: 'Regular Infantry', baseSize: '25 × 25 mm', publication: 'Fixture' }, specialRules: [], keywords: [], minimumModels: 10,
    ...partial,
  }
}

test('Shield is always a unit-toggle even when legacy/source fields claim stackable', () => {
  const shield = option({ id: 'shield', name: 'Shields', kind: 'equipment', points: 1, perModel: true, costMode: 'per-model', selectionMode: 'per-model-count', stackable: true })
  assert.equal(selectionModeForEquipment(shield), 'unit-toggle')
  assert.equal(isPerModelEquipmentSelection(shield), false)
})

test('Unit-toggle Shield can still be priced per model', () => {
  const shield = option({ id: 'shield', name: 'Shield', points: 2, costMode: 'per-model' })
  assert.equal(equipmentSelectionCost(shield, 12, 0), 24)
})

test('Point breakdown includes base models, flat upgrades, per-model upgrades, mixed weapon counts, and magic items', () => {
  const greatWeapon = weapon({ id: 'great', name: 'Great weapon', points: 4, costMode: 'per-model' })
  const mixedBow = weapon({ id: 'bow', name: 'Bow', kind: 'missile', points: 2, selectionMode: 'per-model-count', allocationGroup: 'mixed' })
  const shield = option({ id: 'shield', name: 'Shield', points: 1, costMode: 'per-model' })
  const champion = option({ id: 'champion', name: 'Champion', points: 8 })
  const fixture = unit({ basePointsPerModel: 8, minimumModels: 10, weapons: [greatWeapon, mixedBow], equipmentOptions: [shield, champion] })
  const points = unitSelectionPointBreakdown({
    unit: fixture,
    modelCount: 10,
    selectedWeapons: [greatWeapon, mixedBow],
    selectedEquipment: [shield, champion],
    weaponCounts: new Map([['bow', 4]]),
    equipmentCounts: new Map(),
    magicPoints: 50,
  })
  assert.deepEqual(points, {
    basePoints: 80,
    weaponPoints: 48,
    equipmentPoints: 18,
    magicPoints: 50,
    optionPoints: 116,
    totalPoints: 196,
  })
})

test('Character-style eight-point upgrade package is never dropped from the total', () => {
  const greatWeapon = weapon({ id: 'great', name: 'Great weapon', points: 4, costMode: 'per-model' })
  const shield = option({ id: 'shield', name: 'Shield', points: 2, costMode: 'per-model' })
  const spear = weapon({ id: 'spear', name: 'Cavalry spear', points: 2, costMode: 'per-model' })
  const fixture = unit({ category: 'Characters', points: 75, basePointsPerModel: 75, minimumModels: 1, maximumModels: 1, unitSize: '1 model', weapons: [greatWeapon, spear], equipmentOptions: [shield] })
  const points = unitSelectionPointBreakdown({ unit: fixture, modelCount: 1, selectedWeapons: [greatWeapon, spear], selectedEquipment: [shield], magicPoints: 50 })
  assert.equal(points.basePoints, 75)
  assert.equal(points.weaponPoints + points.equipmentPoints, 8)
  assert.equal(points.magicPoints, 50)
  assert.equal(points.totalPoints, 133)
})

test('Legacy stackable alone no longer turns an option into a per-model selector', () => {
  const legacy = weapon({ id: 'legacy', name: 'Great weapon', stackable: true })
  assert.equal(selectionModeForWeapon(legacy), 'unit-toggle')
  assert.equal(isPerModelWeaponSelection(legacy), false)
})

test('Normal optional melee weapon is not equipped until selected', () => {
  const hand = weapon({ id: 'hand', name: 'Hand weapon', default: true, locked: true, alwaysIncluded: true })
  const great = weapon({ id: 'great', name: 'Great weapon' })
  const fixture = unit({ weapons: [hand, great] })
  assert.equal(weaponIsEquipped(fixture, great, new Set()), false)
  assert.equal(weaponIsEquipped(fixture, great, new Set(['great'])), true)
  assert.equal(weaponIsOptionalChoice(fixture, great), true)
})

test('Normal optional ranged weapon is not equipped until selected', () => {
  const bow = weapon({ id: 'bow', name: 'Bow', kind: 'missile', range: '24"' })
  const fixture = unit({ weapons: [bow] })
  assert.equal(weaponIsEquipped(fixture, bow, new Set()), false)
  assert.equal(weaponIsEquipped(fixture, bow, new Set(['bow'])), true)
})

test('True mixed-armament weapons use per-model counts only when explicitly normalized', () => {
  const spear = weapon({ id: 'spear', name: 'Spear', selectionMode: 'per-model-count', allocationGroup: 'front-rank' })
  const axe = weapon({ id: 'axe', name: 'Great weapon', selectionMode: 'per-model-count', allocationGroup: 'front-rank' })
  assert.equal(isPerModelWeaponSelection(spear), true)
  const fixture = unit({ weapons: [spear, axe], minimumModels: 10 })
  const result = normalizeWeaponAllocation(fixture, ['spear', 'axe'], { spear: 7, axe: 7 }, 10)
  assert.equal(result.counts.get('spear'), 7)
  assert.equal(result.counts.get('axe'), 3)
})

test('Independent mixed allocation groups do not consume each other capacity', () => {
  const melee = weapon({ id: 'melee', name: 'Spear', selectionMode: 'per-model-count', allocationGroup: 'melee-choice' })
  const ranged = weapon({ id: 'ranged', name: 'Bow', kind: 'missile', range: '24"', selectionMode: 'per-model-count', allocationGroup: 'ranged-choice' })
  const fixture = unit({ weapons: [melee, ranged] })
  const result = normalizeWeaponAllocation(fixture, ['melee', 'ranged'], { melee: 10, ranged: 10 }, 10)
  assert.equal(result.counts.get('melee'), 10)
  assert.equal(result.counts.get('ranged'), 10)
})

test('Hand Weapon is synthesized and remains equipped by default', () => {
  const fixture = ensureUniversalHandWeapon(unit({ weapons: [] }))
  const hand = fixture.weapons.find((row) => /^hand weapon$/i.test(row.name))
  assert.ok(hand)
  assert.equal(hand?.locked, true)
  assert.equal(hand?.alwaysIncluded, true)
  assert.equal(weaponIsEquipped(fixture, hand!, new Set(), {}), true)
})

test('Hand Weapon does not consume mixed-armament allocation capacity', () => {
  const hand = weapon({ id: 'hand', name: 'Hand weapon', default: true, locked: true, alwaysIncluded: true, selectionMode: 'unit-toggle' })
  const spear = weapon({ id: 'spear', name: 'Spear', selectionMode: 'per-model-count', allocationGroup: 'mixed' })
  const axe = weapon({ id: 'axe', name: 'Axe', selectionMode: 'per-model-count', allocationGroup: 'mixed' })
  const fixture = unit({ weapons: [hand, spear, axe] })
  const result = normalizeWeaponAllocation(fixture, ['hand', 'spear', 'axe'], { spear: 4, axe: 6 }, 10)
  assert.equal(result.counts.get('spear'), 4)
  assert.equal(result.counts.get('axe'), 6)
  assert.equal(result.selectedIds.has('hand'), true)
})

test('Explicit no-Hand-Weapon units are not synthesized', () => {
  const fixture = ensureUniversalHandWeapon(unit({ weapons: [], assumesHandWeapon: false }))
  assert.equal(fixture.weapons.some((row) => /^hand weapons?$/i.test(row.name)), false)
})

test('Selection normalizer keeps one ordinary exclusive weapon', () => {
  const hand = weapon({ id: 'hand', name: 'Hand weapon', default: true, locked: true, alwaysIncluded: true })
  const spear = weapon({ id: 'spear', name: 'Spear', exclusiveGroup: 'weapon-choice' })
  const axe = weapon({ id: 'axe', name: 'Great weapon', exclusiveGroup: 'weapon-choice' })
  const fixture = unit({ weapons: [hand, spear, axe] })
  const state = normalizeUnitSelections(fixture, [], ['hand', 'spear', 'axe'])
  assert.equal(state.weaponIds.has('hand'), true)
  assert.equal(Number(state.weaponIds.has('spear')) + Number(state.weaponIds.has('axe')), 1)
})

test('Default roster selection persists explicit weapon/equipment IDs and costs', () => {
  const hand = weapon({ id: 'hand', name: 'Hand weapon', default: true, locked: true, alwaysIncluded: true })
  const shield = option({ id: 'shield', name: 'Shields', default: true, locked: true, points: 1, costMode: 'per-model' })
  const fixture = unit({ weapons: [hand], equipmentOptions: [shield], basePointsPerModel: 8, minimumModels: 10 })
  const row = createDefaultRosterSelection(fixture, 'one')
  assert.deepEqual(row.weaponIds, ['hand'])
  assert.deepEqual(row.equipmentIds, ['shield'])
  assert.equal(row.basePoints, 80)
  assert.equal(row.totalPoints, 90)
})

test('Dependent equipment is removed when its prerequisite is removed', () => {
  const frenzy = option({ id: 'frenzy', name: 'Frenzy' })
  const warpaint = option({ id: 'warpaint', name: 'Warpaint', requiresAnySelection: ['frenzy'] })
  const fixture = unit({ equipmentOptions: [frenzy, warpaint] })
  const valid = normalizeUnitSelections(fixture, ['frenzy', 'warpaint'], [])
  assert.equal(valid.equipmentIds.has('warpaint'), true)
  const invalid = normalizeUnitSelections(fixture, ['warpaint'], [])
  assert.equal(invalid.equipmentIds.has('warpaint'), false)
})

test('Wizard starting level stays selected until a higher level in the same Wizard group is chosen', () => {
  const parent = option({ id: 'wizard', name: 'Wizard', default: true, locked: true })
  const level1 = option({ id: 'wizard-1', name: 'Level 1 Wizard', default: true, locked: true, requiresSelection: 'wizard', exclusiveGroup: 'wizard-level' })
  const level2 = option({ id: 'wizard-2', name: 'Level 2 Wizard', requiresSelection: 'wizard', exclusiveGroup: 'wizard-level' })
  const fixture = unit({ equipmentOptions: [parent, level1, level2], baseWizardLevel: 1 })
  const starting = normalizeUnitSelections(fixture, ['wizard', 'wizard-1'], [], { startingWizardLevel: 1 })
  assert.equal(starting.equipmentIds.has('wizard-1'), true)
  const upgraded = normalizeUnitSelections(fixture, ['wizard', 'wizard-1', 'wizard-2'], [], { startingWizardLevel: 1 })
  assert.equal(upgraded.equipmentIds.has('wizard-1'), false)
  assert.equal(upgraded.equipmentIds.has('wizard-2'), true)
})

test('Wizard choices are normalized independently per owner', () => {
  const a = option({ id: 'wizard-a', name: 'Wizard', default: true, locked: true })
  const a1 = option({ id: 'a1', name: 'Level 1 Wizard', default: true, locked: true, requiresSelection: 'wizard-a', exclusiveGroup: 'wizard-a-level' })
  const a2 = option({ id: 'a2', name: 'Level 2 Wizard', requiresSelection: 'wizard-a', exclusiveGroup: 'wizard-a-level' })
  const b = option({ id: 'wizard-b', name: 'Wizard', default: true, locked: true })
  const b1 = option({ id: 'b1', name: 'Level 1 Wizard', default: true, locked: true, requiresSelection: 'wizard-b', exclusiveGroup: 'wizard-b-level' })
  const fixture = unit({ equipmentOptions: [a, a1, a2, b, b1], baseWizardLevel: 1 })
  const state = normalizeUnitSelections(fixture, ['wizard-a', 'a1', 'a2', 'wizard-b', 'b1'], [], { startingWizardLevel: 1 })
  assert.equal(state.equipmentIds.has('a2'), true)
  assert.equal(state.equipmentIds.has('b1'), true)
})


test('Default roster selection keeps each Wizard owner source starting level', () => {
  const a = option({ id: 'wizard-a', name: 'Wizard', default: true, locked: true })
  const a1 = option({ id: 'a1', name: 'Level 1 Wizard', default: true, locked: true, requiresSelection: 'wizard-a', exclusiveGroup: 'wizard-a-level' })
  const a2 = option({ id: 'a2', name: 'Level 2 Wizard', requiresSelection: 'wizard-a', exclusiveGroup: 'wizard-a-level' })
  const b = option({ id: 'wizard-b', name: 'Wizard', default: true, locked: true })
  const b3 = option({ id: 'b3', name: 'Level 3 Wizard', default: true, locked: true, requiresSelection: 'wizard-b', exclusiveGroup: 'wizard-b-level' })
  const b4 = option({ id: 'b4', name: 'Level 4 Wizard', requiresSelection: 'wizard-b', exclusiveGroup: 'wizard-b-level' })
  const fixture = unit({ equipmentOptions: [a, a1, a2, b, b3, b4], baseWizardLevel: 1 })
  const row = createDefaultRosterSelection(fixture, 'wizard-fixture')
  assert.equal(row.equipmentIds?.includes('a1'), true)
  assert.equal(row.equipmentIds?.includes('b3'), true)
  assert.equal(row.equipmentIds?.includes('a2'), false)
  assert.equal(row.equipmentIds?.includes('b4'), false)
})

test('Magical Maelstrom selects the normal maximum Wizard level and makes the upgrade free in a default roster row', () => {
  const parent = option({ id: 'wizard', name: 'Wizard', default: true, locked: true })
  const level1 = option({ id: 'wizard-1', name: 'Level 1 Wizard', default: true, locked: true, requiresSelection: 'wizard', exclusiveGroup: 'wizard-level' })
  const level2 = option({ id: 'wizard-2', name: 'Level 2 Wizard', points: 35, requiresSelection: 'wizard', exclusiveGroup: 'wizard-level' })
  const level3 = option({ id: 'wizard-3', name: 'Level 3 Wizard', points: 70, requiresSelection: 'wizard', exclusiveGroup: 'wizard-level' })
  const fixture = unit({ category: 'Characters', equipmentOptions: [parent, level1, level2, level3], baseWizardLevel: 1, points: 100, minimumModels: 1, maximumModels: 1, unitSize: '1 model' })
  const row = createDefaultRosterSelection(fixture, 'maelstrom', { magicalMaelstrom: true })
  assert.equal(row.equipmentIds?.includes('wizard-3'), true)
  assert.equal(row.equipmentIds?.includes('wizard-1'), false)
  assert.equal(row.totalPoints, 100)
  assert.ok(row.options.includes('Wizard Level 4'))
  assert.ok(row.options.includes('Magical Maelstrom'))
})


test('Removing Magical Maelstrom restores the selected normal Wizard upgrade and its cost', () => {
  const parent = option({ id: 'wizard', name: 'Wizard', default: true, locked: true })
  const level1 = option({ id: 'wizard-1', name: 'Level 1 Wizard', default: true, locked: true, requiresSelection: 'wizard', exclusiveGroup: 'wizard-level' })
  const level2 = option({ id: 'wizard-2', name: 'Level 2 Wizard', points: 35, requiresSelection: 'wizard', exclusiveGroup: 'wizard-level' })
  const level3 = option({ id: 'wizard-3', name: 'Level 3 Wizard', points: 70, requiresSelection: 'wizard', exclusiveGroup: 'wizard-level' })
  const fixture = unit({ category: 'Characters', equipmentOptions: [parent, level1, level2, level3], baseWizardLevel: 1, points: 100, minimumModels: 1, maximumModels: 1, unitSize: '1 model' })
  const maelstrom = createDefaultRosterSelection(fixture, 'maelstrom-off', { magicalMaelstrom: true })
  const restored = removeMagicalMaelstromFromRosterSelection(fixture, maelstrom)
  assert.equal(restored.totalPoints, 170)
  assert.ok(restored.options.includes('Wizard Level 3'))
  assert.ok(restored.optionalSelections?.includes('Wizard Level 3'))
  assert.equal(restored.includedEquipment?.includes('Wizard Level 3'), false)
  assert.equal(restored.options.includes('Magical Maelstrom'), false)
})
