import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('v0.56 roster percentage status is requirement-aware', () => {
  const source = read('src/views/ListBuilderView.vue')
  assert.match(source, /function categoryPercentageState/)
  assert.match(source, /allowance\.qualifier === 'Needed'/)
  assert.match(source, /status-\$\{categoryPercentageState\(category\)\}/)
})

test('v0.56 identifies the current General and moves unit points above controls', () => {
  const unit = read('src/views/UnitView.vue')
  const roster = read('src/components/BuilderUnitEntry.vue')
  assert.match(unit, /current-general-note/)
  assert.match(unit, /\(Current\)/)
  assert.match(roster, /builder-unit-points-box/)
  assert.match(roster, /builder-unit-control-column/)
})

test('v0.56 exposes reset data and four faction themes', () => {
  const settings = read('src/views/SettingsView.vue')
  const state = read('src/settings.ts')
  const css = read('src/styles.css')
  for (const theme of ['forces-of-fantasy', 'powers-of-chaos', 'legions-of-undead', 'ravening-hordes']) {
    assert.match(settings, new RegExp(theme))
    assert.match(state, new RegExp(theme))
    assert.match(css, new RegExp(`data-faction-theme="${theme}"`))
  }
  assert.match(settings, /Reset local data/)
  assert.match(settings, /!key\.startsWith\('olddex\.settings\.'/)
  assert.match(css, /data-theme="dark"\]\[data-faction-theme=/)
})

test('v0.56 validation and weapon-rule pill styles are normalized', () => {
  const css = read('src/styles.css')
  assert.match(css, /\.builder-validation-list\{border-top:0/)
  assert.match(css, /\.old-world-weapon-table \.weapon-rule-label\{[\s\S]*?font-weight:650/)
})
