import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const settings = read('src/views/SettingsView.vue')
const styles = read('src/styles.css')
const changelog = read('CHANGELOG.md')
const dataChangelog = read('src/data/changelog.ts')
const app = read('src/App.vue')
const router = read('src/router.ts')
const welcome = read('src/views/WelcomeView.vue')
const games = read('src/views/GamesView.vue')
const gameService = read('src/services/games.ts')
const match = read('src/views/GameMatchView.vue')
const setup = read('src/services/gameSetup.ts')
const sw = read('public/sw.js')


test('v0.62 hidden patch groups local reset controls under one expandable Reset local data panel', () => {
  assert.match(settings, /<details class="reset-data-settings-panel">/)
  for (const label of ['Reset all local data', 'Clear ongoing matches', 'Clear match history', 'Clear friendly rosters', 'Clear enemy rosters']) assert.ok(settings.includes(label), `missing ${label}`)
  assert.match(styles, /\.reset-data-settings-panel>summary/)
  assert.match(styles, /\.reset-data-option-list/)
})

test('v0.62 hidden patch removes changelog build ranges without adding a new build', () => {
  const range = /0\.\d+\s*[–-]\s*0\.\d+/
  assert.doesNotMatch(changelog, range)
  assert.doesNotMatch(dataChangelog, range)
  assert.match(changelog, /## Alpha Build 0\.62/)
})

test('v0.62 hidden patch normalizes Settings summary text sizing including Backgrounds', () => {
  assert.match(styles, /\.background-settings-panel>summary strong,[\s\S]*font-size:calc\(13px \+ var\(--font-offset\)\)/)
  assert.match(styles, /\.background-settings-panel>summary small,[\s\S]*font-size:calc\(11px \+ var\(--font-offset\)\)/)
  assert.match(styles, /\.font-size-control button\{font-size:calc\(9px \+ var\(--font-offset\)\)/)
})

test('v0.62 hidden patch has a first-visit welcome route with background four and install prompt', () => {
  assert.match(router, /path: '\/welcome'/)
  assert.match(router, /hasSeenWelcome\(\)/)
  assert.match(welcome, /WELCOME TO/)
  assert.match(welcome, /Unofficial fan project/)
  assert.match(welcome, /Support/)
  assert.match(welcome, /installModalOpen/)
  assert.match(styles, /\.welcome-page::before[\s\S]*background-4\.jpg/)
})

test('v0.62 hidden patch adds global Report, Install and language controls above the footer', () => {
  assert.match(app, /reportPlaceholder/)
  assert.match(app, />Report<\/button>/)
  assert.match(app, /Install Old\.dex/)
  assert.match(app, /footer-language-options/)
  assert.match(app, /languageOptions/)
  assert.match(settings, /settings-group-title">INSTALL/)
})

test('v0.62 hidden patch displays matchups as names and roster points separated by dashes', () => {
  assert.match(games, /return `\$\{game\.playerName\} - \$\{game\.opponentName\}`/)
  assert.match(games, /game\.playerPoints/)
  assert.match(games, /game\.opponentPoints/)
  assert.match(games, /pts - /)
})

test('v0.62 hidden patch keeps Setup spell selection interactive and loads choices on direct Step 2 entry', () => {
  assert.match(match, /type="checkbox"[\s\S]*handleMagicChoice/)
  assert.match(match, /if \(isSetupSpellsStep\.value\) await preloadMagicChoices\(\)/)
  assert.match(setup, /wizardChoices/)
  assert.match(setup, /magicSelectionLimit/)
})

test('v0.62 hidden patch adds round limits, battlefield guidance and gated match-ending actions', () => {
  assert.match(gameService, /roundLimit: number/)
  assert.match(gameService, /roundsCompleted: number/)
  assert.match(gameService, /battleStarted: boolean/)
  assert.match(match, /game\.round }} \/ {{ roundLimit/)
  assert.match(match, /Battle Conditions/)
  assert.match(setup, /Wilderness Terrain/)
  assert.match(match, /Battlefield Terrain rules/)
  assert.match(match, /v-if="battleStarted"/)
  assert.match(match, /Concede/)
  assert.match(match, /Enemy Yielded/)
  assert.match(match, />Draw<\/button>/)
  assert.match(match, /v-if="roundsComplete"[\s\S]*Complete Match/)
  assert.match(match, /Cancel Match/)
  assert.match(match, /Start Over/)
})

test('v0.62 hidden patch includes a safe manual repository cleanup workflow', () => {
  const path = '.github/workflows/repository-cleanup.yml'
  assert.equal(existsSync(path), true)
  const workflow = read(path)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /apply_changes:/)
  assert.match(workflow, /default: false/)
  assert.match(workflow, /ODX_V0(?:62|63|64)_VERIFICATION\.txt/)
  assert.match(workflow, /git status --short/)
  assert.match(workflow, /chore: clean generated repository artifacts/)
})

test('v0.62 hidden patch rotates the PWA shell cache so installed clients receive the patch', () => {
  assert.match(sw, /olddex-shell-v0(?:62-hidden3|63-data-rebuild|64-match-guidance)/)
})
