import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const index = read('index.html')
const manifest = JSON.parse(read('public/manifest.webmanifest'))
const main = read('src/main.ts')
const settings = read('src/views/SettingsView.vue')
const styles = read('src/styles.css')
const home = read('src/views/HomeView.vue')
const unit = read('src/views/UnitView.vue')
const ruleText = read('src/services/ruleText.ts')
const reference = read('src/services/liveUnitReference.ts')
const card = read('src/components/RuleAbilityCard.vue')
const games = read('src/services/games.ts')
const match = read('src/views/GameMatchView.vue')
const setup = read('src/services/gameSetup.ts')

test('v0.62 is installable as a PWA and uses the supplied Old.dex icon assets', () => {
  assert.match(index, /rel="manifest" href="\/manifest\.webmanifest"/)
  assert.match(index, /apple-touch-icon/)
  assert.equal(manifest.name, 'Old.dex')
  assert.equal(manifest.display, 'standalone')
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'))
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'))
  for (const path of ['public/icons/favicon-64.png', 'public/icons/apple-touch-icon.png', 'public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/sw.js']) assert.equal(existsSync(path), true, `missing ${path}`)
  assert.match(main, /navigator\.serviceWorker\.register\('\/sw\.js'\)/)
  assert.match(settings, /Install Old\.dex/)
  assert.match(settings, /beforeinstallprompt/)
})

test('v0.62 Support actions are tightened without growing to equal fixed widths', () => {
  assert.match(styles, /\.support-action-button\{flex:0 0 auto;width:max-content;min-width:0;min-height:34px;padding:0 9px/)
})

test('v0.62 roster import status stays in the left summary and delete rows remain compact', () => {
  assert.match(home, /list-launch-copy[\s\S]*launch-import-message/)
  assert.match(home, /saved-list-delete-check/)
  assert.match(home, /saved-list-delete-points/)
  assert.match(styles, /\.saved-list-card\.delete-select-mode\{display:block;min-height:0\}/)
  assert.match(styles, /\.saved-list-card\.delete-select-mode \.saved-list-delete-row\{min-height:66px\}/)
})

test('v0.62 hides currently unaffordable magic items while retaining selected items', () => {
  assert.match(unit, /magicPickerCount\(item\.id\) > 0 \|\| item\.points <= magicPickerRemaining\(\)/)
  assert.match(unit, /No affordable items of this type/)
  assert.match(styles, /\.magic-picker-item\.unaffordable:not\(\.selected\)\{display:none!important\}/)
})

test('v0.62 special-rule extraction rejects source metadata and flavour-only text', () => {
  assert.match(ruleText, /\^Last update\\s\*:/)
  assert.match(ruleText, /sentenceCandidates/)
  assert.match(ruleText, /extractMechanicalRuleTextFromPlainText/)
  assert.match(ruleText, /metadataTerms/)
  assert.doesNotMatch(ruleText, /friendly \|elves\? \|goblins\? /)
  assert.doesNotMatch(ruleText, /fear-of-elves/)
  assert.match(reference, /ruleSummaryLooksIncomplete/)
  assert.match(reference, /fetchRuleDocument\(rule\.path, true\)/)
  assert.match(reference, /const mechanical = unique\.filter/)
  assert.match(card, /const mechanical = unique\.filter/)
})

test('v0.62 snapshots roster context into new matches for stable Setup and Overview', () => {
  assert.match(games, /playerCompositionName\?: string/)
  assert.match(games, /playerRoster\?: BuilderRosterSelection\[\]/)
  assert.match(games, /opponentRoster\?: BuilderRosterSelection\[\]/)
  assert.match(games, /playerRoster: \(input\.playerList\.roster \|\| \[\]\)\.map/)
  assert.match(games, /opponentRoster: \(input\.opponentList\?\.roster \|\| \[\]\)\.map/)
})

test('v0.62 Setup detects friendly Wizards and Priests from roster and source data', () => {
  assert.match(setup, /rawWizardLevel/)
  assert.match(setup, /rawLooksLikePriest/)
  assert.match(setup, /hydrateFriendlyMagicSetup/)
  assert.match(setup, /rawLores/)
  assert.match(match, />Wizards & Priests</)
  assert.match(match, /caster\.availableLores\.length > 1/)
  assert.match(match, /Prayer lore/)
})

test('v0.62 Setup step two records Wizard spells, exposes prayers, and provides Tips', () => {
  assert.match(setup, /wizardChoices/)
  assert.match(setup, /prayerChoices/)
  assert.match(setup, /magicSelectionLimit/)
  assert.match(match, /Tip — Spell Generation/)
  assert.match(match, /spells-and-spell-generation/)
  assert.match(match, /Signature Spell/)
  assert.match(match, /no pre-game prayer selection is required/)
})

test('v0.62 Overview is an at-a-glance match dashboard with contextual Tip content', () => {
  assert.match(match, /game-overview-dashboard/)
  assert.match(match, /Tip — Battle Overview/)
  assert.match(match, /overview-status-grid/)
  assert.match(match, /overview-matchup/)
  assert.match(match, /PREPARED MAGIC/)
  assert.match(match, /BATTLE FLOW/)
})
