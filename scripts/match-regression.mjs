import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const effects = await import(pathToFileURL(resolve(root, 'src/core/matchEffects.ts')).href)
const usage = await import(pathToFileURL(resolve(root, 'src/core/matchUsage.ts')).href)
const shooting = await import(pathToFileURL(resolve(root, 'src/core/shootingToHit.ts')).href)
const randomTables = await import(pathToFileURL(resolve(root, 'src/core/randomHappeningTable.ts')).href)
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('stacked charge declaration sources retain names and values', () => {
  const swift = effects.chargeRangeContribution('Swiftstride', 'Swiftstride')
  const banner = effects.chargeRangeContribution('Waaagh! Banner', 'This unit increases its maximum possible charge range by 3" and adds +D3 to its Charge roll.')
  const result = effects.formatMaximumDeclarationRange(7, [swift, banner].filter(Boolean))
  assert.equal(result.total, 19)
  assert.equal(result.text, 'Maximum declaration range: M 7 + 6 + 3 Swiftstride + 3 Waaagh! Banner = 19"')
})

test('removing a charge source removes it from declaration range', () => {
  const swift = effects.chargeRangeContribution('Swiftstride', 'Swiftstride')
  const result = effects.formatMaximumDeclarationRange(7, [swift].filter(Boolean))
  assert.equal(result.total, 16)
  assert.equal(result.text.includes('Waaagh! Banner'), false)
})

test('limited use rules preserve their proper lifetime', () => {
  assert.deepEqual(usage.extractMatchUseLimit('This item may be used once per battle.'), { scope: 'battle', limit: 1 })
  assert.deepEqual(usage.extractMatchUseLimit('This ability may be used twice per round.'), { scope: 'round', limit: 2 })
  assert.deepEqual(usage.extractMatchUseLimit('One use only.', 3), { scope: 'battle', limit: 3 })
})

test('charge range engine reads only active roster rules and selected magical items', () => {
  const source = read('src/services/matchGuidance.ts')
  assert.ok(source.includes('for (const rule of row.specialRules || [])'))
  assert.ok(source.includes('for (const item of row.magicItems || [])'))
  assert.equal(source.includes('optionalSelections'), false)
})

test('match tracking persists fleeing, rule uses and cross-turn history', () => {
  const source = read('src/services/matchTracking.ts')
  assert.ok(source.includes('version: 4'))
  assert.ok(source.includes('fleeing?: boolean'))
  assert.ok(source.includes('ruleUses: Record<string, Record<string, number>>'))
  assert.ok(source.includes('chargeHistory: MatchHistoryRow[]'))
  assert.ok(source.includes('combatHistory: MatchHistoryRow[]'))
})

test('match profiles use a saved match roster route', () => {
  const router = read('src/router.ts')
  const view = read('src/views/GameMatchView.vue')
  assert.ok(router.includes("name: 'game-unit-profile'"))
  assert.ok(view.includes('`/games/${game.value.id}/unit/${row.instanceId}`'))
})

test('Setup spell generation uses the canonical RuleAbilityCard with a Select control', () => {
  const view = read('src/views/GameMatchView.vue')
  const spell = read('src/services/spellReference.ts')
  const card = read('src/components/MatchSpellChoiceCard.vue')
  const ruleCard = read('src/components/RuleAbilityCard.vue')
  assert.ok(view.includes('MatchSpellChoiceCard'))
  assert.ok(view.includes('enrichMagicChoices'))
  assert.ok(spell.includes("`/spell/${slug(choice.name)}`"))
  assert.ok(spell.includes('parseSpellFromLore'))
  assert.ok(card.includes("import RuleAbilityCard from './RuleAbilityCard.vue'"))
  assert.ok(card.includes('<RuleAbilityCard'))
  assert.ok(card.includes('match-spell-select'))
  assert.ok(ruleCard.includes('kindLabel?: string'))
})

