import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDisplayLabel } from '../src/domain/liveUnitShared'

test('Troop/type labels split accidentally concatenated words without damaging normal labels', () => {
  assert.equal(normalizeDisplayLabel('HeavyInfantry'), 'Heavy Infantry')
  assert.equal(normalizeDisplayLabel('MonstrousCavalry(Character)'), 'Monstrous Cavalry (Character)')
  assert.equal(normalizeDisplayLabel('Regular Infantry (Character)'), 'Regular Infantry (Character)')
})
