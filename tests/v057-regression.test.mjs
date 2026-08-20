import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

const builder = read('src/views/ListBuilderView.vue')
const create = read('src/views/CreateListView.vue')
const unit = read('src/views/UnitView.vue')
const settings = read('src/views/SettingsView.vue')
const styles = read('src/styles.css')
const gameLanding = read('src/views/GamesView.vue')
const gameCreate = read('src/views/GameCreateView.vue')
const gameMatch = read('src/views/GameMatchView.vue')
const gameService = read('src/services/games.ts')

test('v0.57 percentage display colors only the current value and leaves zero neutral', () => {
  assert.match(builder, /if \(current === 0\) return 'neutral'/)
  assert.match(builder, /category-percentage-current/)
  assert.match(builder, /category-percentage-target/)
  assert.match(styles, /category-percentage-current\.status-neutral\{color:var\(--ink\)\}/)
  assert.match(styles, /category-percentage-target\{color:var\(--ink\)/)
})

test('v0.57 validation badge and popout controls explicitly fit and center', () => {
  assert.match(styles, /\.validation-state-text\{display:inline-flex;align-items:center;justify-content:center;text-align:center/)
  assert.match(styles, /\.unit-picker-panel,[\s\S]*\.list-settings-panel,[\s\S]*\.magic-picker-panel[\s\S]*max-height:calc\(100dvh - 40px\)/)
  assert.match(styles, /\.font-size-control button\{height:32px;min-height:32px;max-height:32px/)
})

test('v0.57 unit picker retains selections while changing category tabs', () => {
  assert.match(builder, /const pickerSelectionCategories = ref\(new Map<string, BuilderCategory>\(\)\)/)
  const switchBlock = builder.match(/function switchPickerCategory[\s\S]*?\n\}/)?.[0] || ''
  assert.doesNotMatch(switchBlock, /pickerSelectedIds\.value = new Set/)
  assert.match(builder, /pickerSelectionCategories\.value\.get\(unit\.id\) \|\| unit\.category/)
})

test('v0.57 Over / Under and Monster Mash are real composition options', () => {
  const data = read('src/data/listBuilder.ts')
  const validation = read('src/services/rosterValidation.ts')
  assert.match(data, /'over-under'/)
  assert.match(data, /'monster-mash'/)
  assert.match(builder, /points\.value \+ \(overUnderEnabled\.value \? 10 : 0\)/)
  assert.match(builder, /overUnderWarning/)
  assert.match(validation, /Monster Mash allows only one/)
  assert.match(builder, /preserveMonsterMashCore/)
})

test('v0.57 selected Battle Composition option descriptions are expandable in create and settings', () => {
  assert.match(create, /composition-option-details/)
  assert.match(builder, /composition-option-details/)
  assert.match(create, /selectedCompositionOptionDetails/)
  assert.match(builder, /settingsSelectedOptionDetails/)
  assert.match(create, /create-list-cancel/)
})

test('v0.57 wizard/magic lore selections persist and become Special Rule cards', () => {
  assert.match(unit, /Wizards &amp; Magic/)
  assert.match(unit, /selectedLores/)
  assert.match(unit, /selectedLoreRules/)
  assert.match(unit, /return \[\.\.\.sourceRules, \.\.\.selectedLoreRules\.value\]/)
  assert.match(unit, /loreSelections: activeLoreNames\.value/)
  const raw = read('src/domain/rawArmyData.ts')
  const live = read('src/data/liveBuilderUnits.ts')
  assert.match(raw, /spells\?: unknown\[\]/)
  assert.match(raw, /prayers\?: unknown\[\]/)
  assert.match(live, /spellLikeSpecialRules/)
})

test('v0.57 magical item picker stages changes, tabs item types, disables unaffordable items, and preserves fluff', () => {
  assert.match(unit, /magicPickerOpen/)
  assert.match(unit, /magicPickerTabs/)
  assert.match(unit, /magicPickerRemaining/)
  assert.match(unit, /unaffordable: !magicPickerCanSelect\(item\)/)
  assert.match(unit, /function finishMagicPicker\(\)/)
  assert.match(unit, /function cancelMagicPicker\(\)/)
  assert.match(unit, /fluff: String\(raw\.fluff_en/)
  assert.match(unit, /old-rule-fluff|fluff: detail\?\.fluff/)
})

test('v0.57 themes/backgrounds include four fixed defaults and dark-mode control contrast', () => {
  for (const file of ['src/assets/backgrounds/background-1.jpg','src/assets/backgrounds/background-2.jpg','src/assets/backgrounds/background-3.png','src/assets/backgrounds/background-4.jpg']) assert.ok(existsSync(file), file)
  assert.match(settings, /Backgrounds/)
  assert.match(styles, /background-attachment:fixed/)
  assert.match(styles, /data-faction-theme="legions-of-undead"/)
  assert.match(styles, /:root\[data-theme="dark"\] \.icon-button\{background:#f1ede4/)
})

test('v0.57 starts the persistent Games workflow from saved lists', () => {
  assert.match(gameLanding, /Start New Match/)
  assert.match(gameLanding, /Open Matches/)
  assert.match(gameLanding, /Match History/)
  assert.match(gameCreate, /getSavedArmyLists/)
  assert.match(gameService, /export const gameWorkflow/)
  for (const phase of ['Setup','Overview','Deployment','Strategy','Movement','Shooting','Combat','End']) assert.match(gameService, new RegExp(`label: '${phase}'`))
  assert.match(gameMatch, /game-phase-tabs/)
  assert.match(gameMatch, /updateSavedGame/)
})