test('selected spell metadata is persisted before later subphase guidance is built', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('caster.choices = await enrichMagicChoices(choices)'))
  assert.ok(view.includes('persistMagicSetup()'))
  assert.ok(view.includes("conjuration: 'Enchantment & Hex Spells'"))
  assert.ok(view.includes("'remaining-moves': 'Conveyance Spells'"))
  assert.ok(view.includes("'special-shooting': 'Magic Missiles & Magical Vortexes'"))
  assert.ok(view.includes("fight: 'Assailment Spells'"))
})

test('Pill UI uses theme-independent semantic foreground and surfaces', () => {
  const theme = read('src/styles/theme.css')
  assert.ok(theme.includes('.prototype-pill'))
  assert.ok(theme.includes('.profile-loadout-chip'))
  assert.ok(theme.includes('.old-rule-phase'))
  assert.ok(theme.includes('background: #f4f1e9 !important'))
  assert.ok(theme.includes('color: #25231f !important'))
  assert.ok(theme.includes('background: #ece2f3 !important'))
  assert.equal(theme.includes('html[data-theme="dark"] :is([class$="-pill"]'), false)
})

test('single-model Combat uses Wounds Remaining', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('Wounds Remaining'))
})

test('Match Note field is removed from guided match pages', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.equal(view.includes('game-step-note-panel'), false)
  assert.equal(view.includes('saveNotes'), false)
  assert.equal(/const notes\s*=/.test(view), false)
})

test('Disruptive Weather blocks deployment progression until a result is recorded', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes("deploymentBattlefieldConditions = computed(() => battlefieldConditionRows.value.filter((option) => option.id === 'disruptive-weather'))"))
  assert.ok(view.includes('disruptiveWeatherPending'))
  assert.ok(view.includes('Required before continuing'))
  assert.ok(view.includes('advanceButtonDisabled'))
})

test('Wilderness Terrain remains at deployment and battle conditions use the shared ongoing panel', () => {
  const view = read('src/views/GameMatchView.vue')
  const panel = read('src/components/OngoingBattleConditionsPanel.vue')
  const deploymentOrder = view.slice(view.indexOf('v-else-if="isDeploymentOrderStep"'), view.indexOf('v-else-if="isDeployArmiesStep"'))
  const deployArmies = view.slice(view.indexOf('v-else-if="isDeployArmiesStep"'), view.indexOf('v-else-if="isRoundStartStep"'))
  assert.equal(deploymentOrder.includes('Wilderness Terrain'), false)
  assert.ok(deployArmies.includes('Wilderness Terrain'))
  assert.ok(panel.includes('ONGOING BATTLE CONDITIONS'))
  assert.ok(view.includes('ongoingBattleConditionDisplayRows'))
  assert.equal((view.match(/class="wilderness-terrain-reminder card-inset"/g) || []).length, 0)
})

test('Chaos of War uses the first-turn player and the requested source-rule procedure', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes("chaosOfWarSide = computed<GameSide>(() => game.value?.firstPlayerConfirmed ? game.value.firstPlayer : 'player')"))
  assert.ok(view.includes('turnViewSide.value === chaosOfWarSide.value'))
  assert.ok(view.includes("from their second turn onwards, the player who took the first turn rolls a D6 at the beginning of each of their Start of Turn sub-phases"))
  assert.ok(view.includes('chaosOfWarPreviousRolls.has(result.roll)'))
})

test('Hold no longer displays a zero-inch distance', () => {
  const view = read('src/views/GameMatchView.vue')
  const remaining = view.slice(view.indexOf('isRemainingMoveStep'), view.indexOf('isCombatFightStep', view.indexOf('isRemainingMoveStep')))
  assert.equal(remaining.includes('0&quot;'), false)
})

test('Shooting To Hit calculation follows BS table and cumulative penalties', () => {
  assert.equal(shooting.shootingToHit(3, 0).label, '4+')
  assert.equal(shooting.shootingToHit(3, -1).label, '5+')
  assert.equal(shooting.shootingToHit(3, -3).label, '6 then 4+')
  assert.equal(shooting.shootingToHit(3, -6).label, 'Impossible')
  assert.equal(shooting.shootingToHit(6, 0).label, '2+ / 6+ re-roll')
  assert.equal(shooting.shootingToHit(7, -1).label, '3+ / 5+ re-roll')
})

