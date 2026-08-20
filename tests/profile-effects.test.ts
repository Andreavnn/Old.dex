import test from 'node:test'
import assert from 'node:assert/strict'
import type { ProfileKey, PrototypeUnit } from '../src/data/builderPrototype'
import { applyProfileEffects, formatCharacteristicBonus } from '../src/domain/profileEffects'

const baseProfile: Record<ProfileKey, string> = { M: '4', WS: '4', BS: '3', S: '3', T: '3', W: '1', I: '3', A: '1', Ld: '7', Sv: '—', Ward: '—', Rn: '—' }
const unit = {
  id: 'u', name: 'Unit', category: 'Core', points: 10, unitSize: '5+ models', profile: baseProfile,
  weapons: [],
  equipmentOptions: [
    { id: 'shield', name: 'Shields', points: 1, kind: 'armour', selectionMode: 'unit-toggle', costMode: 'per-model', saveModifier: 1, default: false },
    { id: 'partial', name: 'Mixed protection', points: 1, kind: 'special', selectionMode: 'per-model-count', saveModifier: 1, default: false },
  ],
  details: { troopType: '', baseSize: '', publication: '' }, specialRules: [], keywords: [],
} satisfies PrototypeUnit

test('Unit-toggle Shield applies its profile effect to the whole unit', () => {
  const result = applyProfileEffects({ baseProfile, profileName: 'Unit', unit, selectedEquipment: [unit.equipmentOptions[0]], equipmentCount: () => 0, modelCount: 10, activeRules: [], bigUnsSelected: false })
  assert.equal(result.Sv, '6+')
})

test('Partial per-model equipment does not alter the shared unit profile', () => {
  const result = applyProfileEffects({ baseProfile, profileName: 'Unit', unit, selectedEquipment: [unit.equipmentOptions[1]], equipmentCount: () => 4, modelCount: 10, activeRules: [], bigUnsSelected: false })
  assert.equal(result.Sv, '—')
})

test('Armoured Hide, Ward and Regeneration rules modify the effective profile', () => {
  const result = applyProfileEffects({ baseProfile, profileName: 'Unit', unit, selectedEquipment: [], equipmentCount: () => 0, modelCount: 10, activeRules: [
    { name: 'Armoured Hide (2)', path: '', timing: '', tone: 'passive', summary: '', keywords: [] },
    { name: 'Regeneration (5+)', path: '', timing: '', tone: 'passive', summary: '', keywords: [] },
    { name: 'Ward', path: '', timing: '', tone: 'passive', summary: 'This model has a 6+ Ward save.', keywords: [] },
  ], bigUnsSelected: false })
  assert.equal(result.Sv, '5+')
  assert.equal(result.Ward, '6+')
  assert.equal(result.Rn, '5+')
})

test('Ward characteristic appears when gained and returns to absent when removed', () => {
  const warpaint = { id: 'warpaint', name: 'Warpaint', points: 5, default: false, kind: 'special' as const, profileOverride: { Ward: '6+' } }
  const fixture = { ...unit, equipmentOptions: [...unit.equipmentOptions, warpaint] }
  const gained = applyProfileEffects({ baseProfile, profileName: 'Unit', unit: fixture, selectedEquipment: [warpaint], equipmentCount: () => 0, modelCount: 10, activeRules: [], bigUnsSelected: false })
  const lost = applyProfileEffects({ baseProfile, profileName: 'Unit', unit: fixture, selectedEquipment: [], equipmentCount: () => 0, modelCount: 10, activeRules: [], bigUnsSelected: false })
  assert.equal(gained.Ward, '6+')
  assert.equal(lost.Ward, '—')
})

