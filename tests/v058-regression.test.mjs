import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const styles = read('src/styles.css')
const builder = read('src/views/ListBuilderView.vue')
const create = read('src/views/CreateListView.vue')
const unit = read('src/views/UnitView.vue')
const settings = read('src/views/SettingsView.vue')
const gameCreate = read('src/views/GameCreateView.vue')
const home = read('src/views/HomeView.vue')
const saved = read('src/services/savedLists.ts')
const live = read('src/data/liveBuilderUnits.ts')
const reference = read('src/services/liveUnitReference.ts')

test('v0.58 restores global text scale while keeping the large header scoped', () => {
  assert.match(styles, /:root\[data-font-size="normal"\] \{ --font-offset: 0px; \}/)
  assert.match(styles, /\.brand-stack \.brand\{font-size:clamp\(48px,6vw,64px\)!important\}/)
  assert.match(styles, /\.alpha-build\{font-size:14px!important\}/)
  assert.match(settings, /original site-wide interface scale/)
})

test('v0.58 adds theme paper backings and dark Settings contrast for image backgrounds', () => {
  assert.match(styles, /data-background.*page-title-block/)
  assert.match(styles, /background:color-mix\(in srgb,var\(--paper\) 82%,transparent\)/)
  assert.match(styles, /:root\[data-theme="dark"\] \.settings-page/)
})

test('v0.58 keeps Select Units rows readable instead of compressed', () => {
  assert.match(styles, /\.unit-picker-row\{grid-template-columns:38px minmax\(220px,1fr\).*min-height:58px!important/)
  assert.match(styles, /\.unit-picker-list\{min-height:0;overflow-y:auto/)
  assert.match(builder, /class="unit-picker-row"/)
})

test('v0.58 keeps selected option details expanded and larger by default', () => {
  assert.match(create, /class="composition-option-details permanent-option-details"/)
  assert.match(builder, /class="composition-option-details permanent-option-details"/)
  assert.doesNotMatch(create, /<details[^>]*composition-option-details/)
  assert.doesNotMatch(builder, /<details[^>]*composition-option-details/)
  assert.match(styles, /permanent-option-details \.composition-option-detail-list p\{font-size:calc\(13px \+ var\(--font-offset\)\)/)
})

test('v0.58 capitalizes lore labels and marks spell lores as Winds of Magic', () => {
  assert.match(unit, /function formatLoreName/)
  assert.match(unit, /timing: prayer \? 'Prayer Lore' : 'Winds of Magic'/)
  assert.match(unit, /`Spell Lore: \$\{displayLore\}`/)
  assert.match(live, /formatLoreName\(text\(value\)\)/)
})

test('v0.58 imports JSON rosters from Army Lists, builder, and Start New Match', () => {
  assert.match(saved, /export function importSavedArmyListJson/)
  assert.match(saved, /Old World Builder \.owb\.json\/\.owb\.lists\.json/)
  assert.match(home, /Import roster/)
  assert.match(home, /importSavedArmyListJson/)
  assert.match(builder, /JSON roster/)
  assert.match(builder, /importSavedArmyListJson/)
  assert.match(gameCreate, /Import roster/)
  assert.match(gameCreate, /importSavedArmyListJson/)
})

test('v0.58 fixes nested option IDs and merges source-specific weapon rules site-wide', () => {
  assert.match(live, /const itemId = selectableId\(item, prefix\)/)
  assert.match(live, /walkOptions\(item\.options, `\$\{itemId\}-option`, childParent\)/)
  assert.match(live, /rules: sourceRuleNames\(item, catalog\)/)
  assert.match(live, /bomb\|grenade/)
  assert.match(reference, /\.\.\.\(weapon\.rules \|\| \[\]\), \.\.\.parsed\.referenceRules/)
  assert.doesNotMatch(live, /Cathayan Grand Cannon|Gunpowder bombs/)
})

test('v0.58 Create List Cancel is centered and red', () => {
  assert.match(styles, /\.create-list-cancel\{color:var\(--danger\)!important;text-align:center!important;justify-content:center!important/)
})