test('Shooting displays calculated To Hit and expands only genuinely different BS values', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('To Hit {{ shootingToHitLabel'))
  assert.ok(view.includes('Different Ballistic Skills in this unit'))
  assert.ok(view.includes('distinctBallisticSkillRows'))
  assert.ok(view.includes('shootingPenaltyOptions'))
  const row = view.slice(view.indexOf('class="shooting-unit-copy"'), view.indexOf('</article></div><p v-else class="setup-inline-status">No selected ranged weapons', view.indexOf('class="shooting-unit-copy"')))
  assert.ok(row.indexOf('shooting-weapon-list') < row.indexOf('shooting-penalty-options'))
})

test('Combat Step 1 separates checkbox interaction from the full profile target area', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('combat-fight-check'))
  assert.ok(view.includes('combat-fight-unit-copy combat-fight-profile-area'))
  assert.equal(view.includes('combat-profile-clickable'), false)
  assert.equal(view.includes('@click="openMatchUnitProfile'), false)
})

test('Combat joined-unit copy and match profile presentation use requested text', () => {
  const view = read('src/views/GameMatchView.vue')
  const profile = read('src/views/MatchUnitProfileView.vue')
  const css = read('src/styles/match.css')
  assert.ok(view.includes('Combat Results Tracked by Joined Unit - {{ joinedHostName(unit.instanceId) }}'))
  assert.ok(view.includes('>Joined to {{ joinedHostName'))
  assert.equal(profile.includes('item.points'), false)
  assert.ok(css.includes('.match-profile-row h2'))
  assert.ok(css.includes('text-align: center'))
})

test('roster sharing uses staged Share Codes and a short receiver route', () => {
  const share = read('src/services/rosterShare.ts')
  const home = read('src/views/HomeView.vue')
  const list = read('src/views/ListView.vue')
  const router = read('src/router.ts')
  assert.ok(share.includes("ROSTER_SHARE_FORMAT = 'olddex-roster-share'"))
  assert.ok(share.includes("ROSTER_SHARE_CODE_PREFIX = 'ODX1:'"))
  assert.ok(share.includes('stageRosterShareCode'))
  assert.ok(share.includes("/lists/shared"))
  assert.ok(share.includes('parseSavedArmyLists'))
  assert.equal(share.includes("import QRCode from 'qrcode'"), false)
  assert.ok(home.includes('Copy Share Code'))
  assert.ok(home.includes('navigator.share'))
  assert.ok(home.includes('shareShortUrl'))
  assert.ok(router.includes("name: 'list-shared'"))
  assert.ok(list.includes('history.replaceState'))
  assert.ok(list.includes('Add to My Rosters'))
  assert.ok(list.includes('does not save anything to this device automatically'))
})

test('Dropbox roster cloud matches Brambleheart local-first manual App Folder architecture', () => {
  const cloud = read('src/services/rosterCloud.ts')
  const settings = read('src/views/SettingsView.vue')
  assert.ok(cloud.includes('VITE_DROPBOX_APP_KEY'))
  assert.ok(cloud.includes("token_access_type: 'offline'"))
  assert.ok(cloud.includes("code_challenge_method: 'S256'"))
  assert.ok(cloud.includes("files.metadata.read"))
  assert.ok(cloud.includes('_ODX\\.json'))
  assert.ok(settings.includes('Update from Cloud'))
  assert.ok(settings.includes('Upload Local'))
  assert.ok(settings.includes('Nothing is polled in the background'))
  assert.ok(settings.includes('Cloud Sync never replaces local storage as the live roster database'))
})


