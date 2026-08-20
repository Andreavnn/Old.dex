import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const styles = read('src/styles.css')
const games = read('src/views/GamesView.vue')
const gameCreate = read('src/views/GameCreateView.vue')
const gameMatch = read('src/views/GameMatchView.vue')
const gameService = read('src/services/games.ts')
const home = read('src/views/HomeView.vue')
const builder = read('src/views/ListBuilderView.vue')
const unit = read('src/views/UnitView.vue')
const live = read('src/data/liveBuilderUnits.ts')
const reference = read('src/services/liveUnitReference.ts')
const saved = read('src/services/savedLists.ts')
const settings = read('src/views/SettingsView.vue')
const card = read('src/components/RuleAbilityCard.vue')
const create = read('src/views/CreateListView.vue')
const router = read('src/router.ts')
const listView = read('src/views/ListView.vue')


test('v0.59 image copy backing is more transparent and blurred', () => {
  assert.match(styles, /background:color-mix\(in srgb,var\(--paper\) 82%,transparent\)/)
  assert.match(styles, /backdrop-filter:blur\(7px\)/)
  assert.match(styles, /\.background-settings-panel\{border-top:0!important;border-bottom:0!important\}/)
})

test('v0.59 preserves imported magical items and their points', () => {
  assert.match(saved, /function owbMagicItems/)
  assert.match(saved, /magicItems: importedMagicItems/)
  assert.match(saved, /owbNestedMagicPoints/)
  assert.match(saved, /for \(const item of importedMagicItems\).*selectedNames/)
})

test('v0.59 Games has one section title, filters, search, three-row defaults and standard page width', () => {
  assert.equal((games.match(/<h2>Open Matches<\/h2>/g) || []).length, 1)
  assert.equal((games.match(/<h2>Match History<\/h2>/g) || []).length, 1)
  assert.match(games, /games-filter-control/)
  assert.match(games, /games-search-toggle/)
  assert.match(games, /filtered\.slice\(0, 3\)/)
  assert.match(games, /game\.playerListName[\s\S]*game\.opponentListName[\s\S]*game\.playerArmyName[\s\S]*String\(game\.points\)/)
  assert.match(styles, /\.games-page,\.game-create-page,\.game-match-page\{width:min\(760px,calc\(100% - 28px\)\)\}/)
})

test('v0.59 Start New Match selects or imports both rosters and defers first turn', () => {
  assert.equal((gameCreate.match(/Select roster from list/g) || []).length >= 2, true)
  assert.match(gameCreate, /playerImportInput/)
  assert.match(gameCreate, /opponentImportInput/)
  assert.match(gameCreate, /scenario-info-window/)
  assert.doesNotMatch(gameCreate, /game-first-player/)
  assert.match(gameService, /firstPlayerConfirmed: false/)
  assert.match(gameMatch, /isFirstTurnStep/)
  assert.match(gameMatch, /chooseFirstPlayer/)
})

test('v0.59 roster cards show actual limit/status and support export/view', () => {
  assert.match(home, /actualPoints\(list\).*\/ \{\{ list\.points \}\} pts/)
  assert.match(home, /roster-status-/)
  assert.match(home, /exportSavedArmyList/)
  assert.match(home, /name: 'list-view'/)
  assert.match(builder, /exportCurrentList/)
  assert.match(builder, /viewCurrentList/)
  assert.match(router, /name: 'list-view'/)
  assert.match(listView, /Army roster overview/)
  assert.match(listView, /Special Rules:/)
  assert.match(listView, /list-view-profile-table/)
})

test('v0.59 magical item picker is explicitly interactive and non-stacking', () => {
  assert.match(styles, /\.magic-picker-item-main\{display:grid!important;grid-template-columns:22px minmax\(0,1fr\) max-content 24px!important/)
  assert.match(styles, /\.magic-picker-list\{display:flex!important;flex-direction:column/)
  assert.match(styles, /\.magic-picker-backdrop\{z-index:1200;pointer-events:auto\}/)
})

test('v0.59 wizard and lore configuration is consolidated under Wizards & Magic', () => {
  assert.match(unit, /Wizards &amp; Magic/)
  assert.match(unit, /wizardMagicEquipmentOptions/)
  assert.match(unit, /loreEquipmentOptions/)
  assert.match(unit, /activeLoreNames/)
  assert.match(live, /row\.exclusiveGroup && \/\^must choose/)
  assert.doesNotMatch(live, /row\.default = false[\s\S]{0,50}row\.locked = false/)
})

test('v0.59 profile count and roster totals have explicit centering/space', () => {
  assert.match(styles, /\.builder-points-orb\{width:176px;min-width:176px/)
  assert.match(styles, /\.unit-size-controls input,\.option-stepper strong[\s\S]*text-align:center/)
})

test('v0.59 Select Units contains the Add/View divider inside action cells', () => {
  assert.match(styles, /\.unit-picker-row\{overflow:hidden!important\}/)
  assert.match(styles, /\.unit-picker-actions\{display:grid!important;grid-template-columns:1fr 1fr!important/)
  assert.match(styles, /builder-mini-action\+\.builder-mini-action\{border-top:0!important;border-left:1px solid var\(--line\)!important\}/)
})

test('v0.59 counted hand weapons render as count then Hand Weapon', () => {
  assert.match(unit, /`\$\{count\} – \(Hand Weapon\)`/)
  assert.match(read('src/components/BuilderUnitEntry.vue'), /– \(Hand Weapon\)/)
})

test('v0.59 linked weapon Notes mechanics are merged site-wide', () => {
  assert.match(reference, /Weapon pages often put essential firing mechanics in Notes/)
  assert.match(reference, /noteNodes[\s\S]*querySelectorAll<HTMLAnchorElement>/)
  assert.match(reference, /rules\.push\(label\)/)
  assert.doesNotMatch(reference, /Grand Cannon|Cathayan Grand Cannon/)
})

test('v0.59 unresolved rule-loading placeholder is not shown', () => {
  assert.doesNotMatch(card, /Rule text is loading from the rules index/)
})

test('v0.59 unfinished Custom Units option is unavailable instead of pretending to function', () => {
  assert.match(create, /option === 'allow-custom-units'\) return false/)
  assert.match(builder, /option === 'allow-custom-units'\) return false/)
})

test('v0.59 Settings replaces Donations with the requested Support links', () => {
  assert.match(settings, />SUPPORT</)
  assert.match(settings, /Voluntary Support for Old\.Dex – Not Affiliated with Games Workshop – Contributions Used Only for Domain and Hosting Costs/)
  assert.match(settings, /buy\.stripe\.com\/test_4gM5kDbEa6TM9Ig7bb3Nm03/)
  assert.match(settings, /buy\.stripe\.com\/test_fZu8wP4bI2Dw6w4cvv3Nm00/)
  assert.match(settings, /target="_blank"/)
  assert.doesNotMatch(settings, /aria-label="Donations"/)
})