test('Optional mount replaces rider Movement and shows rider bonuses as base(modified)', () => {
  const mount = { id: 'mount', name: 'War mount', points: 20, default: false, kind: 'mount' as const, riderProfileModifiers: { T: 1 as const } }
  const fixture = { ...unit, equipmentOptions: [...unit.equipmentOptions, mount] }
  const mounted = applyProfileEffects({ baseProfile: { ...baseProfile, T: '4' }, profileName: 'Rider', unit: fixture, selectedEquipment: [mount], equipmentCount: () => 0, modelCount: 1, activeRules: [], bigUnsSelected: false, mountedRider: { active: true, modifiers: mount.riderProfileModifiers } })
  const dismounted = applyProfileEffects({ baseProfile: { ...baseProfile, T: '4' }, profileName: 'Rider', unit: fixture, selectedEquipment: [], equipmentCount: () => 0, modelCount: 1, activeRules: [], bigUnsSelected: false, mountedRider: { active: false } })
  assert.equal(mounted.M, '—')
  assert.equal(mounted.T, '4(5)')
  assert.equal(dismounted.M, '4')
  assert.equal(dismounted.T, '4')
})

test('Mounted rider effects never alter the mount profile itself', () => {
  const result = applyProfileEffects({ baseProfile: { ...baseProfile, M: '7', T: '4' }, profileName: 'War Boar', unit, selectedEquipment: [], equipmentCount: () => 0, modelCount: 1, activeRules: [], bigUnsSelected: false, mountedRider: { active: true, modifiers: { T: 1 } } })
  assert.equal(result.M, '7')
  assert.equal(result.T, '4')
})


test('Additional mounted bonuses update one base(modified) value instead of nesting parentheses', () => {
  assert.equal(formatCharacteristicBonus('4(5)', 1), '4(6)')
})

test('Ward rule parser accepts Ward save of N+ phrasing', () => {
  const result = applyProfileEffects({ baseProfile, profileName: 'Unit', unit, selectedEquipment: [], equipmentCount: () => 0, modelCount: 10, activeRules: [
    { name: 'Blessing', path: '', timing: '', tone: 'passive', summary: 'This model has a Ward save of 5+.', keywords: [] },
  ], bigUnsSelected: false })
  assert.equal(result.Ward, '5+')
})

test('Magic-item Ward and Regeneration characteristics appear dynamically and disappear when removed', () => {
  const gained = applyProfileEffects({ baseProfile, profileName: 'Unit', unit, selectedEquipment: [], equipmentCount: () => 0, modelCount: 10, activeRules: [], bigUnsSelected: false, magicOverride: { Ward: '5+', Rn: '4+' } })
  const removed = applyProfileEffects({ baseProfile, profileName: 'Unit', unit, selectedEquipment: [], equipmentCount: () => 0, modelCount: 10, activeRules: [], bigUnsSelected: false })
  assert.equal(gained.Ward, '5+')
  assert.equal(gained.Rn, '4+')
  assert.equal(removed.Ward, '—')
  assert.equal(removed.Rn, '—')
})

test('Regeneration from equipment is not erased when no Regeneration special rule exists', () => {
  const charm = { id: 'charm', name: 'Regeneration charm', points: 5, default: false, kind: 'equipment' as const, profileOverride: { Rn: '5+' } }
  const fixture = { ...unit, equipmentOptions: [...unit.equipmentOptions, charm] }
  const result = applyProfileEffects({ baseProfile, profileName: 'Unit', unit: fixture, selectedEquipment: [charm], equipmentCount: () => 0, modelCount: 10, activeRules: [], bigUnsSelected: false })
  assert.equal(result.Rn, '5+')
})

test('Armoured Hide improves an existing armour save by its stated value', () => {
  const result = applyProfileEffects({ baseProfile: { ...baseProfile, Sv: '5+' }, profileName: 'Unit', unit, selectedEquipment: [], equipmentCount: () => 0, modelCount: 10, activeRules: [
    { name: 'Armoured Hide (1)', path: '', timing: '', tone: 'passive', summary: '', keywords: [] },
  ], bigUnsSelected: false })
  assert.equal(result.Sv, '4+')
})