test('Settings uses Access & Community and Brambleheart-style donation/changelog rows', () => {
  const settings = read('src/views/SettingsView.vue')
  assert.ok(settings.includes('ACCESS &amp; COMMUNITY'))
  assert.ok(settings.includes('Join Discord'))
  assert.ok(settings.includes('Share Old.dex'))
  assert.ok(settings.includes("Play the Olddex 'Murderin' when the installed app opens."))
  assert.ok(settings.includes('DONATION'))
  assert.ok(settings.includes('Recurring Support'))
  assert.ok(settings.includes('CHANGELOG &amp; UPDATES'))
  assert.ok(settings.includes('Site Changelog - Alpha 0.49'))
})

test('Roster transfer removes QR machinery while keeping the QR-shaped row icon as Share Code', () => {
  const home = read('src/views/HomeView.vue')
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.dependencies.jsqr, undefined)
  assert.equal(pkg.dependencies.qrcode, undefined)
  assert.equal(pkg.devDependencies['@types/qrcode'], undefined)
  assert.equal(home.includes("import jsQR from 'jsqr'"), false)
  assert.equal(home.includes('capture="environment"'), false)
  assert.equal(home.includes('Scan QR'), false)
  assert.equal(home.includes('roster-share-qr'), false)
  assert.ok(home.includes('Paste Share Code'))
  assert.ok(home.includes('aria-label="Share roster"'))
  assert.ok(home.includes('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z'))
  assert.equal(home.includes('Import custom data'), false)
})

test('Global page tools include Discord and Share between Report and Install', () => {
  const app = read('src/App.vue')
  const report = app.indexOf('>Report</button>')
  const discord = app.indexOf('>Discord</button>')
  const share = app.indexOf('>Share</button>')
  const install = app.indexOf("Install Old.dex")
  assert.ok(report >= 0 && discord > report && share > discord && install > share)
})

test('Tips master control is a switch without changing individual tip checkboxes', () => {
  const view = read('src/views/GameMatchView.vue')
  const css = read('src/styles/match.css')
  assert.ok(view.includes('match-tip-switch-input'))
  assert.ok(css.includes('label.match-tip-master-toggle > input.match-tip-switch-input'))
  assert.ok(css.includes('width: 38px !important'))
  assert.ok(css.includes('height: 22px !important'))
})

test('Spell cards reuse canonical rule boxes instead of bespoke spell markup', () => {
  const card = read('src/components/MatchSpellChoiceCard.vue')
  assert.ok(card.includes('<RuleAbilityCard'))
  assert.ok(card.includes("tone: 'magic'"))
  assert.ok(card.includes('Casting Value'))
  assert.ok(card.includes('Range'))
  assert.equal(card.includes('match-spell-title-row'), false)
  assert.equal(card.includes('match-spell-pills'), false)
})

test('Disruptive Weather uses the standard rule-panel shape with inline result controls and gating', () => {
  const view = read('src/views/GameMatchView.vue')
  const start = view.indexOf('v-else-if="isDeploymentOrderStep"')
  const end = view.indexOf('v-else-if="isDeployArmiesStep"', start)
  const section = view.slice(start, end)
  assert.ok(section.includes('phase-rule-details condition-resolution-details disruptive-weather-required'))
  assert.ok(section.includes('<details v-for="option in deploymentBattlefieldConditions"'))
  assert.ok(section.includes(' open class='))
  assert.ok(section.includes('type="radio"'))
  assert.ok(section.includes('Required before continuing'))
})

test('magic item resolver isolates exact item sections and permits collection-only fallback', () => {
  const source = read('src/services/magicItemReference.ts')
  assert.ok(source.includes('magicItemHeadingPattern'))
  assert.ok(source.includes('minimumUsefulScore'))
  assert.ok(source.includes('Some valid items exist only on a collection page'))
  assert.ok(source.includes("type === 'weapon' ? 13 : 8"))
})

test('match content uses a shared inner gutter instead of per-panel edge fixes', () => {
  const css = read('src/styles/match.css')
  assert.ok(css.includes('Shared inner gutter'))
  assert.ok(css.includes('padding-inline: clamp(12px, 2.4vw, 18px)'))
})


