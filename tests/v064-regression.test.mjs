import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const unit = readFileSync('src/views/UnitView.vue', 'utf8')
const create = readFileSync('src/views/GameCreateView.vue', 'utf8')
const match = readFileSync('src/views/GameMatchView.vue', 'utf8')
const setup = readFileSync('src/services/gameSetup.ts', 'utf8')
const games = readFileSync('src/services/games.ts', 'utf8')
const styles = readFileSync('src/styles.css', 'utf8')

test('v0.64 Wizards use a single spell lore and mount Wound bonuses reach the rider once', () => {
  assert.match(unit, /selectedLores\.value = selected \? new Set\(\[lore\]\) : new Set\(\)/)
  assert.match(unit, /const woundBonus = !selectedMountProfile/)
  assert.match(unit, /profile\.W === baseProfile\.W/)
  assert.match(unit, /incrementCharacteristic\(baseProfile\.W \|\| '—', woundBonus\)/)
})

test('v0.64 Start New Match only shows its roster issue panel when a selected roster has a problem', () => {
  assert.match(create, /const matchRosterIssues = computed/)
  assert.match(create, /validationStatus === 'invalid'/)
  assert.match(create, /Roster point allowances do not match/)
  assert.match(create, /v-if="matchRosterIssues\.length" class="match-roster-issue-panel"/)
})

test('v0.64 round count is configured in Setup Step 1 and Overview is read-only pre-battle context', () => {
  assert.match(match, /class="setup-round-limit-card card-inset"/)
  assert.match(match, /handleRoundLimit/)
  assert.match(games, /roundLimitCustomized\?: boolean/)
  assert.doesNotMatch(match, /handleOverviewRound/)
  assert.doesNotMatch(match, /<small>Rounds complete<\/small>/)
  assert.match(match, /<small>Game length<\/small><strong>\{\{ roundLimit \}\} rounds<\/strong>/)
})

test('v0.64 Deployment Step 2 is friendly-only and surfaces formations, deployment rules and reserve state', () => {
  assert.match(match, /friendly-only-deployment-grid/)
  assert.match(match, /FRIENDLY ROSTER/)
  assert.doesNotMatch(match, /<p class="eyebrow">ENEMY<\/p><h3>\{\{ game\.opponentListName/)
  assert.match(match, /deploymentFor\(row\.instanceId\)\?\.formations/)
  assert.match(match, /deploymentFor\(row\.instanceId\)\?\.deploymentRules/)
  assert.match(match, /handleReserveUnit/)
  assert.match(games, /reservePlayerIds\?: string\[\]/)
  assert.match(setup, /loadFriendlyDeploymentGuidance/)
  assert.match(setup, /formationNames = new Set\(\['close order', 'open order', 'skirmishers'\]\)/)
  assert.match(setup, /reserveTextPattern/)
  assert.match(styles, /\.deployment-unit-guidance/)
})

test('v0.64 Start of Round dynamically checks both rosters and battle sources', () => {
  assert.match(setup, /loadStartOfRoundGuidance/)
  assert.match(setup, /rosterStartRoundRules\(output, 'player'/)
  assert.match(setup, /rosterStartRoundRules\(output, 'opponent'/)
  assert.match(setup, /addArmyCompositionStartRound/)
  assert.match(setup, /compositionRulePaths/)
  assert.match(setup, /randomHappeningOptions\.filter/)
  assert.match(match, /friendlyStartRoundRules/)
  assert.match(match, /enemyStartRoundRules/)
  assert.match(match, /Scenario, Composition &amp; Battlefield/)
  assert.match(styles, /\.start-round-rule-columns/)
})

test('v0.64 Setup Step 2 still allows interactive Wizard spell selection', () => {
  assert.match(match, /spell-rule-checkbox/)
  assert.match(match, /handleMagicChoice\(caster, choice\.id, \$event\)/)
  assert.match(match, /magicSelectionLimit\(caster\)/)
})
