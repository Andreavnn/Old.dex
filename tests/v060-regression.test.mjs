import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const settings = read('src/views/SettingsView.vue')
const styles = read('src/styles.css')
const games = read('src/views/GamesView.vue')
const gameCreate = read('src/views/GameCreateView.vue')
const gameService = read('src/services/games.ts')
const home = read('src/views/HomeView.vue')
const saved = read('src/services/savedLists.ts')
const schemas = read('src/domain/schemas.ts')
const unit = read('src/views/UnitView.vue')
const card = read('src/components/RuleAbilityCard.vue')
const reference = read('src/services/liveUnitReference.ts')

test('v0.60 Support uses production URLs and centered side-by-side action buttons', () => {
  assert.match(settings, /https:\/\/buy\.stripe\.com\/7sY9ATaA64LEf2Adzz3Nm02/)
  assert.match(settings, /https:\/\/buy\.stripe\.com\/4gM5kDbEa6TM9Ig7bb3Nm03/)
  assert.doesNotMatch(settings, /buy\.stripe\.com\/test_/)
  assert.match(settings, /support-button-row[\s\S]*One Time (?:Support|Gift)[\s\S]*Recurring (?:Support|Gift)/)
  assert.match(styles, /\.support-button-row\{display:flex;align-items:center;justify-content:center/)
})

test('v0.60 Games uses an icon-only filter trigger and keeps search', () => {
  assert.match(games, /games-filter-menu/)
  assert.match(games, /aria-label="Filter matches"/)
  assert.doesNotMatch(games, /Filter open matches|Filter match history/)
  assert.match(games, /games-search-toggle/)
  assert.match(games, /filtered\.slice\(0, 3\)/)
})

test('v0.60 Start New Match is organized by generals with shared roster import/select panels', () => {
  assert.match(gameCreate, />Friendly General</)
  assert.match(gameCreate, />Enemy General</)
  assert.match(gameCreate, /Friendly general name/)
  assert.match(gameCreate, /Enemy general name/)
  assert.equal((gameCreate.match(/Select roster from list/g) || []).length >= 2, true)
  assert.match(gameCreate, /game-roster-source-controls/)
  assert.match(gameCreate, /battle-composition-window/)
  assert.match(gameCreate, /compositionRuleLabel\(playerList\.rule\)/)
  const actionBlock = gameCreate.match(/<div class="game-create-actions">[\s\S]*?<\/div>/)?.[0] || ''
  assert.ok(actionBlock.indexOf('Create Match') >= 0 && actionBlock.indexOf('Create Match') < actionBlock.indexOf('Cancel'))
  assert.match(gameService, /playerName: string/)
})

test('v0.60 enemy roster flag persists and is separated from normal rosters', () => {
  assert.match(schemas, /enemyRoster\?: boolean/)
  assert.match(schemas, /enemyRoster: typeof row\.enemyRoster === 'boolean'/)
  assert.match(saved, /enemyRoster: source\.enemyRoster/)
  assert.match(home, /friendlyLists/)
  assert.match(home, /enemyLists/)
  assert.match(home, />Enemy Army Rosters</)
  assert.match(home, /toggleEnemyRoster/)
  assert.match(home, /Mark as Enemy Army Roster/)
})

test('v0.60 roster View and Export actions are icons rather than visible words', () => {
  assert.match(home, /class="saved-list-icon-action"[\s\S]*aria-label="View roster"/)
  assert.match(home, /class="saved-list-icon-action"[\s\S]*aria-label="Export roster"/)
  assert.doesNotMatch(home, />View<\/RouterLink>/)
  assert.doesNotMatch(home, />Export<\/button>/)
})

test('v0.60 magical item picker preloads descriptions and preserves item detail fallbacks', () => {
  assert.match(unit, /preloadMagicPickerDetails/)
  assert.match(unit, /fallbackMagicItemText/)
  assert.match(unit, /magicPickerDetail\(item\)\?\.summary \|\| magicPickerDetail\(item\)\?\.fluff \|\| item\.source/)
})

test('v0.60 missing rule-card information has a secondary document-text fallback', () => {
  assert.match(reference, /fallbackReferenceText/)
  assert.match(reference, /extractMechanicalRuleText\(document\.html\)/)
  assert.match(card, /fallbackDocumentText/)
  assert.match(card, /fetchRuleDocument\(ownRulePath\.value\)/)
  assert.match(card, /const ruleSummary = computed/)
})


test('v0.60 unit profiles render base Builder data before reference enrichment finishes', () => {
  const liveBuilder = read('src/data/liveBuilderUnits.ts')
  assert.match(unit, /loadLiveUnitProfileProgressively/)
  assert.match(unit, /liveReferenceLoading/)
  assert.match(unit, /Loading reference details…/)
  assert.match(liveBuilder, /loadBaseLiveUnitProfile/)
  assert.match(liveBuilder, /const baseUnit = clonePrototypeUnit\(prepared\.unit\)/)
  assert.match(liveBuilder, /callbacks\.onBase\?\.\(clonePrototypeUnit\(baseUnit\)\)/)
  assert.match(liveBuilder, /callbacks\.onEnriched\?\.\(clonePrototypeUnit\(finalUnit\)\)/)
})