test('castable phase spells use canonical cards with tracked Successful and Failed results', () => {
  const view = read('src/views/GameMatchView.vue')
  const card = read('src/components/MatchSpellChoiceCard.vue')
  assert.ok(view.includes('match-phase-spell-grid'))
  assert.ok(view.includes(':track-result="true"'))
  assert.ok(view.includes(':result="spellResult(rule)"'))
  assert.ok(view.includes('@result="setSpellResult(rule, $event)"'))
  assert.ok(view.includes('spellResultCheckId'))
  assert.ok(card.includes('>Successful</span>'))
  assert.ok(card.includes('>Failed</span>'))
})

test('Deployment Step 2 enforces group order instead of only sorting rows', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('function deploymentRankReady(rank: number)'))
  assert.ok(view.includes('function deploymentRowLocked(row: BuilderRosterSelection)'))
  assert.ok(view.includes('Complete the previous deployment group first.'))
  assert.ok(view.includes(':disabled="isReadOnly || deploymentRowLocked(row)'))
})

test('successful chargers are marked Charged in Combat Step 1', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('function unitChargedThisTurn(instanceId: string)'))
  assert.ok(view.includes('class="value-chip combat-charged-chip">Charged</span>'))
})

test('depleted limited-use actions lock their checkbox immediately', () => {
  const view = read('src/views/GameMatchView.vue')
  const start = view.indexOf('function guidanceDisabled')
  const end = view.indexOf('function toggleGuidanceCheck', start)
  const block = view.slice(start, end)
  assert.ok(block.includes('ruleUseRemaining(rule) === 0'))
  assert.equal(block.includes('&& !guidanceChecked'), false)
})

test('Movement Step 2 includes mutually exclusive In Combat and Stay states', () => {
  const view = read('src/views/GameMatchView.vue')
  const tracking = read('src/services/matchTracking.ts')
  assert.ok(tracking.includes('inCombat?: boolean'))
  assert.ok(view.includes('function setChargeInCombat'))
  assert.ok(view.includes('<span>In Combat</span>'))
  assert.ok(view.includes('<span>Stay</span>'))
  assert.ok(view.includes("chargeInCombat(rule.unitRefs?.[0]?.instanceId || '') || chargeDeclared"))
  assert.ok(view.includes("chargeHeld(rule.unitRefs?.[0]?.instanceId || '') || chargeInCombat"))
})

test('match Back and Next navigation uses compact bounded controls', () => {
  const view = read('src/views/GameMatchView.vue')
  const css = read('src/styles/match.css')
  assert.ok(view.includes("return 'Next'"))
  assert.ok(view.includes("return 'Start Battle'"))
  assert.ok(css.includes('.game-match-page .match-sticky-nav'))
  assert.ok(css.includes('min-width: 88px'))
  assert.ok(css.includes('max-width: min(180px, 42vw)'))
})

test('My Rosters consolidates transfer controls and saved entries use the requested action order', () => {
  const home = read('src/views/HomeView.vue')
  assert.ok(home.includes('>Filter</button>'))
  assert.ok(home.includes('>Import Roster</button>'))
  assert.ok(home.includes('>Export Roster</button>'))
  assert.ok(home.includes('Upload File'))
  assert.ok(home.includes('Paste Share Code'))
  assert.ok(home.includes('Download File'))
  assert.equal(home.includes('title="Delete rosters"'), false)
  const start = home.indexOf('<div class="saved-list-row-actions">')
  const end = home.indexOf('</div>', start)
  const row = home.slice(start, end)
  assert.ok(row.indexOf('View roster') < row.indexOf('Edit roster'))
  assert.ok(row.indexOf('Edit roster') < row.indexOf('roster-lock-action'))
  assert.ok(row.indexOf('roster-lock-action') < row.indexOf('Mark as Enemy Roster'))
  assert.ok(row.indexOf('Mark as Enemy Roster') < row.indexOf('Copy roster'))
  assert.ok(row.indexOf('Copy roster') < row.indexOf('Share roster'))
  assert.ok(row.indexOf('Share roster') < row.indexOf('roster-delete-action'))
  assert.equal(row.includes('Export roster'), false)
  assert.ok(home.includes('saved-list-name-points'))
  assert.equal(home.includes("rosterState(list).toUpperCase()"), false)
})



