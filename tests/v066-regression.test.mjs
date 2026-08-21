import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const app = read('src/App.vue')
const settings = read('src/views/SettingsView.vue')
const welcome = read('src/views/WelcomeView.vue')
const unit = read('src/views/UnitView.vue')
const live = read('src/data/liveBuilderUnits.ts')
const gameCreate = read('src/views/GameCreateView.vue')
const game = read('src/views/GameMatchView.vue')
const games = read('src/services/games.ts')
const setup = read('src/services/gameSetup.ts')
const cleanup = read('.github/workflows/repository-cleanup.yml')

test('v0.66 relocates Rules intro reference links and uses Gift support labels', () => {
  assert.match(app, /Welcome to the Old\\\.dex army builder/)
  assert.match(app, /welcome\?\.remove\(\)/)
  assert.match(app, /rules-reference-links/)
  assert.match(app, /Warhammer: The Old World Online Rules Index/)
  assert.match(settings, /One Time Gift/); assert.match(settings, /Recurring Gift/)
  assert.match(welcome, /One Time Gift/); assert.match(welcome, /Recurring Gift/)
})

test('v0.66 enforces generic roster prerequisites and profile-changing upgrades', () => {
  assert.match(live, /requiresRosterGeneral/)
  assert.match(live, /requiresRosterUnit/)
  assert.match(live, /maximumPerRoster/)
  assert.match(live, /army\[’'\]s\\s\+General/)
  assert.match(unit, /equipmentRosterRequirementsMet/)
  assert.match(unit, /equipmentOptionUnavailable/)
  assert.match(unit, /hydrateUpgradeProfileModifiers/)
  assert.match(unit, /characteristicModifiersFromRuleText/)
  assert.match(unit, /upgradeProfileModifiers/)
})

test('v0.66 match setup orders roster checks and surfaces scenario deployment maps', () => {
  assert.ok(gameCreate.indexOf('BATTLE COMPOSITION') < gameCreate.indexOf('ROSTER CHECK'))
  assert.ok(game.indexOf('GAME LENGTH') < game.indexOf('value-chip">SCENARIO'))
  assert.doesNotMatch(game.slice(game.indexOf('isSetupArmiesStep'), game.indexOf('isSetupSpellsStep')), /FRIENDLY MAGIC/)
  assert.match(setup, /mapImageUrl/)
  assert.match(game, /scenario-deployment-map/)
})

test('v0.66 splits Start of Round, moves score to End of Round step 2, and gates lifecycle actions', () => {
  assert.match(games, /round-battle-effects/); assert.match(games, /round-player-effects/)
  assert.match(games, /end-effects/); assert.match(games, /round-score/)
  assert.match(game, /isRoundBattleEffectsStep/); assert.match(game, /isRoundPlayerEffectsStep/)
  assert.match(game, /END OF ROUND · STEP 2/)
  const hero = game.slice(game.indexOf('game-match-hero'), game.indexOf('game-phase-tabs'))
  assert.doesNotMatch(hero, /game-score-board/)
  assert.match(game, /v-if="!battleStarted"/)
  assert.match(game, /Save to Ongoing/)
})

test("v0.66 Enemy's Turn guidance includes dispels and reactions", () => {
  assert.match(setup, /Wizardly Dispel/)
  assert.match(setup, /Fated Dispel/)
  assert.match(setup, /Charge Reactions/)
  assert.match(setup, /Resolve Enemy Shooting/)
  assert.match(setup, /viewSide !== 'opponent'/)
})

test('v0.66 cleanup workflow only targets root generated artifacts and protects source', () => {
  assert.match(cleanup, /Protected: \.github\/.*, src\//)
  assert.match(cleanup, /find \. -maxdepth 1/)
  assert.match(cleanup, /ODX_V066_VERIFICATION\.txt/)
  assert.doesNotMatch(cleanup, /rm -rf .*src/)
})
