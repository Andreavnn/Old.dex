import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const home = read('src/views/HomeView.vue')
const saved = read('src/services/savedLists.ts')
const builder = read('src/views/ListBuilderView.vue')
const unit = read('src/views/UnitView.vue')
const settings = read('src/views/SettingsView.vue')
const gamesService = read('src/services/games.ts')
const styles = read('src/styles.css')
const reference = read('src/services/liveUnitReference.ts')

test('v0.61 enemy rosters are read-only from navigation and direct builder/unit routes', () => {
  assert.match(saved, /if \(row\.enemyRoster\) return \{ name: 'list-view'/)
  assert.match(home, /aria-label="View enemy roster"/)
  const enemySection = home.match(/<section v-if="enemyLists\.length"[\s\S]*?<\/section>/)?.[0] || ''
  assert.doesNotMatch(enemySection, /Export roster|Copy roster/)
  assert.match(builder, /saved\?\.locked \|\| saved\?\.enemyRoster/)
  assert.match(unit, /list\?\.locked \|\| list\?\.enemyRoster/)
})

test('v0.61 Support buttons are equal compact buttons centered side by side', () => {
  assert.match(styles, /\.support-button-row\{gap:12px;padding:8px 14px 4px\}/)
  assert.match(styles, /\.support-action-button\{display:inline-flex;flex:0 0 \d+px;width:\d+px;min-width:\d+px;min-height:42px/)
})

test('v0.61 Games title and match panels use the same column width', () => {
  assert.match(styles, /\.games-page>\.games-title-block\{width:100%;max-width:none/)
  assert.match(styles, /\.games-page>\.game-start-card,\.games-page>\.games-section\{width:100%/)
})

test('v0.61 roster status colors are visibly distinct in light and dark themes', () => {
  assert.match(styles, /\.saved-list-card\.roster-status-valid\{[^}]*background:[^}]*42%/)
  assert.match(styles, /\.saved-list-card\.roster-status-invalid\{[^}]*background:[^}]*44%/)
  assert.match(styles, /\.saved-list-card\.roster-status-warning\{[^}]*background:[^}]*44%/)
  assert.match(styles, /:root\[data-theme="dark"\] \.saved-list-card\.roster-status-valid/)
})

test('v0.61 Settings can clear ongoing/history/friendly/enemy local data independently', () => {
  assert.match(settings, /Clear ongoing matches/)
  assert.match(settings, /Clear match history/)
  assert.match(settings, /Clear friendly rosters/)
  assert.match(settings, /Clear enemy rosters/)
  assert.match(gamesService, /export function clearSavedGamesByStatus/)
  assert.match(saved, /export function clearSavedArmyListsByType/)
})

test('v0.61 weapon enrichment retries incomplete live pages and filters note/reference artifacts', () => {
  assert.match(reference, /fetchRuleDocument\(path, true\)/)
  assert.match(reference, /weaponRuleBase\(label\) === weaponRuleBase\(weaponName\)/)
  assert.match(reference, /black powder misfire table/i)
  assert.match(reference, /notePath\.startsWith\('\/special-rules\/'\)/)
  assert.match(reference, /hasExplicitSpecialRules/)
})

test('v0.61 Grand Cannon canonical weapon fallback supplies the browser-visible six weapon rules', () => {
  assert.match(reference, /'\/weapons-of-war\/grand-cannon'/)
  for (const rule of ['Armour Bane (3)', 'Cannon Fire', 'Cumbersome', 'Move or Shoot', 'Multiple Wounds (D3+1)', 'Thunderous Impact']) {
    assert.ok(reference.includes(`label: '${rule}'`), `missing ${rule}`)
  }
  assert.match(reference, /!parsed\.hasExplicitSpecialRules \? \(weaponReferenceSupplements\[path\] \|\| \[\]\) : \[\]/)
})