test('scenario round defaults prefer a stated minimum', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('function scenarioMinimumRounds'))
  assert.ok(view.includes('/between\\s+(\\d+)\\s+and\\s+(\\d+)\\s+rounds?/'))
  assert.ok(view.includes('/(\\d+)\\s*(?:-|to)\\s*(\\d+)\\s+rounds?/'))
  assert.ok(view.includes('scenarioMinimumRounds(text) ||'))
})

test('Setup spell select is lowered and spell type is ordered below the name', () => {
  const css = read('src/styles/match.css')
  assert.ok(css.includes('.match-spell-choice-shell > .match-spell-select { top: 15px; }'))
  assert.ok(css.includes('.old-rule-title-row { order: 1; }'))
  assert.ok(css.includes('.old-rule-pill-row { order: 2;'))
})

test('limited-use actions use a readable remaining-use status block', () => {
  const view = read('src/views/GameMatchView.vue')
  const css = read('src/styles/match.css')
  assert.ok(view.includes('class="tracked-use-status"'))
  assert.ok(view.includes('ruleUseRemaining(rule) ?? rule.useLimit'))
  assert.ok(css.includes('.tracked-use-status'))
  assert.ok(css.includes('font-size:calc(11px + var(--font-offset))'))
})

test('Total Power implies Miscast and source miscast outcomes can stop later casting', () => {
  const view = read('src/views/GameMatchView.vue')
  const tracking = read('src/services/matchTracking.ts')
  assert.ok(view.includes('<span>Total Power</span>'))
  assert.ok(view.includes('<span>Miscast</span>'))
  assert.ok(view.includes("totalPower: checked, miscast: checked ? true"))
  assert.ok(view.includes("loadRandomHappeningTable('/magic/miscast-table')"))
  assert.ok(view.includes('miscastCastingStop'))
  assert.ok(view.includes('wizardCannotCast'))
  assert.ok(tracking.includes('spellCasts: Record<string, MatchSpellCastState>'))
  assert.ok(tracking.includes("scope?: 'phase' | 'turn'"))
})

test('miscast level-loss handling can track forgotten known spells when the source rule requires it', () => {
  const view = read('src/views/GameMatchView.vue')
  const tracking = read('src/services/matchTracking.ts')
  assert.ok(view.includes('miscastLosesWizardLevel'))
  assert.ok(view.includes('Wizard Levels lost'))
  assert.ok(view.includes('knownSpellsForMiscast'))
  assert.ok(view.includes('setSpellForgottenForMiscast'))
  assert.ok(tracking.includes('forgottenSpellIds?: string[]'))
  assert.ok(tracking.includes('levelLost?: number'))
})

test('winning Combat follow-up choices mirror loss cards and explain tests', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('winner-follow-up-panel'))
  assert.ok(view.includes('break-outcome-card follow-up-outcome-card'))
  assert.ok(view.includes('Roll 2D6 and score'))
  assert.ok(view.includes('normal Pursuit roll'))
})

test('End of Round score is flattened into the step content', () => {
  const view = read('src/views/GameMatchView.vue')
  assert.ok(view.includes('class="end-round-score-content"'))
  assert.equal(view.includes('class="end-round-score-panel card-inset"'), false)
})

test('locked roster overview routes back to the Builder', () => {
  const router = read('src/router.ts')
  const home = read('src/views/HomeView.vue')
  assert.ok(router.includes("to.name === 'list-view'"))
  assert.ok(router.includes('if (list?.locked) return savedArmyListRoute(list)'))
  assert.ok(home.includes('function rosterOpenRoute(list: SavedArmyList)'))
  assert.ok(home.includes('list.locked ? savedArmyListRoute(list)'))
})

