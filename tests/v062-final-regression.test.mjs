import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const welcome = read('src/views/WelcomeView.vue')
const welcomeService = read('src/services/welcome.ts')
const styles = read('src/styles.css')
const home = read('src/views/HomeView.vue')
const builder = read('src/views/ListBuilderView.vue')
const gamesView = read('src/views/GamesView.vue')
const games = read('src/services/games.ts')
const match = read('src/views/GameMatchView.vue')
const sw = read('public/sw.js')

test('final v0.62 hidden patch cleans welcome support, adds thanks, and can permanently dismiss install prompt', () => {
  assert.match(welcome, /welcome-support-button/)
  assert.match(welcome, /SPECIAL THANKS/)
  assert.match(welcome, /Warhammer Fantasy Online Rules Index Project/)
  assert.match(welcome, /Nico Thiebes/)
  assert.match(welcome, /Sig\.dex/)
  assert.match(welcome, /Other Contributing Supporters/)
  assert.match(welcome, /Do not show again/)
  assert.match(welcomeService, /INSTALL_PROMPT_DISMISSED_KEY/)
  assert.match(welcomeService, /dismissWelcomeInstallPromptPermanently/)
  assert.match(styles, /\.welcome-support-actions \.welcome-support-button/)
  assert.match(styles, /\.welcome-thanks-block/)
})

test('final v0.62 hidden patch normalizes page title copy and header WIP banner dimensions', () => {
  assert.match(styles, /\.page-title-block p:not\(\.eyebrow\)\{font-size:calc\(12\.5px \+ var\(--font-offset\)\)/)
  assert.match(styles, /\.wip-banner\{width:calc\(100% - 88px\);margin:0 auto 8px;font-size:calc\(13px \+ var\(--font-offset\)\)/)
})

test('final v0.62 hidden patch gives roster headings panels and derives visible roster state from real list state', () => {
  assert.match(home, /roster-list-heading-panel/)
  assert.match(home, /if \(actual === list\.points && actual > 0\) return 'valid'/)
  assert.match(builder, /rosterPoints\.value === points\.value && !overUnderWarning\.value \? 'valid' : 'warning'/)
  assert.match(styles, /\.saved-list-card\.roster-status-valid[\s\S]*#dcefe1/)
  assert.match(styles, /\.saved-list-card\.roster-status-invalid[\s\S]*#f4d9d6/)
  assert.match(styles, /\.saved-list-card\.roster-status-warning[\s\S]*#f4e7bd/)
})

test('final v0.62 hidden patch repairs missing opponent points for existing and new match rows', () => {
  assert.match(games, /savedGameSidePoints/)
  assert.match(games, /getSavedArmyList\(listId\)/)
  assert.match(games, /if \(side === 'opponent' && row\.opponentListName\) return Math\.max\(0, Number\(row\.points \|\| 0\)\)/)
  assert.match(gamesView, /game\.opponentListName \? game\.points : 0/)
})

test('final v0.62 hidden patch renders selectable spells as rule cards with check marks', () => {
  assert.match(match, /spell-rule-choice-grid/)
  assert.match(match, /spell-rule-checkmark/)
  assert.match(match, /selectedMagicChoice\(caster, choice\.id\) \? '✓' : ''/)
  assert.match(match, /Open lore rules/)
  assert.match(styles, /\.spell-rule-card/)
})

test('final v0.62 hidden patch keeps Battle Flow removed and the pre-battle next action', () => {
  // v0.64 intentionally moved round-count editing back to Setup Step 1, so the
  // old editable Overview-round assertion is superseded while these v0.62
  // presentation requirements remain applicable.
  assert.match(match, /Prepare For Battle! \(Next\)/)
  assert.doesNotMatch(match, /BATTLE FLOW/)
})

test('final v0.62 hidden patch expands Deployment and inserts Start of Round before Strategy', () => {
  const deployment = games.indexOf("{ id: 'deployment'")
  const roundStart = games.indexOf("{ id: 'round-start'")
  const strategy = games.indexOf("{ id: 'strategy'")
  assert.ok(deployment >= 0 && roundStart > deployment && strategy > roundStart)
  assert.match(games, /workflowVersion\?: number/)
  assert.match(games, /migratedPhaseIndex/)
  assert.match(games, /deployedPlayerIds\?: string\[\]/)
  assert.match(match, /Tip — Deployment Order/)
  assert.match(match, /deployment-roster-grid/)
  assert.match(match, /To War! - \(Start Battle\)/)
  assert.match(match, /Tip — Start of Round/)
  assert.match(match, /roundStartPhaseIndex/)
})

test('final v0.62 hidden patch rotates installed-app cache', () => {
  assert.match(sw, /olddex-shell-(?:v0(?:62-hidden3|63-data-rebuild|64-match-guidance|65-turn-context|66-round-flow|30-(?:scenario-turns|upgrade-profile-fix))|v066|v030-(?:scenario-turns|upgrade-profile-fix))/)
})
