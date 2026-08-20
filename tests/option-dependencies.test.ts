import test from 'node:test'
import assert from 'node:assert/strict'
import type { PrototypeEquipmentOption } from '../src/data/builderPrototype'
import { inferEquipmentOptionDependencies } from '../src/domain/optionDependencies'

function option(id: string, name: string, note = '', requiresSelection?: string): PrototypeEquipmentOption {
  return { id, name, note, requiresSelection, points: 0, default: false, kind: 'special' }
}

test('Warpaint source note depends on Frenzy choices in the same option scope', () => {
  const rows = [option('frenzy-2', 'Frenzy (2 crew)', '', 'chariot'), option('frenzy-3', 'Frenzy (3 crew)', '', 'chariot'), option('warpaint', 'Warpaint', 'If frenzied', 'chariot')]
  inferEquipmentOptionDependencies(rows)
  assert.deepEqual(rows[2].requiresAnySelection?.sort(), ['frenzy-2', 'frenzy-3'])
})

test('Static Frenzy rule satisfies If frenzied without inventing a selectable dependency', () => {
  const rows = [option('warpaint', 'Warpaint', 'If frenzied')]
  inferEquipmentOptionDependencies(rows, 'Frenzy, Warband')
  assert.equal(rows[0].requiresAnySelection, undefined)
})

test('Crew-count notes produce positive and negative dependencies', () => {
  const rows = [option('third', 'Third Orc crew member', '', 'chariot'), option('three', 'Big Stabbas', 'If 3 crew members', 'chariot'), option('two', 'Frenzy', 'If 2 crew members', 'chariot')]
  inferEquipmentOptionDependencies(rows)
  assert.deepEqual(rows[1].requiresAllSelections, ['third'])
  assert.deepEqual(rows[2].forbidsSelection, ['third'])
})


test('Mounted source notes are normalized as mounted-only requirements', () => {
  const spear = option('spear', 'Cavalry spear', 'If appropriately mounted')
  inferEquipmentOptionDependencies([spear])
  assert.equal(spear.requiresMounted, true)
})

test('Explicit named prerequisite notes are normalized across equipment options', () => {
  const rows = [
    option('blessing', 'Sacred Blessing'),
    option('upgrade', 'Blessed Blade', 'May only be taken if the model has Sacred Blessing.'),
  ]
  inferEquipmentOptionDependencies(rows)
  assert.deepEqual(rows[1].requiresAllSelections, ['blessing'])
})