test('ongoing Battle Conditions sit below Tip panels and stay contained', () => {
  const view = read('src/views/GameMatchView.vue')
  const css = read('src/styles/match.css')
  const tip = view.indexOf('Tip — Start of Round')
  const ongoing = view.indexOf('OngoingBattleConditionsPanel', tip)
  assert.ok(tip >= 0 && ongoing > tip)
  assert.ok(css.includes('.ongoing-battle-conditions {'))
  assert.ok(css.includes('max-width: 100%'))
  assert.ok(css.includes('box-sizing: border-box'))
  assert.equal(css.includes('.ongoing-battle-conditions { margin-inline:10px; }'), false)
})

test('Miscast expansion does not stretch neighboring spell columns', () => {
  const css = read('src/styles/match.css')
  assert.ok(css.includes('grid-auto-rows: max-content'))
  assert.ok(css.includes('align-items: start'))
  assert.ok(css.includes('.match-phase-spell-entry { display:grid;align-self:start;'))
})

test('Combat Step 1 profile target excludes the checkbox area', () => {
  const view = read('src/views/GameMatchView.vue')
  const css = read('src/styles/match.css')
  assert.ok(view.includes('<label class="turn-action-check combat-fight-check">'))
  assert.ok(view.includes('<RouterLink class="combat-fight-unit-copy combat-fight-profile-area"'))
  assert.ok(css.includes('.combat-fight-profile-area'))
})

test('requested labels and text-link alignment are applied', () => {
  const nav = read('src/components/PrimaryNav.vue')
  const header = read('src/components/AppHeader.vue')
  const settings = read('src/views/SettingsView.vue')
  const theme = read('src/styles/theme.css')
  assert.ok(nav.includes('>Army Rosters</RouterLink>'))
  assert.ok(header.includes('aria-label="Old.dex Army Rosters"'))
  assert.ok(settings.includes('Adjust standard interface and rules-reader text.'))
  assert.ok(theme.includes('.create-list-cancel'))
  assert.ok(theme.includes('.settings-page .settings-compact-action'))
  assert.ok(theme.includes('justify-content: center'))
})



test('War Machines retain independent deployment state inside their shared stage', () => {
  const view = read('src/views/GameMatchView.vue')
  const start = view.indexOf('function toggleDeployedUnit')
  const end = view.indexOf('function handleDeployedUnit', start)
  const block = view.slice(start, end)
  assert.ok(block.includes('const ids = [instanceId]'))
  assert.equal(block.includes("playerRoster.value.filter((entry) => isWarMachine(entry)"), false)
  assert.ok(view.includes('WAR MACHINE · TRACK THIS UNIT SEPARATELY'))
})

test('Miscast parsing rejects the source table heading row', () => {
  const html = '<h1>Miscast Table</h1><table><tr><td>2D6</td><td>Result</td></tr><tr><td>2-4</td><td>Dimensional Cascade: Bad things happen.</td></tr><tr><td>5-6</td><td>Calamitous Detonation: More bad things happen.</td></tr></table>'
  const table = randomTables.parseRandomHappeningTable(html, '/magic/miscast-table')
  assert.deepEqual(table.results.map((row) => row.roll), ['2-4', '5-6'])
})

test('Charge roll sequence exposes Swiftstride and Waaagh Banner dice in order', () => {
  const swift = effects.chargeRangeContribution('Swiftstride', 'Swiftstride')
  const banner = effects.chargeRangeContribution('Waaagh! Banner', 'This unit increases its maximum possible charge range by 3" and adds +D3 to its Charge roll.')
  assert.equal(effects.formatChargeRollSequence([swift, banner].filter(Boolean)), 'Charge Roll > +D6 > +D3')
  const guidance = read('src/services/matchGuidance.ts')
  assert.ok(guidance.includes('chargeRollNote: formatChargeRollSequence(contributions)'))
})

test('required charge rows use orange emphasis and remove optional filler copy', () => {
  const view = read('src/views/GameMatchView.vue')
  const css = read('src/styles/match.css')
  assert.ok(view.includes('class="required-charge-label">MUST CHARGE IF POSSIBLE</small>'))
  assert.equal(view.includes('Declare this charge only if the unit is eligible and you choose to charge.'), false)
  assert.ok(css.includes('.required-charge-label'))
  assert.ok(css.includes('color: var(--accent)'))
})

