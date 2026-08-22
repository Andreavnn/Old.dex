import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const settings = read('src/views/SettingsView.vue')
const welcome = read('src/views/WelcomeView.vue')
const create = read('src/views/GameCreateView.vue')
const match = read('src/views/GameMatchView.vue')
const setup = read('src/services/gameSetup.ts')
const games = read('src/services/games.ts')
const styles = read('src/styles.css')
const changelog = read('CHANGELOG.md')
const dataChangelog = read('src/data/changelog.ts')
const app = read('src/App.vue')
const header = read('src/components/AppHeader.vue')
const sw = read('public/sw.js')

test('v0.30 uses the current Gift destinations everywhere', () => {
  for (const source of [settings, welcome]) {
    assert.match(source, /https:\/\/buy\.stripe\.com\/7sY9ATaA64LEf2Adzz3Nm02/)
    assert.match(source, /https:\/\/buy\.stripe\.com\/4gM5kDbEa6TM9Ig7bb3Nm03/)
  }
})

test('v0.30 keeps only red roster-status warnings while retaining match-level point errors', () => {
  assert.match(create, /validationStatus === 'invalid'/)
  assert.doesNotMatch(create, /validationStatus === 'warning'/)
  assert.match(create, /Roster point allowances do not match/)
  assert.match(create, /points over its/)
})

test('v0.30 scenario rules use an in-match popup and preserve scenario maps/details', () => {
  assert.match(match, /scenarioRulesOpen/)
  assert.match(match, /scenario-rules-dialog/)
  assert.match(match, /@click="openScenarioRules"/)
  assert.doesNotMatch(match, /Open scenario rules<\/RouterLink>/)
  assert.match(setup, /deploymentText/)
  assert.match(setup, /firstTurnText/)
  assert.match(match, /setup-scenario-map/)
  assert.match(match, /overview-scenario-map/)
})

test('v0.30 spell setup is collapsible and selected spells reappear in their casting subphase', () => {
  assert.match(match, /spell-rule-dropdown/)
  assert.match(match, /choice\.castingValue/)
  assert.match(match, /choice\.range/)
  assert.match(setup, /spellStepTypes/)
  assert.match(setup, /conjuration: new Set\(\['enchantment', 'hex'\]\)/)
  assert.match(setup, /'remaining-moves': new Set\(\['conveyance'\]\)/)
  assert.match(setup, /'special-shooting': new Set\(\['magic missile', 'magical vortex'\]\)/)
  assert.match(setup, /fight: new Set\(\['assailment'\]\)/)
  assert.match(setup, /selectedSpellTurnRules\(game, stepId, viewSide\)/)
})

test('v0.30 Overview and Deployment carry scenario/composition context without filler formation text', () => {
  assert.match(match, /overview-composition-options/)
  assert.match(match, /opponentOptionLabels/)
  assert.match(match, /scenarioGuidance\?\.deploymentText/)
  assert.doesNotMatch(match, /Use the formation permitted by the unit’s troop type\/rules/)
  assert.match(match, /No additional scenario-specific deployment rules are listed/)
  assert.match(match, /finished deploying first \(including units deployed using Scouts\) adds \+1/)
})

test('v0.30 compact turn context is beside the step counter and initializes from first player', () => {
  assert.match(match, /game-step-heading-tools/)
  assert.match(match, /compact-turn-context/)
  assert.match(match, /turn-context-button friendly/)
  assert.match(match, /turn-context-button enemy/)
  assert.match(match, /turnViewSide\.value = firstSide/)
  assert.match(styles, /turn-context-button\.friendly/)
  assert.match(styles, /turn-context-button\.enemy/)
})

test('v0.30 changelog is sequential and current build surfaces are renumbered', () => {
  const md = [...changelog.matchAll(/^## Alpha Build (0\.\d{2})/gm)].map((m) => m[1])
  assert.equal(md[0], '0.30')
  assert.equal(md.at(-1), '0.01')
  assert.equal(md.length, 30)
  assert.doesNotMatch(changelog, /0\.\d+\s*[–-]\s*0\.\d+/)
  assert.match(dataChangelog, /version: '0\.30'/)
  assert.match(app, /Old\.dex Alpha Build 0\.30/)
  assert.match(header, /ALPHA BUILD 0\.30/)
  assert.match(games, /deploymentText\?: string/)
  assert.match(sw, /olddex-shell-v030-upgrade-profile-fix/)
})

test('v0.30 scopes roster-dependent characteristic upgrades and avoids profile-table leakage', () => {
  const unitView = read('src/views/UnitView.vue')
  assert.match(unitView, /function upgradeRuleExcerpt/)
  assert.match(unitView, /requiresOptionMention: true/)
  assert.match(unitView, /modifierSource = source\.requiresOptionMention \? upgradeRuleExcerpt\(body, optionName\) : body/)
  assert.match(unitView, /Parse only the explicitly named characteristic list/)
  assert.doesNotMatch(unitView, /\[\^\.\;\]\{0,45\}/)
  assert.match(sw, /olddex-shell-v030-upgrade-profile-fix/)
})