test('joined Character charge rules dedupe by canonical visible rule identity', () => {
  const view = read('src/views/GameMatchView.vue')
  const start = view.indexOf('function matchRuleIdentity')
  const end = view.indexOf('function ordinaryDeploymentResolved', start)
  const block = view.slice(start, end)
  assert.ok(block.includes('return label || path'))
  assert.ok(block.includes('dedupeMatchRules'))
  assert.ok(block.includes('joinedCharacterChargeRules'))
  assert.ok(block.includes('chargeRelatedRules'))
})

test('match profile hydration preserves source-linked and older snapshot weapon upgrades', () => {
  const source = read('src/services/matchUnitProfiles.ts')
  assert.ok(source.includes('selectedByParent'))
  assert.ok(source.includes('selectedByLabel'))
  assert.ok(source.includes('weapon.requiresSelection'))
  assert.ok(source.includes('weaponIsEquipped'))
  assert.ok(source.includes('historic count field is absent'))
  const view = read('src/views/GameMatchView.vue')
  const ensureStart = view.indexOf('async function ensureCombatProfile')
  const ensureEnd = view.indexOf('function combatProfile', ensureStart)
  const ensureBlock = view.slice(ensureStart, ensureEnd)
  assert.ok(ensureBlock.includes('combatProfiles.value[row.instanceId]'))
  assert.equal(ensureBlock.includes('Object.prototype.hasOwnProperty'), false)
})

test('mounted rider profile names are not misclassified as mount profiles', () => {
  const core = read('src/core/profileEngine.ts')
  assert.ok(core.includes('mountedRiderPattern'))
  assert.ok(core.includes('const riderIdentity = isMountProfileName(profileName)'))
  assert.ok(core.includes('unitName.includes(normalized)'))
  assert.ok(core.includes('normalized === unitName || riderIdentity'))
})

test('match model profiles display roster-derived model quantities including champions and mounts', () => {
  const source = read('src/services/matchUnitProfiles.ts')
  const profile = read('src/views/MatchUnitProfileView.vue')
  assert.ok(source.includes('count: number'))
  assert.ok(source.includes("if (role === 'mount') return modelCount"))
  assert.ok(source.includes("if (role === 'champion' || role === 'special') return selectedProfileOptionCount(entry)"))
  assert.ok(source.includes('modelCount - championCount'))
  assert.ok(profile.includes('match-profile-model-count'))
  assert.ok(profile.includes('×{{ row.count }}'))
})

test('End of Round score and four actions use dedicated responsive geometry', () => {
  const css = read('src/styles/match.css')
  assert.ok(css.includes('.end-round-score-board'))
  assert.ok(css.includes('grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);'))
  assert.ok(css.includes('.end-round-actions'))
  assert.ok(css.includes('grid-template-columns: repeat(4, minmax(0, 1fr));'))
  assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'))
  assert.equal(css.includes('end-round-score-board { grid-template-columns: 1fr !important'), false)
})

test('Alpha 0.49 release metadata is synchronized', () => {
  assert.equal(JSON.parse(read('package.json')).version, '0.49.0')
  assert.ok(read('src/App.vue').includes('ALPHA BUILD 0.49'))
  assert.ok(read('src/components/AppHeader.vue').includes('ALPHA BUILD 0.49'))
  assert.ok(read('src/views/SettingsView.vue').includes('Site Changelog - Alpha 0.49'))
  assert.ok(read('public/sw.js').includes('v049'))
  assert.ok(read('src/data/changelogLatest.ts').includes("version: '0.49'"))
  assert.ok(read('src/data/changelogLatest.ts').includes("version: '0.48'"))
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1 }
  catch (error) { console.error(`FAIL: ${name}`); throw error }
}
console.log(`ODX 0.49 regressions passed: ${passed}/${tests.length}`)
