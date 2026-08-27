<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import MatchTipPanel from '../components/MatchTipPanel.vue'
import MatchSpellChoiceCard from '../components/MatchSpellChoiceCard.vue'
import { compositionOptions, compositionRuleLabel } from '../data/listBuilder'
import { completeSavedGame, deleteSavedGame, gameWorkflow, getSavedGame, resetSavedGame, updateSavedGame, type GameChargeTestResult, type GameMagicCaster, type GameMagicChoice, type GameOutcome, type GameSide, type SavedGame } from '../services/games'
import { getSavedArmyList } from '../services/savedLists'
import { hydrateFriendlyMagicSetup, loadMagicChoices, loadScenarioGuidance, magicSelectionLimit, randomHappeningOptions } from '../services/gameSetup'
import { loadMatchDeploymentGuidance, loadMatchStartRoundGuidance, loadMatchTurnGuidance, type MatchDeploymentGuidance, type MatchGuidanceRule, type MatchStartRoundRule } from '../services/matchGuidance'
import { isGameLocked } from '../services/gameLocks'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { clearMatchTracking, loadMatchTracking, saveMatchTracking, type MatchCombatDisposition, type MatchPersistentUnitState, type MatchTrackingState, type MatchTurnUnitState } from '../services/matchTracking'
import { loadMatchRosterProfile as loadMatchUnitProfile, type MatchUnitProfileSnapshot } from '../services/matchRosterProfiles'
import { breakTestBands } from '../core/breakTest'
import { shootingToHit } from '../core/shootingToHit'
import { enrichMagicChoices } from '../services/spellReference'
import { loadRandomHappeningTable, type RandomHappeningTable } from '../services/randomHappenings'
import { matchUseBucket } from '../core/matchUsage'

const route = useRoute()
const router = useRouter()
const game = ref<SavedGame | null>(getSavedGame(String(route.params.gameId || '')))
const magicCasters = ref<GameMagicCaster[]>([])
const magicLoading = ref(false)
const magicChoiceLoading = ref(new Set<string>())
const scenarioLoading = ref(false)
const deploymentLoading = ref(false)
const deploymentGuidance = ref<MatchDeploymentGuidance[]>([])
const startRoundLoading = ref(false)
const startRoundGuidance = ref<MatchStartRoundRule[]>([])
const turnGuidanceLoading = ref(false)
const turnGuidance = ref<MatchGuidanceRule[]>([])
const turnViewSide = ref<GameSide>(game.value?.activeSide || 'player')
const matchLocked = ref(Boolean(game.value && isGameLocked(game.value.id)))
const phaseTabsRef = ref<HTMLElement | null>(null)
const stepTabsRef = ref<HTMLElement | null>(null)
const matchTracking = ref<MatchTrackingState>(loadMatchTracking(game.value?.id || ''))
const combatProfiles = ref<Record<string, MatchUnitProfileSnapshot | null>>({})
const combatProfileLoading = ref(new Set<string>())
const randomHappeningTables = ref<Record<string, RandomHappeningTable | null>>({})
const randomHappeningLoading = ref(new Set<string>())
let turnGuidanceRequest = 0

const phase = computed(() => game.value ? gameWorkflow[Math.min(game.value.phaseIndex, gameWorkflow.length - 1)] : null)
const step = computed(() => phase.value && game.value ? phase.value.steps[Math.min(game.value.stepIndex, phase.value.steps.length - 1)] : null)
const isReadOnly = computed(() => game.value?.status === 'complete' || matchLocked.value)
const isSetupArmiesStep = computed(() => phase.value?.id === 'setup' && step.value?.id === 'armies-battle')
const isSetupSpellsStep = computed(() => phase.value?.id === 'setup' && step.value?.id === 'spells')
const isOverviewStep = computed(() => phase.value?.id === 'overview')
const isDeploymentOrderStep = computed(() => phase.value?.id === 'deployment' && step.value?.id === 'deployment-order')
const isDeployArmiesStep = computed(() => phase.value?.id === 'deployment' && step.value?.id === 'deploy-armies')
const isRoundStartStep = computed(() => phase.value?.id === 'round-start')
const isRoundBattleEffectsStep = computed(() => phase.value?.id === 'round-start' && step.value?.id === 'round-battle-effects')
const isRoundPlayerEffectsStep = computed(() => phase.value?.id === 'round-start' && step.value?.id === 'round-player-effects')
const battleTurnPhaseIds = new Set(['strategy', 'movement', 'shooting', 'combat', 'end'])
const isBattleTurnPhase = computed(() => Boolean(phase.value && battleTurnPhaseIds.has(phase.value.id)))
const isEndScoreStep = computed(() => phase.value?.id === 'end' && step.value?.id === 'round-score')
const isCombatFightStep = computed(() => phase.value?.id === 'combat' && step.value?.id === 'fight')
const roundStartPhaseIndex = computed(() => Math.max(0, gameWorkflow.findIndex((item) => item.id === 'round-start')))
const strategyPhaseIndex = computed(() => Math.max(0, gameWorkflow.findIndex((item) => item.id === 'strategy')))
const checklistKey = computed(() => game.value && phase.value && step.value ? `${game.value.round}:${turnViewSide.value}:${phase.value.id}:${step.value.id}` : '')
const isRequiredChargeStep = computed(() => phase.value?.id === 'movement' && step.value?.id === 'required-charges' && turnViewSide.value === 'player')
const isAnyDeclareChargeStep = computed(() => phase.value?.id === 'movement' && step.value?.id === 'declare-charges')
const isDeclareChargeStep = computed(() => isAnyDeclareChargeStep.value && turnViewSide.value === 'player')
const isEnemyDeclareChargeStep = computed(() => isAnyDeclareChargeStep.value && turnViewSide.value === 'opponent')
const isCompulsoryMoveStep = computed(() => phase.value?.id === 'movement' && step.value?.id === 'compulsory-moves' && turnViewSide.value === 'player')
const isRemainingMoveStep = computed(() => phase.value?.id === 'movement' && step.value?.id === 'remaining-moves' && turnViewSide.value === 'player')
const isShootingStep = computed(() => phase.value?.id === 'shooting' && step.value?.id === 'shooting' && turnViewSide.value === 'player')
const isCombatResultStep = computed(() => phase.value?.id === 'combat' && step.value?.id === 'combat-result')
const isRallyStep = computed(() => phase.value?.id === 'strategy' && step.value?.id === 'rally' && turnViewSide.value === 'player')

const playerListFallback = computed(() => game.value ? getSavedArmyList(game.value.playerListId) : null)
const opponentListFallback = computed(() => game.value?.opponentListId ? getSavedArmyList(game.value.opponentListId) : null)
const playerRoster = computed(() => game.value?.playerRoster?.length ? game.value.playerRoster : (playerListFallback.value?.roster || []))
const opponentRoster = computed(() => game.value?.opponentRoster?.length ? game.value.opponentRoster : (opponentListFallback.value?.roster || []))
const characterRows = computed(() => playerRoster.value.filter((row) => String(row.category || '').toLowerCase().includes('character')))
const joinedCharacters = computed(() => matchTracking.value.joinedCharacters)
const playerActualPoints = computed(() => playerRoster.value.reduce((sum, row) => sum + Number(row.totalPoints || 0), 0))
const opponentActualPoints = computed(() => opponentRoster.value.reduce((sum, row) => sum + Number(row.totalPoints || 0), 0))
const playerCompositionName = computed(() => game.value?.playerCompositionName || playerListFallback.value?.compositionName || '—')
const opponentCompositionName = computed(() => game.value?.opponentCompositionName || opponentListFallback.value?.compositionName || '—')
const playerCompositionRule = computed(() => compositionRuleLabel(game.value?.playerCompositionRule || playerListFallback.value?.rule || 'open-war'))
const opponentCompositionRule = computed(() => { const rule = game.value?.opponentCompositionRule || opponentListFallback.value?.rule || ''; return rule ? compositionRuleLabel(rule) : '—' })
const playerOptionLabels = computed(() => (game.value?.playerOptions || playerListFallback.value?.options || []).map((id) => compositionOptions.find((option) => option.value === id)?.label || id))
const opponentOptionLabels = computed(() => (game.value?.opponentOptions || opponentListFallback.value?.options || []).map((id) => compositionOptions.find((option) => option.value === id)?.label || id))

const roundLimit = computed(() => Math.max(1, Number(game.value?.roundLimit || game.value?.scenarioGuidance?.roundLimit || 4)))
const battleStarted = computed(() => Boolean(game.value?.battleStarted))
const roundsComplete = computed(() => Boolean(game.value && game.value.roundsCompleted >= roundLimit.value))
const battleMarchEnabled = computed(() => String(game.value?.playerCompositionRule || playerListFallback.value?.rule || '').toLowerCase() === 'battle-march' || playerCompositionRule.value.toLowerCase().includes('battle march'))
const selectedBattlefieldConditions = computed(() => new Set(game.value?.battlefieldConditions || []))
const battlefieldConditionRows = computed(() => randomHappeningOptions.filter((option) => selectedBattlefieldConditions.value.has(option.id)))
const deploymentBattlefieldConditions = computed(() => battlefieldConditionRows.value.filter((option) => option.id === 'disruptive-weather'))
const wildernessTerrainSelected = computed(() => selectedBattlefieldConditions.value.has('wilderness-terrain'))
const chaosOfWarSelected = computed(() => selectedBattlefieldConditions.value.has('chaos-of-war'))
const chaosOfWarSide = computed<GameSide>(() => game.value?.firstPlayerConfirmed ? game.value.firstPlayer : 'player')
const showChaosOfWarResolution = computed(() => Boolean(chaosOfWarSelected.value && phase.value?.id === 'strategy' && step.value?.id === 'start-of-turn' && game.value && game.value.round >= 2 && turnViewSide.value === chaosOfWarSide.value))
const chaosOfWarResultKey = computed(() => `chaos-of-war:round-${game.value?.round || 0}`)
const disruptiveWeatherPending = computed(() => selectedBattlefieldConditions.value.has('disruptive-weather') && !battlefieldResult('disruptive-weather'))
const chaosOfWarPreviousRolls = computed(() => {
  const results = game.value?.battlefieldConditionResults || {}
  return new Set(Object.entries(results).filter(([key]) => /^chaos-of-war:round-\d+$/.test(key) && key !== chaosOfWarResultKey.value).map(([, roll]) => String(roll)))
})
const scenarioGuidance = computed(() => game.value?.scenarioGuidance || null)
const deployedPlayerIds = computed(() => new Set(game.value?.deployedPlayerIds || []))
const reservePlayerIds = computed(() => new Set(game.value?.reservePlayerIds || []))
const deploymentGuidanceMap = computed(() => new Map(deploymentGuidance.value.map((row) => [row.instanceId, row])))
const deploymentFriendlyCount = computed(() => playerRoster.value.filter((row) => deployedPlayerIds.value.has(row.instanceId)).length)
const friendlyStartRoundRules = computed(() => startRoundGuidance.value.filter((row) => row.side === 'player'))
const enemyStartRoundRules = computed(() => startRoundGuidance.value.filter((row) => row.side === 'opponent'))
const battleStartRoundRules = computed(() => startRoundGuidance.value.filter((row) => row.side === 'battle'))
const friendlyTurnGuidance = computed(() => turnGuidance.value.filter((row) => row.side !== 'battle'))
const battleTurnGuidance = computed(() => turnGuidance.value.filter((row) => row.side === 'battle'))
const battleTurnGuidanceDisplay = computed(() => {
  const seen = new Set<string>()
  return battleTurnGuidance.value.filter((rule) => {
    const key = rule.sourceKind === 'battlefield' ? `battlefield|${rule.path || rule.label}` : `${rule.sourceKind}|${rule.label}|${rule.path || ''}|${rule.summary}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})
const spellGuidance = computed(() => friendlyTurnGuidance.value.filter((row) => row.action === 'spell'))
const friendlyActionGuidance = computed(() => friendlyTurnGuidance.value.filter((row) => row.action !== 'spell'))
const allDeclareChargeGuidance = computed(() => isDeclareChargeStep.value ? friendlyActionGuidance.value.filter((row) => row.action === 'declare-charge') : [])
const declareChargeGuidance = computed(() => allDeclareChargeGuidance.value.filter((row) => !isJoinedCharacterId(row.unitRefs?.[0]?.instanceId || '')))
const requiredChargeRuleGuidance = computed(() => isRequiredChargeStep.value ? friendlyActionGuidance.value.filter((row) => row.action !== 'declare-charge') : [])
const normalFriendlyGuidance = computed(() => isRequiredChargeStep.value ? [] : friendlyActionGuidance.value.filter((row) => row.action !== 'declare-charge'))
const requiredChargeUnits = computed(() => {
  const seen = new Set<string>()
  return requiredChargeRuleGuidance.value.filter((rule) => rule.action === 'required-charge-test').flatMap((rule) => rule.unitRefs || []).filter((unit) => { if (seen.has(unit.instanceId)) return false; seen.add(unit.instanceId); return true })
})
const fleeingUnits = computed(() => playerRoster.value.filter((row) => Boolean(persistentUnitState(row.instanceId).fleeing) && !unitEliminated(row)))
const compulsoryMovementUnits = computed(() => {
  if (!isCompulsoryMoveStep.value) return [] as BuilderRosterSelection[]
  const ids = new Set(friendlyActionGuidance.value.flatMap((rule) => rule.unitRefs || []).map((unit) => unit.instanceId))
  for (const unit of fleeingUnits.value) ids.add(unit.instanceId)
  return playerRoster.value.filter((row) => ids.has(row.instanceId) && !isJoinedCharacterId(row.instanceId))
})
const remainingMoveUnits = computed(() => {
  if (!isRemainingMoveStep.value) return [] as BuilderRosterSelection[]
  return playerRoster.value.filter((row) => {
    if (isJoinedCharacterId(row.instanceId)) return false
    if (reservePlayerIds.value.has(row.instanceId)) return false
    const state = unitTurnState(row.instanceId)
    return !state.chargeDeclared && !state.compulsoryMoved
  })
})
const enemyChargeReactionUnits = computed(() => isEnemyDeclareChargeStep.value ? playerRoster.value.filter((row) => !isJoinedCharacterId(row.instanceId)) : [])
const shootingUnits = computed(() => {
  if (!isShootingStep.value) return [] as Array<{ unit: BuilderRosterSelection; weapons: NonNullable<MatchUnitProfileSnapshot>['weapons'] }>
  return playerRoster.value.map((unit) => ({ unit, weapons: (combatProfiles.value[unit.instanceId]?.weapons || []).filter((weapon) => weapon.kind === 'missile') })).filter((row) => row.weapons.length > 0)
})
const combatFightUnits = computed(() => playerRoster.value.filter((row) => !reservePlayerIds.value.has(row.instanceId) && !unitEliminated(row)))
const foughtUnits = computed(() => playerRoster.value.filter((row) => foughtInCombat(row.instanceId)))
const turnContextLabel = computed(() => turnViewSide.value === 'opponent' ? "Enemy's Turn" : 'Friendly Turn')
const showGenericActionPanel = computed(() => !isAnyDeclareChargeStep.value && !isCombatFightStep.value && !isCombatResultStep.value)
const currentTipKey = computed(() => phase.value && step.value ? `${phase.value.id}:${step.value.id}` : '')
const tipsVisible = computed(() => !matchTracking.value.tipsHidden)
const currentTipCollapsed = computed(() => Boolean(currentTipKey.value && matchTracking.value.collapsedTips?.[currentTipKey.value]))
const fatedDispelUsedThisRound = computed(() => Boolean(game.value && matchTracking.value.fatedDispelUsedRound === game.value.round))
const phaseStepLabel = computed(() => game.value && phase.value && step.value ? `ROUND ${game.value.round} · ${phase.value.label.toUpperCase()} · STEP ${game.value.stepIndex + 1} OF ${phase.value.steps.length}` : '')
const spellPanelTitles: Record<string, string> = { conjuration: 'Enchantment & Hex Spells', 'remaining-moves': 'Conveyance Spells', 'special-shooting': 'Magic Missiles & Magical Vortexes', fight: 'Assailment Spells' }
const spellPanelTitle = computed(() => spellPanelTitles[step.value?.id || ''] || 'Available Spells')
const spellPanelEyebrow = computed(() => phase.value?.id === 'combat' ? 'COMBAT MAGIC' : phase.value?.id === 'shooting' ? 'SHOOTING MAGIC' : phase.value?.id === 'movement' ? 'MOVEMENT MAGIC' : 'MAGIC')
const battleStepTip = computed(() => {
  const tips: Record<string, string> = {
    'start-of-turn': 'Resolve effects that explicitly happen at the start of the turn before moving into Command. Move any active Magical Vortexes when their rules instruct.',
    command: 'Resolve rules and abilities that say they are used during the Command sub-phase. Complete these before Conjuration.',
    conjuration: 'Attempt eligible Enchantment and Hex spells with the Wizards that know them, resolving casting and dispelling before moving on.',
    rally: 'Take Rally tests for fleeing friendly units and resolve any rules that specifically trigger during the Rallying Fleeing Troops sub-phase.',
    'required-charges': 'Before declaring charges, resolve compulsory tests such as Impetuous. If a test is failed, that unit must declare a charge if a legal target is available.',
    'declare-charges': 'Resolve charges one at a time. Declare a target, make the Charge roll, complete the Charge Move or failed charge, resolve any unit-specific charge rules, then declare the next charge. Old.dex includes detected maximum-range modifiers in the range shown below.',
    'charge-moves': 'Resolve declared charges one at a time, including charge rolls, failed charges and any effects that trigger while making a Charge Move.',
    'compulsory-moves': 'Resolve fleeing units, Random Movement, reserves and other compulsory movement before ordinary Remaining Moves.',
    'remaining-moves': 'Move units that have not already moved, then attempt eligible Conveyance spells when their rules allow.',
    'special-shooting': 'Resolve eligible Magic Missiles, Magical Vortexes and other special Shooting-phase actions before ordinary missile attacks.',
    shooting: 'Choose an eligible unit, declare its target, resolve To Hit and To Wound rolls, saves and casualties, then continue to the next shooter.',
    fight: 'Choose a combat and resolve attacks in Initiative order. Assailment spells available to your Wizards are shown with the other Combat actions.',
    'combat-result': 'After both sides have fought, record persistent casualties or wounds, determine each combat result, then resolve losing-unit Break Tests and the winner’s follow-up response before moving to the next combat.',
    'follow-up': 'Resolve Give Ground, Fall Back in Good Order, fleeing, restraint, follow up, pursuit and overrun as required by the combat result.',
    'end-effects': 'Resolve only effects that explicitly trigger or expire at the end of the round before calculating the round score.',
    'round-score': 'Record scenario scoring and the running score, then end the round or choose the next turn as appropriate.',
  }
  return tips[step.value?.id || ''] || ''
})
const battleStepRulePaths: Record<string, string> = {
  'start-of-turn': '/the-strategy-phase/start-of-turn', command: '/the-strategy-phase/command', conjuration: '/the-strategy-phase/conjuration', rally: '/the-strategy-phase/rally-fleeing-units',
  'required-charges': '/the-movement-phase/declare-charges-and-charge-reactions', 'declare-charges': '/the-movement-phase/declare-charges-and-charge-reactions', 'charge-moves': '/the-movement-phase/charge-moves', 'compulsory-moves': '/the-movement-phase/compulsory-moves', 'remaining-moves': '/the-movement-phase/remaining-moves',
  'special-shooting': '/the-shooting-phase/the-shooting-phase-sequence', shooting: '/the-shooting-phase/the-shooting-phase-sequence',
  fight: '/the-combat-phase/choose-and-fight-combat', 'combat-result': '/the-combat-phase/calculate-combat-result', 'follow-up': '/the-combat-phase/follow-up-and-pursuit',
}
const battleStepRulePath = computed(() => battleStepRulePaths[step.value?.id || ''] || '/the-turn-sequence')
const standardFirstTurnText = 'If the scenario gives no different procedure, roll off after deployment. In matched play, the player who finished deploying first (including units deployed using Scouts) adds +1 to the roll; the winner chooses who takes the first turn.'
const firstTurnProcedureText = computed(() => scenarioGuidance.value?.firstTurnText || standardFirstTurnText)

watch(() => game.value?.activeSide, (side) => { if (side) turnViewSide.value = side }, { immediate: true })
watch(() => step.value?.id, () => { if (isSetupSpellsStep.value) void preloadMagicChoices() })
watch(() => [phase.value?.id, step.value?.id, turnViewSide.value], () => {
  if (isDeployArmiesStep.value) void hydrateDeploymentGuidance()
  if (isRoundStartStep.value) void hydrateStartRoundGuidance()
  if (isBattleTurnPhase.value) void hydrateTurnGuidance()
  else { turnGuidanceRequest += 1; turnGuidance.value = []; turnGuidanceLoading.value = false }
}, { immediate: true })
watch(() => [isCombatResultStep.value, foughtUnits.value.map((row) => row.instanceId).join('|')], () => {
  if (!isCombatResultStep.value) return
  for (const row of foughtUnits.value) void ensureCombatProfile(row)
})
watch(() => [isShootingStep.value, isEnemyDeclareChargeStep.value, isRemainingMoveStep.value, isCombatFightStep.value, isRallyStep.value, isRequiredChargeStep.value], () => {
  if (!isShootingStep.value && !isEnemyDeclareChargeStep.value && !isRemainingMoveStep.value && !isCombatFightStep.value && !isRallyStep.value && !isRequiredChargeStep.value) return
  for (const row of playerRoster.value) void ensureCombatProfile(row)
}, { immediate: true })
watch(() => [...selectedBattlefieldConditions.value].sort().join('|'), () => { for (const id of selectedBattlefieldConditions.value) void ensureRandomHappeningTable(id) }, { immediate: true })

function persist(patch: Partial<Omit<SavedGame, 'id' | 'createdAt'>> = {}) { if (!game.value) return; const updated = updateSavedGame(game.value.id, patch); if (updated) game.value = updated }

function saveTracking(next: MatchTrackingState) {
  if (!game.value) return
  matchTracking.value = next
  saveMatchTracking(game.value.id, next)
}
function mutateTracking(change: (next: MatchTrackingState) => void) {
  const next: MatchTrackingState = JSON.parse(JSON.stringify(matchTracking.value)) as MatchTrackingState
  change(next)
  saveTracking(next)
}
function setTipsVisible(visible: boolean) {
  if (isReadOnly.value) return
  mutateTracking((next) => { next.tipsHidden = !visible })
}
function setCurrentTipCollapsed(collapsed: boolean) {
  if (isReadOnly.value || !currentTipKey.value) return
  mutateTracking((next) => {
    next.collapsedTips = { ...(next.collapsedTips || {}), [currentTipKey.value]: collapsed }
  })
}
function trackingTurnKey() { return game.value ? `${game.value.round}:${turnViewSide.value}` : '' }
function unitTurnState(instanceId: string): MatchTurnUnitState {
  const key = trackingTurnKey()
  return key ? matchTracking.value.turns[key]?.[instanceId] || {} : {}
}
function patchUnitTurnState(instanceId: string, patch: Partial<MatchTurnUnitState>) {
  if (!game.value || isReadOnly.value) return
  const key = trackingTurnKey()
  if (!key) return
  mutateTracking((next) => {
    const group = { ...(next.turns[key] || {}) }
    group[instanceId] = { ...(group[instanceId] || {}), ...patch }
    next.turns[key] = group
  })
}
function persistentUnitState(instanceId: string): MatchPersistentUnitState { return matchTracking.value.units?.[instanceId] || {} }
function patchPersistentUnitState(instanceId: string, patch: Partial<MatchPersistentUnitState>) {
  if (!game.value || isReadOnly.value) return
  mutateTracking((next) => { next.units[instanceId] = { ...(next.units[instanceId] || {}), ...patch } })
}
function isCharacter(row: BuilderRosterSelection) { return String(row.category || '').toLowerCase().includes('character') }
function unitHasRule(row: BuilderRosterSelection, pattern: RegExp) { return (row.specialRules || []).some((rule) => pattern.test(String(rule.label || ''))) }
function troopSubtype(row: BuilderRosterSelection) { return String(row.troopType || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function isWarMachine(row: BuilderRosterSelection) { return /war machine|warmachine/i.test(String(row.troopType || '')) }
function isScoutUnit(row: BuilderRosterSelection) { return unitHasRule(row, /^Scouts?(?:\s|\(|$)/i) }
function deploymentSequenceRank(row: BuilderRosterSelection) {
  if (isScoutUnit(row)) return 3
  if (isCharacter(row)) return 2
  if (isWarMachine(row)) return 1
  return 0
}
function deploymentSequenceLabel(row: BuilderRosterSelection) {
  const rank = deploymentSequenceRank(row)
  if (rank === 3) return isCharacter(row) ? 'SCOUT CHARACTER · SPECIAL DEPLOYMENT LAST' : 'SCOUTS · NORMAL DEPLOYMENT OR USE SCOUTS LATER'
  if (rank === 2) return 'CHARACTERS · DEPLOY LAST'
  if (rank === 1) return 'WAR MACHINES · ONE DEPLOYMENT'
  return 'UNITS · ALTERNATING DEPLOYMENT'
}
const deploymentRosterRows = computed(() => playerRoster.value.map((row, index) => ({ row, index })).sort((a, b) => deploymentSequenceRank(a.row) - deploymentSequenceRank(b.row) || a.index - b.index).map((entry) => entry.row))
const deploymentRosterGroups = computed(() => [
  { id: 'units', label: '1 · UNITS', detail: 'Alternating ordinary deployment', rows: deploymentRosterRows.value.filter((row) => deploymentSequenceRank(row) === 0) },
  { id: 'war-machines', label: '2 · WAR MACHINES', detail: 'Place the army’s War Machines together', rows: deploymentRosterRows.value.filter((row) => deploymentSequenceRank(row) === 1) },
  { id: 'characters', label: '3 · CHARACTERS', detail: 'Deploy after ordinary units and War Machines', rows: deploymentRosterRows.value.filter((row) => deploymentSequenceRank(row) === 2) },
  { id: 'scouts', label: '4 · SCOUTS / SPECIAL DEPLOYMENT', detail: 'Resolve Scouts after normal deployment when using their special deployment', rows: deploymentRosterRows.value.filter((row) => deploymentSequenceRank(row) === 3) },
].filter((group) => group.rows.length))

function deploymentRowResolved(row: BuilderRosterSelection) {
  return deployedPlayerIds.value.has(row.instanceId) || reservePlayerIds.value.has(row.instanceId)
}
function deploymentRankReady(rank: number) {
  return deploymentRosterRows.value.filter((row) => deploymentSequenceRank(row) < rank).every(deploymentRowResolved)
}
function deploymentRowLocked(row: BuilderRosterSelection) {
  return !deploymentRankReady(deploymentSequenceRank(row))
}

function sameJoinParityRule(character: BuilderRosterSelection, host: BuilderRosterSelection, pattern: RegExp) {
  return unitHasRule(character, pattern) === unitHasRule(host, pattern)
}
function canCharacterJoin(character: BuilderRosterSelection, host: BuilderRosterSelection) {
  if (!isCharacter(character) || isCharacter(host) || character.instanceId === host.instanceId) return false
  if (unitHasRule(character, /^Lumbering(?:\s|\(|$)/i) || unitHasRule(host, /^Lumbering(?:\s|\(|$)/i)) return false
  for (const parity of [/^Loner(?:\s|\(|$)/i, /^Warp-spawned(?:\s|\(|$)/i, /^Daemonic(?:\s|\(|$)/i, /^Unbreakable(?:\s|\(|$)/i, /^Nehekharan Undead(?:\s|\(|$)/i, /^Ethereal(?:\s|\(|$)/i, /^Fly(?:\s|\(|$)/i]) {
    if (!sameJoinParityRule(character, host, parity)) return false
  }
  // Skirmishers are the important troop-type exception: a character joining
  // them must be the same troop sub-category. Normal units do not require an
  // exact infantry/cavalry class match merely because the character is mounted.
  if (unitHasRule(host, /^Skirmishers?(?:\s|\(|$)/i) && troopSubtype(character) !== troopSubtype(host)) return false
  return true
}
function joinableHostsForCharacter(character: BuilderRosterSelection) { return playerRoster.value.filter((host) => canCharacterJoin(character, host)) }
function joinedHostId(characterId: string) { return joinedCharacters.value[characterId] || '' }
function isJoinedCharacterId(instanceId: string) { return Boolean(joinedCharacters.value[instanceId]) }
function joinedCharactersForHost(hostId: string) { return characterRows.value.filter((row) => joinedHostId(row.instanceId) === hostId) }
function joinedHostName(characterId: string) { const host = playerRoster.value.find((row) => row.instanceId === joinedHostId(characterId)); return host?.name || '' }
function joinedCharacterChargeRules(hostId: string) {
  const ids = new Set(joinedCharactersForHost(hostId).map((row) => row.instanceId))
  const seen = new Set<string>()
  return allDeclareChargeGuidance.value
    .filter((rule) => ids.has(rule.unitRefs?.[0]?.instanceId || ''))
    .flatMap((rule) => rule.relatedRules || [])
    .filter((rule) => { const key = `${rule.label}|${rule.path || ''}|${rule.summary}`.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true })
}
function chargeRelatedRules(rule: MatchGuidanceRule) {
  const hostId = rule.unitRefs?.[0]?.instanceId || ''
  const rows = [...(rule.relatedRules || []), ...joinedCharacterChargeRules(hostId)]
  const seen = new Set<string>()
  return rows.filter((entry) => {
    const key = `${entry.label}|${entry.path || ''}|${entry.summary}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
function ordinaryDeploymentResolved(deployed: Set<string>, reserves: Set<string>) {
  return playerRoster.value.filter((row) => !isCharacter(row) && !isScoutUnit(row)).every((row) => deployed.has(row.instanceId) || reserves.has(row.instanceId))
}
function syncJoinedCharacterDeployment(deployed: Set<string>, reserves: Set<string>) {
  if (!ordinaryDeploymentResolved(deployed, reserves)) return false
  let changed = false
  for (const character of characterRows.value) {
    const hostId = joinedHostId(character.instanceId)
    if (!hostId) continue
    if (reserves.has(hostId)) {
      if (!reserves.has(character.instanceId)) { reserves.add(character.instanceId); changed = true }
      if (deployed.delete(character.instanceId)) changed = true
    } else if (deployed.has(hostId)) {
      if (!deployed.has(character.instanceId)) { deployed.add(character.instanceId); changed = true }
      if (reserves.delete(character.instanceId)) changed = true
    }
  }
  return changed
}
function syncJoinedCharacterDeploymentFromGame() {
  if (!game.value) return
  const deployed = new Set(game.value.deployedPlayerIds || [])
  const reserves = new Set(game.value.reservePlayerIds || [])
  if (syncJoinedCharacterDeployment(deployed, reserves)) persist({ deployedPlayerIds: [...deployed], reservePlayerIds: [...reserves] })
}
function setCharacterHost(characterId: string, hostId: string) {
  if (!game.value || isReadOnly.value) return
  mutateTracking((next) => { if (hostId) next.joinedCharacters[characterId] = hostId; else delete next.joinedCharacters[characterId] })
  if (hostId) syncJoinedCharacterDeploymentFromGame()
}
function handleCharacterHost(characterId: string, event: Event) { setCharacterHost(characterId, (event.target as HTMLSelectElement).value) }
function leaveCharacter(characterId: string) { setCharacterHost(characterId, '') }
function chargeDeclared(instanceId: string) { return Boolean(unitTurnState(instanceId).chargeDeclared) }
function chargeHeld(instanceId: string) { return Boolean(unitTurnState(instanceId).chargeHeld) }
function chargeSuccessful(instanceId: string) { return Boolean(unitTurnState(instanceId).chargeSuccessful) }
function chargeInCombat(instanceId: string) { return Boolean(unitTurnState(instanceId).inCombat) }
function setChargeHeld(instanceId: string, checked: boolean) {
  patchUnitTurnState(instanceId, { chargeHeld: checked, ...(checked ? { inCombat: false, chargeDeclared: false, chargeSuccessful: false } : {}) })
}
function setChargeInCombat(instanceId: string, checked: boolean) {
  patchUnitTurnState(instanceId, { inCombat: checked, ...(checked ? { chargeHeld: false, chargeDeclared: false, chargeSuccessful: false } : {}) })
}
function setChargeDeclared(instanceId: string, checked: boolean) {
  const state = unitTurnState(instanceId)
  patchUnitTurnState(instanceId, { chargeDeclared: checked, inCombat: checked ? false : state.inCombat, chargeHeld: checked ? false : state.chargeHeld, chargeSuccessful: checked ? state.chargeSuccessful : false })
  if (checked) recordHistory('charge', instanceId, 'declared')
}
function recordHistory(kind: 'charge' | 'combat', instanceId: string, result: string, detail = '') {
  if (!game.value) return
  mutateTracking((next) => {
    const target = kind === 'charge' ? next.chargeHistory : next.combatHistory
    target.push({ round: game.value!.round, side: turnViewSide.value, instanceId, result, detail: detail || undefined })
    if (target.length > 500) target.splice(0, target.length - 500)
  })
}
function setChargeSuccessful(instanceId: string, checked: boolean) {
  patchUnitTurnState(instanceId, { inCombat: false, chargeHeld: false, chargeDeclared: checked || chargeDeclared(instanceId), chargeSuccessful: checked })
  if (checked) recordHistory('charge', instanceId, 'successful')
}
function unitChargedThisTurn(instanceId: string) {
  if (chargeSuccessful(instanceId)) return true
  const hostId = joinedHostId(instanceId)
  return Boolean(hostId && chargeSuccessful(hostId))
}
function chargeReaction(instanceId: string) { return unitTurnState(instanceId).chargeReaction || '' }
function chargeReactionLabel(value: MatchTurnUnitState['chargeReaction']) {
  if (value === 'stand-shoot') return 'Stand & Shoot'
  if (value === 'counter-charge') return 'Counter Charge'
  if (value === 'hold') return 'Hold'
  if (value === 'flee') return 'Flee'
  return ''
}
function setFleeing(instanceId: string, fleeing: boolean) {
  patchPersistentUnitState(instanceId, { fleeing, fleeingSinceRound: fleeing ? game.value?.round : undefined })
}
function setChargeReaction(instanceId: string, reaction: 'hold' | 'stand-shoot' | 'flee' | 'counter-charge', checked: boolean) {
  patchUnitTurnState(instanceId, { chargeReaction: checked ? reaction : (chargeReaction(instanceId) === reaction ? '' : chargeReaction(instanceId)) })
  if (reaction === 'flee') setFleeing(instanceId, checked)
}
function missileWeaponsForUnit(instanceId: string) { return (combatProfiles.value[instanceId]?.weapons || []).filter((weapon) => weapon.kind === 'missile') }
function unitHasCounterCharge(instanceId: string) {
  const host = playerRoster.value.find((row) => row.instanceId === instanceId)
  const rules = [...(host?.specialRules || []), ...joinedCharactersForHost(instanceId).flatMap((row) => row.specialRules || [])]
  return rules.some((rule) => /^Counter Charge(?:\s|\(|$)/i.test(rule.label))
}
function chargeReactionRules(instanceId: string) {
  const ids = new Set([instanceId, ...joinedCharactersForHost(instanceId).map((row) => row.instanceId)])
  const seen = new Set<string>()
  return turnGuidance.value.filter((rule) => rule.intent === 'reaction' && rule.sourceKind !== 'core' && (rule.unitRefs || []).some((ref) => ids.has(ref.instanceId))).filter((rule) => {
    const key = `${rule.label}|${rule.path || ''}|${rule.summary}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
function compulsoryMoved(instanceId: string) { return Boolean(unitTurnState(instanceId).compulsoryMoved) }
function setCompulsoryMoved(instanceId: string, checked: boolean) { patchUnitTurnState(instanceId, { compulsoryMoved: checked }) }
type RemainingMoveMode = 'normal' | 'march' | 'hold' | ''
function remainingMoveMode(instanceId: string): RemainingMoveMode { return unitTurnState(instanceId).remainingMoveMode || '' }
function setRemainingMoveMode(instanceId: string, mode: Exclude<RemainingMoveMode, ''>, checked: boolean) {
  const nextMode: RemainingMoveMode = checked ? mode : (remainingMoveMode(instanceId) === mode ? '' : remainingMoveMode(instanceId))
  patchUnitTurnState(instanceId, { remainingMoveMode: nextMode, remainingMoved: Boolean(nextMode) })
}
function profileCharacteristic(instanceId: string, key: 'M' | 'BS' | 'Ld') {
  const values = (combatProfile(instanceId)?.rows || []).map((row) => Number.parseInt(String(row.profile[key] || ''), 10)).filter((value) => Number.isFinite(value) && value >= 0)
  return values.length ? Math.max(...values) : 0
}
function movementCharacteristic(unit: BuilderRosterSelection) {
  const stored = Number(unit.movement || 0)
  if (Number.isFinite(stored) && stored > 0) return stored
  return profileCharacteristic(unit.instanceId, 'M')
}
function remainingMoveDistance(unit: BuilderRosterSelection, mode: Exclude<RemainingMoveMode, ''>) {
  const movement = movementCharacteristic(unit)
  if (mode === 'hold') return ''
  if (!movement) return combatProfileLoading.value.has(unit.instanceId) ? 'Loading...' : '—'
  return `${mode === 'march' ? movement * 2 : movement}"`
}
const shootingPenaltyOptions = [
  { id: 'moving', label: 'Moving and Shooting', modifier: -1 },
  { id: 'long-range', label: 'Firing at Long Range', modifier: -1 },
  { id: 'stand-shoot', label: 'Standing and Shooting', modifier: -1 },
  { id: 'partial-cover', label: 'Target Behind Partial Cover', modifier: -1 },
  { id: 'full-cover', label: 'Target Behind Full Cover', modifier: -2 },
  { id: 'other', label: 'Other To Hit Penalty', modifier: -1 },
]
function shootingPenaltyIds(instanceId: string) { return new Set(unitTurnState(instanceId).shootingPenaltyIds || []) }
function toggleShootingPenalty(instanceId: string, id: string, checked: boolean) {
  const next = shootingPenaltyIds(instanceId)
  if (checked) next.add(id); else next.delete(id)
  patchUnitTurnState(instanceId, { shootingPenaltyIds: [...next] })
}
function shootingModifierTotal(instanceId: string) {
  const selected = shootingPenaltyIds(instanceId)
  return shootingPenaltyOptions.filter((row) => selected.has(row.id)).reduce((sum, row) => sum + row.modifier, 0)
}
function ballisticSkillRows(instanceId: string) {
  const profile = combatProfile(instanceId)
  const rows = (profile?.rows || []).map((row) => ({ name: row.name, bs: Number.parseInt(String(row.profile.BS || ''), 10) })).filter((row) => Number.isFinite(row.bs) && row.bs > 0)
  const seen = new Set<string>()
  return rows.filter((row) => { const key = `${row.name}|${row.bs}`; if (seen.has(key)) return false; seen.add(key); return true })
}
function ballisticSkill(instanceId: string) { const rows = ballisticSkillRows(instanceId); return rows.length ? Math.max(...rows.map((row) => row.bs)) : 0 }
function shootingToHitFor(instanceId: string, bs: number) { return shootingToHit(bs, shootingModifierTotal(instanceId)) }
function shootingToHitLabel(instanceId: string) { const bs = ballisticSkill(instanceId); return bs ? shootingToHitFor(instanceId, bs).label : '—' }
function destroyedCount(instanceId: string) { return Math.max(0, Number(persistentUnitState(instanceId).casualties || 0)) }
function profileWounds(instanceId: string) {
  const profile = combatProfile(instanceId)
  const values = (profile?.rows || []).map((row) => Number.parseInt(String(row.profile.W || ''), 10)).filter((value) => Number.isFinite(value) && value > 0)
  return values.length ? Math.max(...values) : 1
}
function casualtyLimit(unit: BuilderRosterSelection) { return (unit.modelCount || 1) > 1 ? Math.max(1, Number(unit.modelCount || 1)) : profileWounds(unit.instanceId) }
function casualtyLabel(unit: BuilderRosterSelection) { return (unit.modelCount || 1) > 1 ? 'Destroyed models' : 'Wounds lost' }
function unitEliminated(unit: BuilderRosterSelection) { return destroyedCount(unit.instanceId) >= casualtyLimit(unit) }
function adjustCasualties(unit: BuilderRosterSelection, delta: number) {
  const value = Math.max(0, Math.min(casualtyLimit(unit), destroyedCount(unit.instanceId) + delta))
  patchPersistentUnitState(unit.instanceId, { casualties: value })
}
function setCommandLoss(instanceId: string, field: 'bannerLost' | 'championLost' | 'musicianLost', checked: boolean) { patchPersistentUnitState(instanceId, { [field]: checked } as Partial<MatchPersistentUnitState>) }
function dispositionOwnerId(instanceId: string) { return joinedHostId(instanceId) || instanceId }
function combatDispositionFor(instanceId: string) { return unitTurnState(dispositionOwnerId(instanceId)).combatDisposition || '' }
function setCombatDisposition(instanceId: string, disposition: MatchCombatDisposition) {
  const ownerId = dispositionOwnerId(instanceId)
  const current = unitTurnState(ownerId).combatDisposition || ''
  const nextDisposition = current === disposition ? '' : disposition
  patchUnitTurnState(ownerId, { combatDisposition: nextDisposition, combatLostBy: 0, breakResult: '', followUpResult: '' })
  if (nextDisposition) recordHistory('combat', ownerId, nextDisposition)
}
function combatLostBy(instanceId: string) { return Math.max(0, Number(unitTurnState(dispositionOwnerId(instanceId)).combatLostBy || 0)) }
function setCombatLostBy(instanceId: string, value: number) { patchUnitTurnState(dispositionOwnerId(instanceId), { combatLostBy: Math.max(0, Math.floor(Number(value || 0))), breakResult: '' }) }
function unitLeadership(row: BuilderRosterSelection) {
  const hostId = joinedHostId(row.instanceId) || row.instanceId
  const host = playerRoster.value.find((entry) => entry.instanceId === hostId) || row
  const values = [Number(host.leadership || 0), ...joinedCharactersForHost(hostId).map((character) => Number(character.leadership || 0))].filter((value) => Number.isFinite(value) && value > 0)
  return values.length ? Math.max(...values) : 7
}
function unitBreakBands(row: BuilderRosterSelection) { return breakTestBands(unitLeadership(row), combatLostBy(row.instanceId)) }
function setBreakResult(instanceId: string, result: string, checked: boolean) {
  const ownerId = dispositionOwnerId(instanceId)
  const current = unitTurnState(ownerId).breakResult || ''
  patchUnitTurnState(ownerId, { breakResult: checked ? result : (current === result ? '' : current) })
  if (checked) {
    setFleeing(ownerId, result === 'flee')
    recordHistory('combat', ownerId, result, `lost by ${combatLostBy(ownerId)}`)
  } else if (current === 'flee') {
    setFleeing(ownerId, false)
  }
}
function rallyResult(instanceId: string) { return unitTurnState(instanceId).rallyResult || '' }
function setRallyResult(instanceId: string, result: 'pass' | 'fail', checked: boolean) {
  patchUnitTurnState(instanceId, { rallyResult: checked ? result : '' })
  if (result === 'pass') setFleeing(instanceId, !checked)
}
function setFollowUpResult(instanceId: string, result: string, checked: boolean) {
  const ownerId = dispositionOwnerId(instanceId)
  const current = unitTurnState(ownerId).followUpResult || ''
  patchUnitTurnState(ownerId, { followUpResult: checked ? result : (current === result ? '' : current) })
}
function hasCommandModel(row: BuilderRosterSelection, kind: 'banner' | 'champion' | 'musician') {
  const text = [...(row.options || []), ...(row.optionalSelections || []), ...(row.includedEquipment || [])].join(' ')
  if (kind === 'banner') return /standard bearer|banner bearer|battle standard/i.test(text)
  if (kind === 'musician') return /musician/i.test(text)
  return /champion|\bboss\b|unit champion/i.test(text)
}
function foughtInCombat(instanceId: string) {
  if (!game.value) return false
  const key = `${game.value.round}:${turnViewSide.value}:combat:fight`
  return Boolean(game.value.stepChecks?.[key]?.[combatCheckId(instanceId)])
}
const breakResultOptions = [
  { id: 'give-ground', label: 'Give Ground' },
  { id: 'fall-back', label: 'Fall Back in Good Order' },
  { id: 'flee', label: 'Break & Flee' },
]
const followUpOptions = [
  { id: 'follow-up', label: 'Follow Up', detail: 'Use when the losing unit Gives Ground.' },
  { id: 'pursue', label: 'Pursue', detail: 'Use when the losing unit Falls Back in Good Order or flees.' },
  { id: 'restrain', label: 'Restrain & Reform', detail: 'Attempt the required Leadership test instead of following up or pursuing.' },
  { id: 'overrun', label: 'Overrun', detail: 'Available when the enemy was destroyed before Break Tests and the normal overrun conditions are met.' },
  { id: 'none', label: 'No follow up', detail: 'Record that this unit makes no further follow-up movement.' },
]

async function ensureCombatProfile(row: BuilderRosterSelection) {
  if (!game.value || Object.prototype.hasOwnProperty.call(combatProfiles.value, row.instanceId) || combatProfileLoading.value.has(row.instanceId)) return
  const loading = new Set(combatProfileLoading.value); loading.add(row.instanceId); combatProfileLoading.value = loading
  try {
    const profile = await loadMatchUnitProfile(game.value, row)
    combatProfiles.value = { ...combatProfiles.value, [row.instanceId]: profile }
  } finally {
    const next = new Set(combatProfileLoading.value); next.delete(row.instanceId); combatProfileLoading.value = next
  }
}
function combatProfile(instanceId: string) { return combatProfiles.value[instanceId] }
function matchUnitProfileRoute(row: BuilderRosterSelection) {
  return game.value
    ? { path: `/games/${game.value.id}/unit/${row.instanceId}`, query: { return: route.fullPath } }
    : { path: '/games' }
}
function combatRemainingLabel(unit: BuilderRosterSelection) {
  if ((unit.modelCount || 1) > 1) {
    const remaining = Math.max(0, Number(unit.modelCount || 1) - destroyedCount(unit.instanceId))
    return `${remaining} model${remaining === 1 ? '' : 's'} remaining`
  }
  return `${Math.max(0, casualtyLimit(unit) - destroyedCount(unit.instanceId))} Wounds Remaining`
}
function unitLeadershipByInstanceId(instanceId: string) {
  const row = playerRoster.value.find((entry) => entry.instanceId === instanceId)
  if (!row) return '—'
  const hostId = joinedHostId(row.instanceId) || row.instanceId
  const host = playerRoster.value.find((entry) => entry.instanceId === hostId) || row
  const values = [
    Number(host.leadership || 0) || profileCharacteristic(host.instanceId, 'Ld'),
    ...joinedCharactersForHost(hostId).map((character) => Number(character.leadership || 0) || profileCharacteristic(character.instanceId, 'Ld')),
  ].filter((value) => Number.isFinite(value) && value > 0)
  return values.length ? Math.max(...values) : '—'
}
function scrollTabs(target: 'phase' | 'step', direction: -1 | 1) {
  const element = target === 'phase' ? phaseTabsRef.value : stepTabsRef.value
  if (!element) return
  element.scrollBy({ left: direction * Math.max(240, Math.round(element.clientWidth * .72)), behavior: 'smooth' })
}
function setPhase(index: number) { if (!game.value || isReadOnly.value) return; if (isDeploymentOrderStep.value && disruptiveWeatherPending.value && index > game.value.phaseIndex) return; persist({ phaseIndex: index, stepIndex: 0 }) }
function setStep(index: number) { if (!game.value || isReadOnly.value) return; if (isDeploymentOrderStep.value && disruptiveWeatherPending.value && index > game.value.stepIndex) return; persist({ stepIndex: index }) }
function advance() {
  if (!game.value || !phase.value || isReadOnly.value) return
  if (game.value.stepIndex < phase.value.steps.length - 1) { persist({ stepIndex: game.value.stepIndex + 1 }); return }
  if (phase.value.id === 'overview' && battleStarted.value) { persist({ phaseIndex: strategyPhaseIndex.value, stepIndex: 0 }); return }
  if (phase.value.id === 'deployment') { const firstSide = game.value.firstPlayerConfirmed ? game.value.firstPlayer : game.value.activeSide; turnViewSide.value = firstSide; persist({ phaseIndex: roundStartPhaseIndex.value, stepIndex: 0, activeSide: firstSide, battleStarted: true, round: 1 }); return }
  if (phase.value.id === 'round-start') { const firstSide = game.value.firstPlayerConfirmed ? game.value.firstPlayer : game.value.activeSide; turnViewSide.value = firstSide; persist({ phaseIndex: strategyPhaseIndex.value, stepIndex: 0, activeSide: firstSide, battleStarted: true }); return }
  if (game.value.phaseIndex < gameWorkflow.length - 1) { persist({ phaseIndex: game.value.phaseIndex + 1, stepIndex: 0 }); return }
}
function back() {
  if (!game.value || !phase.value || isReadOnly.value) return
  if (game.value.stepIndex > 0) { persist({ stepIndex: game.value.stepIndex - 1 }); return }
  if (game.value.phaseIndex > 0) {
    if (battleStarted.value && phase.value.id === 'strategy') { const previous = gameWorkflow[roundStartPhaseIndex.value]; persist({ phaseIndex: roundStartPhaseIndex.value, stepIndex: Math.max(0, previous.steps.length - 1) }); return }
    const previous = gameWorkflow[game.value.phaseIndex - 1]; persist({ phaseIndex: game.value.phaseIndex - 1, stepIndex: Math.max(0, previous.steps.length - 1) })
  }
}
async function hydrateTurnGuidance() {
  const request = ++turnGuidanceRequest
  if (!game.value || !step.value || !isBattleTurnPhase.value) { turnGuidance.value = []; turnGuidanceLoading.value = false; return }
  const gameId = game.value.id
  const stepId = step.value.id
  const side = turnViewSide.value
  turnGuidance.value = []
  turnGuidanceLoading.value = true
  try {
    const rows = await loadMatchTurnGuidance(game.value, stepId, side)
    if (request !== turnGuidanceRequest || !game.value || game.value.id !== gameId || step.value?.id !== stepId || turnViewSide.value !== side) return
    turnGuidance.value = rows
  } finally {
    if (request === turnGuidanceRequest) turnGuidanceLoading.value = false
  }
}
function selectTurnContext(side: GameSide) { if (!game.value || isReadOnly.value || turnViewSide.value === side) return; turnViewSide.value = side }

function guidanceCheckId(rule: MatchGuidanceRule, index: number) { const refs = (rule.unitRefs || []).map((ref) => ref.instanceId).sort().join(','); return `${rule.action || 'rule'}|${rule.label}|${rule.path || ''}|${refs}|${index}`.toLowerCase() }
function guidanceChecked(rule: MatchGuidanceRule, index: number) { if (!game.value || !checklistKey.value) return false; return Boolean(game.value.stepChecks?.[checklistKey.value]?.[guidanceCheckId(rule, index)]) }
function isFatedDispelRule(rule: MatchGuidanceRule) { return /^Fated Dispel$/i.test(rule.label) }
function ruleUseBucket(rule: MatchGuidanceRule) { return rule.useScope && game.value ? matchUseBucket(rule.useScope, game.value.round, turnViewSide.value) : '' }
function ruleUseCount(rule: MatchGuidanceRule) {
  const bucket = ruleUseBucket(rule)
  const key = rule.useKey || rule.id
  return bucket ? Math.max(0, Number(matchTracking.value.ruleUses?.[key]?.[bucket] || 0)) : 0
}
function ruleUseRemaining(rule: MatchGuidanceRule) { return rule.useLimit ? Math.max(0, rule.useLimit - ruleUseCount(rule)) : undefined }
function adjustRuleUse(rule: MatchGuidanceRule, delta: number) {
  const bucket = ruleUseBucket(rule)
  if (!bucket || !rule.useLimit) return
  mutateTracking((next) => {
    const key = rule.useKey || rule.id
    const buckets = { ...(next.ruleUses[key] || {}) }
    buckets[bucket] = Math.max(0, Math.min(rule.useLimit!, Number(buckets[bucket] || 0) + delta))
    if (!buckets[bucket]) delete buckets[bucket]
    if (Object.keys(buckets).length) next.ruleUses[key] = buckets; else delete next.ruleUses[key]
  })
}
function guidanceDisabled(rule: MatchGuidanceRule, index: number) {
  const exhausted = rule.useLimit && ruleUseRemaining(rule) === 0
  return isReadOnly.value || Boolean(exhausted) || (isFatedDispelRule(rule) && fatedDispelUsedThisRound.value)
}
function toggleGuidanceCheck(rule: MatchGuidanceRule, index: number, checked: boolean) {
  if (!game.value || isReadOnly.value || !checklistKey.value || guidanceDisabled(rule, index)) return
  const group = { ...(game.value.stepChecks?.[checklistKey.value] || {}) }
  const id = guidanceCheckId(rule, index)
  const wasChecked = Boolean(group[id])
  if (checked) group[id] = true; else delete group[id]
  persist({ stepChecks: { ...(game.value.stepChecks || {}), [checklistKey.value]: group } })
  if (checked !== wasChecked && rule.useLimit) adjustRuleUse(rule, checked ? 1 : -1)
  if (isFatedDispelRule(rule)) mutateTracking((next) => { next.fatedDispelUsedRound = checked ? game.value?.round : undefined })
}
function spellGuidanceChoice(rule: MatchGuidanceRule): GameMagicChoice {
  const wantedPath = String(rule.path || '')
  const wantedName = String(rule.label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  for (const caster of magicCasters.value) {
    const selected = new Set(caster.selectedSpellIds || [])
    const choice = (caster.choices || []).find((candidate) => {
      if (!selected.has(candidate.id)) return false
      if (wantedPath && candidate.path === wantedPath) return true
      return String(candidate.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === wantedName
    })
    if (choice) return { ...choice, summary: choice.summary || rule.summary, path: choice.path || rule.path }
  }
  return { id: rule.id, name: rule.label, summary: rule.summary, path: rule.path, type: 'Spell' }
}
function spellResultCheckId(rule: MatchGuidanceRule, result: 'success' | 'fail') {
  return `spell-result:${rule.id}:${result}`.toLowerCase()
}
function spellResult(rule: MatchGuidanceRule): 'success' | 'fail' | '' {
  if (!game.value || !checklistKey.value) return ''
  const group = game.value.stepChecks?.[checklistKey.value] || {}
  if (group[spellResultCheckId(rule, 'success')]) return 'success'
  if (group[spellResultCheckId(rule, 'fail')]) return 'fail'
  return ''
}
function setSpellResult(rule: MatchGuidanceRule, result: 'success' | 'fail' | '') {
  if (!game.value || isReadOnly.value || !checklistKey.value) return
  const group = { ...(game.value.stepChecks?.[checklistKey.value] || {}) }
  delete group[spellResultCheckId(rule, 'success')]
  delete group[spellResultCheckId(rule, 'fail')]
  if (result) group[spellResultCheckId(rule, result)] = true
  persist({ stepChecks: { ...(game.value.stepChecks || {}), [checklistKey.value]: group } })
}
function chargeTestKey(instanceId: string) { return game.value ? `${game.value.round}:${turnViewSide.value}:required-charges:${instanceId}` : '' }
function chargeTestResult(instanceId: string): GameChargeTestResult | '' { if (!game.value) return ''; return game.value.chargeTests?.[chargeTestKey(instanceId)] || '' }
function setChargeTestResult(instanceId: string, result: GameChargeTestResult, checked: boolean) { if (!game.value || isReadOnly.value) return; const next = { ...(game.value.chargeTests || {}) }; const key = chargeTestKey(instanceId); if (!checked || next[key] === result) delete next[key]; else next[key] = result; persist({ chargeTests: next }); if (step.value?.id === 'declare-charges') void hydrateTurnGuidance() }
function combatCheckId(instanceId: string) { return `combat-unit:${instanceId}` }
function combatUnitChecked(instanceId: string) { return Boolean(game.value && checklistKey.value && game.value.stepChecks?.[checklistKey.value]?.[combatCheckId(instanceId)]) }
function toggleCombatUnit(instanceId: string, checked: boolean) { if (!game.value || isReadOnly.value || !checklistKey.value) return; const group = { ...(game.value.stepChecks?.[checklistKey.value] || {}) }; const id = combatCheckId(instanceId); if (checked) group[id] = true; else delete group[id]; persist({ stepChecks: { ...(game.value.stepChecks || {}), [checklistKey.value]: group } }) }
function shootingCheckId(instanceId: string) { return `shooting-unit:${instanceId}` }
function shootingUnitChecked(instanceId: string) { return Boolean(game.value && checklistKey.value && game.value.stepChecks?.[checklistKey.value]?.[shootingCheckId(instanceId)]) }
function toggleShootingUnit(instanceId: string, checked: boolean) { if (!game.value || isReadOnly.value || !checklistKey.value) return; const group = { ...(game.value.stepChecks?.[checklistKey.value] || {}) }; const id = shootingCheckId(instanceId); if (checked) group[id] = true; else delete group[id]; persist({ stepChecks: { ...(game.value.stepChecks || {}), [checklistKey.value]: group } }) }

function startTurnFromEnd(side: GameSide) { if (!game.value || isReadOnly.value || roundsComplete.value) return; turnViewSide.value = side; persist({ activeSide: side, phaseIndex: strategyPhaseIndex.value, stepIndex: 0, battleStarted: true }) }
function endRoundFromEnd() { if (!game.value || isReadOnly.value || roundsComplete.value) return; const completed = Math.min(roundLimit.value, game.value.roundsCompleted + 1); if (completed >= roundLimit.value) { persist({ roundsCompleted: completed, battleStarted: true }); return }; const firstSide = game.value.firstPlayerConfirmed ? game.value.firstPlayer : 'player'; turnViewSide.value = firstSide; persist({ roundsCompleted: completed, round: game.value.round + 1, activeSide: firstSide, phaseIndex: roundStartPhaseIndex.value, stepIndex: 0, battleStarted: true }) }
function chooseFirstPlayer(side: GameSide) { if (!game.value || isReadOnly.value) return; turnViewSide.value = side; persist({ firstPlayer: side, firstPlayerConfirmed: true, activeSide: side }) }
function chooseDeploymentFirstSide(side: GameSide) { if (!game.value || isReadOnly.value) return; persist({ deploymentFirstSide: side }) }
function toggleDeployedUnit(side: GameSide, instanceId: string, checked: boolean, internal = false) {
  if (!game.value || (isReadOnly.value && !internal)) return
  const key = side === 'player' ? 'deployedPlayerIds' : 'deployedOpponentIds'
  const current = new Set(side === 'player' ? game.value.deployedPlayerIds || [] : game.value.deployedOpponentIds || [])
  const reserves = new Set(game.value.reservePlayerIds || [])
  const row = side === 'player' ? playerRoster.value.find((entry) => entry.instanceId === instanceId) : undefined
  const ids = row && isWarMachine(row)
    ? playerRoster.value.filter((entry) => isWarMachine(entry) && !reserves.has(entry.instanceId)).map((entry) => entry.instanceId)
    : [instanceId]
  for (const id of ids) { if (checked) current.add(id); else current.delete(id) }
  if (side === 'player' && checked) for (const id of ids) reserves.delete(id)
  if (side === 'player') syncJoinedCharacterDeployment(current, reserves)
  persist({ [key]: [...current], ...(side === 'player' ? { reservePlayerIds: [...reserves] } : {}) } as Partial<SavedGame>)
}
function handleDeployedUnit(side: GameSide, instanceId: string, event: Event) { toggleDeployedUnit(side, instanceId, Boolean((event.target as HTMLInputElement).checked)) }
function toggleReserveUnit(instanceId: string, checked: boolean, internal = false) {
  if (!game.value || (isReadOnly.value && !internal)) return
  const current = new Set(game.value.reservePlayerIds || [])
  const deployed = new Set(game.value.deployedPlayerIds || [])
  if (checked) current.add(instanceId); else current.delete(instanceId)
  if (checked) deployed.delete(instanceId)
  syncJoinedCharacterDeployment(deployed, current)
  persist({ reservePlayerIds: [...current], deployedPlayerIds: [...deployed] })
}
function handleReserveUnit(instanceId: string, event: Event) { toggleReserveUnit(instanceId, Boolean((event.target as HTMLInputElement).checked)) }
function setRoundLimit(value: number) { if (!game.value || isReadOnly.value || battleStarted.value) return; persist({ roundLimit: Math.max(1, Math.min(20, Math.round(Number(value) || 1))), roundLimitCustomized: true }) }
function handleRoundLimit(event: Event) { setRoundLimit(Number((event.target as HTMLInputElement).value)) }
function adjustScore(side: GameSide, delta: number) { if (!game.value || isReadOnly.value) return; if (side === 'player') persist({ playerScore: Math.max(0, game.value.playerScore + delta) }); else persist({ opponentScore: Math.max(0, game.value.opponentScore + delta) }) }
function saveMatchToOngoing() { if (!game.value || isReadOnly.value) return; persist({ status: 'open' }) }
function finishMatch(outcome: GameOutcome = 'completed') { if (!game.value || isReadOnly.value || (outcome === 'completed' && !roundsComplete.value)) return; const updated = completeSavedGame(game.value.id, outcome); if (updated) game.value = updated }
function cancelMatch() { if (!game.value || isReadOnly.value || typeof window === 'undefined') return; if (!window.confirm('Cancel this match? The saved match and its recorded setup will be removed from this device.')) return; const id = game.value.id; clearMatchTracking(id); deleteSavedGame(id); void router.push('/games') }
async function startOver() { if (!game.value || isReadOnly.value || typeof window === 'undefined') return; if (!window.confirm('Start this match over? Scores, round progress, first-turn result and match-specific magic selections will be reset.')) return; const id = game.value.id; clearMatchTracking(id); matchTracking.value = loadMatchTracking(id); const updated = resetSavedGame(id); if (!updated) return; game.value = updated; magicCasters.value = []; await hydrateMagicSetup() }
function endMatchEarly(outcome: Exclude<GameOutcome, 'completed'>) { if (!game.value || isReadOnly.value || !battleStarted.value || typeof window === 'undefined') return; const label = outcome === 'conceded' ? 'record a concession' : outcome === 'enemy-yielded' ? 'record that the enemy yielded' : 'record this match as a draw'; if (!window.confirm(`End the match and ${label}?`)) return; finishMatch(outcome) }
function returnToGames() { void router.push('/games') }

function cloneMagicSetup() { return magicCasters.value.map((caster) => ({ ...caster, availableLores: [...caster.availableLores], selectedSpellIds: [...caster.selectedSpellIds], choices: caster.choices?.map((choice) => ({ ...choice })) })) }
function persistMagicSetup() { if (game.value && !isReadOnly.value) persist({ magicSetup: cloneMagicSetup() }) }
async function hydrateMagicSetup() { if (!game.value) return; magicLoading.value = true; try { magicCasters.value = await hydrateFriendlyMagicSetup(game.value); await preloadMagicChoices(); persistMagicSetup(); if (isBattleTurnPhase.value) void hydrateTurnGuidance() } finally { magicLoading.value = false } }
async function ensureMagicChoices(caster: GameMagicCaster) { if (!caster.selectedLore) return; const loading = new Set(magicChoiceLoading.value); loading.add(caster.instanceId); magicChoiceLoading.value = loading; try { const choices = caster.choices?.length ? caster.choices : await loadMagicChoices(caster); caster.choices = await enrichMagicChoices(choices); const ids = new Set(caster.choices.map((choice) => choice.id)); caster.selectedSpellIds = caster.selectedSpellIds.filter((id) => ids.has(id)); persistMagicSetup() } finally { const next = new Set(magicChoiceLoading.value); next.delete(caster.instanceId); magicChoiceLoading.value = next } }
async function preloadMagicChoices() { await Promise.allSettled(magicCasters.value.map((caster) => ensureMagicChoices(caster))) }
function selectedMagicChoice(caster: GameMagicCaster, id: string) { return caster.selectedSpellIds.includes(id) }
function toggleMagicChoice(caster: GameMagicCaster, id: string, selected: boolean) { if (isReadOnly.value || caster.kind !== 'Wizard') return; const next = new Set(caster.selectedSpellIds); if (selected) { if (!next.has(id) && next.size >= magicSelectionLimit(caster)) return; next.add(id) } else next.delete(id); caster.selectedSpellIds = [...next]; persistMagicSetup() }
function handleMagicChoice(caster: GameMagicCaster, id: string, event: Event) { toggleMagicChoice(caster, id, Boolean((event.target as HTMLInputElement).checked)) }
function casterChoiceDisabled(caster: GameMagicCaster, id: string) { return !selectedMagicChoice(caster, id) && caster.selectedSpellIds.length >= magicSelectionLimit(caster) }
function selectedChoiceNames(caster: GameMagicCaster) { const selected = new Set(caster.selectedSpellIds); return (caster.choices || []).filter((choice) => selected.has(choice.id)).map((choice) => choice.name) }

function scenarioDefaultRounds(guidance: SavedGame['scenarioGuidance']) {
  if (!guidance) return 4
  const text = String(guidance.gameLength || '').trim()
  // loadScenarioGuidance uses this six-round sentence as its generic fallback;
  // Old.dex's normal table default is four unless the selected scenario provides
  // an actual scenario-specific game length.
  if (!text || /^Most battles last for six rounds\.?$/i.test(text)) return 4
  return Math.max(1, Number(guidance.roundLimit || 4))
}
async function hydrateScenarioGuidance() {
  if (!game.value) return
  const existing = game.value.scenarioGuidance
  if (existing?.mapImageUrl) {
    if (!game.value.roundLimitCustomized) {
      const desired = scenarioDefaultRounds(existing)
      if (game.value.roundLimit !== desired) persist({ roundLimit: desired })
    }
    return
  }
  scenarioLoading.value = true
  try {
    const guidance = await loadScenarioGuidance(game.value.scenario)
    persist({ scenarioGuidance: guidance, roundLimit: game.value.roundLimitCustomized ? game.value.roundLimit : scenarioDefaultRounds(guidance) })
  } finally {
    scenarioLoading.value = false
    if (isBattleTurnPhase.value) void hydrateTurnGuidance()
  }
}
async function hydrateDeploymentGuidance() { if (!game.value || deploymentLoading.value) return; deploymentLoading.value = true; try { deploymentGuidance.value = await loadMatchDeploymentGuidance(game.value) } finally { deploymentLoading.value = false } }
async function hydrateStartRoundGuidance() { if (!game.value || startRoundLoading.value) return; startRoundLoading.value = true; try { startRoundGuidance.value = await loadMatchStartRoundGuidance(game.value) } finally { startRoundLoading.value = false } }
function deploymentFor(instanceId: string) { return deploymentGuidanceMap.value.get(instanceId) }
async function ensureRandomHappeningTable(id: string) {
  const option = randomHappeningOptions.find((row) => row.id === id)
  if (!option || Object.prototype.hasOwnProperty.call(randomHappeningTables.value, id) || randomHappeningLoading.value.has(id)) return
  const loading = new Set(randomHappeningLoading.value); loading.add(id); randomHappeningLoading.value = loading
  try { randomHappeningTables.value = { ...randomHappeningTables.value, [id]: await loadRandomHappeningTable(option.path) } }
  catch { randomHappeningTables.value = { ...randomHappeningTables.value, [id]: null } }
  finally { const next = new Set(randomHappeningLoading.value); next.delete(id); randomHappeningLoading.value = next }
}
function battlefieldResult(id: string) { return String(game.value?.battlefieldConditionResults?.[id] || '') }
function setBattlefieldResult(id: string, roll: string) {
  if (!game.value || isReadOnly.value) return
  const next = { ...(game.value.battlefieldConditionResults || {}) }
  if (next[id] === roll) delete next[id]; else next[id] = roll
  persist({ battlefieldConditionResults: next })
  if (isBattleTurnPhase.value) void hydrateTurnGuidance()
}
function battlefieldOptionForPath(path?: string) { return randomHappeningOptions.find((option) => option.path === path) }
function battlefieldOptionForRule(rule: MatchGuidanceRule) { return battlefieldOptionForPath(rule.path) }
function battlefieldTableForPath(path?: string) { const option = battlefieldOptionForPath(path); return option ? randomHappeningTables.value[option.id] : null }
function battlefieldTableForRule(rule: MatchGuidanceRule) { return battlefieldTableForPath(rule.path) }
function battlefieldResultSelectedForPath(path: string | undefined, roll: string) { const option = battlefieldOptionForPath(path); return Boolean(option && battlefieldResult(option.id) === roll) }
function battlefieldResultSelectedForRule(rule: MatchGuidanceRule, roll: string) { return battlefieldResultSelectedForPath(rule.path, roll) }
function battlefieldResolvedRow(id: string, resultKey = id) {
  const roll = battlefieldResult(resultKey)
  return randomHappeningTables.value[id]?.results.find((row) => row.roll === roll) || null
}

function battlefieldResolvedRowForPath(path?: string) {
  const option = battlefieldOptionForPath(path)
  return option ? battlefieldResolvedRow(option.id) : null
}
function battlefieldResolvedRowForRule(rule: MatchGuidanceRule) {
  return battlefieldResolvedRowForPath(rule.path)
}
function toggleBattlefieldCondition(id: string, checked: boolean) {
  if (!game.value || isReadOnly.value) return
  const next = new Set(game.value.battlefieldConditions || [])
  const results = { ...(game.value.battlefieldConditionResults || {}) }
  if (checked) { next.add(id); void ensureRandomHappeningTable(id) } else { next.delete(id); delete results[id] }
  persist({ battlefieldConditions: [...next], battlefieldConditionResults: results })
  if (isBattleTurnPhase.value) void hydrateTurnGuidance()
}
function handleBattlefieldCondition(id: string, event: Event) { toggleBattlefieldCondition(id, Boolean((event.target as HTMLInputElement).checked)) }

function ruleParagraphs(value: string) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return [] as string[]
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((row) => row.trim()).filter(Boolean) || [text]
  const rows: string[] = []
  let buffer: string[] = []
  for (const sentence of sentences) {
    const newTopic = /^(?:At the beginning|At the start|On a roll|Whenever|Should|If |In addition|Units? |The winner|For the purposes|During |Whilst |However|Otherwise|D\d)/i.test(sentence)
    if (newTopic && buffer.length) { rows.push(buffer.join(' ')); buffer = [] }
    buffer.push(sentence)
    if (buffer.length >= 2) { rows.push(buffer.join(' ')); buffer = [] }
  }
  if (buffer.length) rows.push(buffer.join(' '))
  return rows
}
function guidanceQuantityText(rule: MatchGuidanceRule) {
  if (!rule.useLimit) return ''
  const remaining = ruleUseRemaining(rule)
  return `${remaining ?? rule.useLimit} / ${rule.useLimit} remaining ${rule.useScope ? `this ${rule.useScope}` : ''}`.trim()
}
const setupTip = computed(() => { if (isSetupArmiesStep.value) return 'Confirm the roster, scenario and battle-composition details before deployment. Wizard lore choices are made when the model permits a choice; changing a lore here changes this match setup only and does not rewrite the saved roster.'; if (isSetupSpellsStep.value) return 'Generate spells before deployment. For a Wizard, roll one D6 per Wizard Level and re-roll duplicates; each result selects the matching numbered spell. One generated spell may be exchanged for the signature spell. A single Wizard cannot know the same spell twice.'; if (isOverviewStep.value) return 'Use Overview as the at-a-glance battle dashboard. Check the matchup, scenario, prepared magic and current turn state here before moving into Deployment and the turn phases.'; return '' })
const deploymentTip = computed(() => { if (isDeploymentOrderStep.value) return 'Review the scenario deployment instructions before placing models. Record which side begins deployment here; this is separate from determining which side takes the first turn.'; if (isDeployArmiesStep.value) return 'Deploy ordinary non-character units in the scenario’s alternating order. An army’s War Machines are placed together as one deployment. Characters are deployed after other ordinary deployments; a Character assigned to a joined unit is automatically recorded with that host when the host/character deployment state is resolved. Scouts that use their special deployment are resolved after the normal armies have deployed. Units permitted to begin off-table may be marked Held in Reserve instead. Always follow a unit or scenario rule when it gives a more specific exception.'; if (isRoundBattleEffectsStep.value) return 'Start of Round begins with effects that apply to the battle as a whole. Resolve scenario, battlefield and battle-composition effects before either player resolves army or model-specific Start of Round rules.'; if (isRoundPlayerEffectsStep.value) return 'After shared battle effects, resolve the friendly and enemy army, unit and model rules that trigger at Start of Round. Keep each side separate so no model-specific effect is missed.'; return '' })
const advanceButtonLabel = computed(() => {
  if (roundsComplete.value && phase.value?.id === 'end') return 'Round limit reached'
  if (phase.value?.id === 'deployment' && game.value?.stepIndex === phase.value.steps.length - 1) return 'Start Battle'
  if (isRoundPlayerEffectsStep.value) return 'Begin Round'
  return 'Next'
})
const advanceButtonDisabled = computed(() => Boolean(
  (roundsComplete.value && phase.value?.id === 'end') ||
  (isDeploymentOrderStep.value && disruptiveWeatherPending.value) ||
  (phase.value?.id === 'deployment' && game.value?.stepIndex === phase.value.steps.length - 1 && !game.value?.firstPlayerConfirmed)
))

onMounted(() => { matchLocked.value = Boolean(game.value && isGameLocked(game.value.id)); void Promise.allSettled([hydrateMagicSetup(), hydrateScenarioGuidance()]) })
</script>

<template>
  <main class="page game-match-page">
    <AppHeader compact back-to="/games" prefer-back-to />
    <section v-if="game" class="game-match-shell">
      <header class="game-match-hero card-surface">
        <div>
          <p class="eyebrow">{{ game.status === 'complete' ? 'MATCH HISTORY' : matchLocked ? 'MATCH LOCKED' : !game.firstPlayerConfirmed ? 'TURN ORDER PENDING' : `ROUND ${game.round} · ${game.activeSide === 'player' ? 'FRIENDLY TURN' : 'ENEMY TURN'}` }}</p>
          <h1>{{ game.name }}</h1>
          <p>{{ game.scenario }} · {{ game.points }} pts</p>
        </div>
        <span v-if="matchLocked" class="match-locked-pill">LOCKED</span>
      </header>

      <div class="match-tab-scroll-shell phase-scroll-shell">
        <button type="button" class="match-tab-scroll-arrow left" aria-label="Scroll battle phases left" @click="scrollTabs('phase', -1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7" /></svg></button>
        <nav ref="phaseTabsRef" class="game-phase-tabs" aria-label="Battle phases">
          <button v-for="(item, index) in gameWorkflow" :key="item.id" type="button" :class="{ active: game.phaseIndex === index }" :disabled="isReadOnly" @click="setPhase(index)">{{ item.label }}</button>
        </nav>
        <button type="button" class="match-tab-scroll-arrow right" aria-label="Scroll battle phases right" @click="scrollTabs('phase', 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 5 7 7-7 7" /></svg></button>
      </div>
      <div v-if="phase" class="match-tab-scroll-shell step-scroll-shell" :class="{ 'single-step': phase.steps.length === 1 }">
        <button v-if="phase.steps.length > 1" type="button" class="match-tab-scroll-arrow left" aria-label="Scroll phase steps left" @click="scrollTabs('step', -1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7" /></svg></button>
        <div ref="stepTabsRef" class="game-step-list game-subphase-tabs" aria-label="Current phase subphases">
          <button v-for="(item, index) in phase.steps" :key="item.id" type="button" :class="{ active: game.stepIndex === index }" :disabled="isReadOnly" @click="setStep(index)"><span>{{ index + 1 }}</span>{{ item.label }}</button>
        </div>
        <button v-if="phase.steps.length > 1" type="button" class="match-tab-scroll-arrow right" aria-label="Scroll phase steps right" @click="scrollTabs('step', 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 5 7 7-7 7" /></svg></button>
      </div>

      <section v-if="phase && step" class="game-step-card card-surface">
        <div class="game-step-heading">
          <div>
            <p class="eyebrow">{{ phaseStepLabel }}</p>
            <h2>{{ step.label }}</h2>
            <p>{{ step.description }}</p>
          </div>
          <div class="game-step-heading-tools">
            <label class="match-tip-master-toggle" title="Show or hide Tip panels during this match">
              <span>Tips</span>
              <input class="match-tip-switch-input" type="checkbox" :checked="tipsVisible" :disabled="isReadOnly" @change="setTipsVisible(($event.target as HTMLInputElement).checked)" />
            </label>
            <div v-if="isBattleTurnPhase" class="turn-context-actions compact-turn-context" role="group" aria-label="Turn view">
              <button type="button" class="turn-context-button friendly" :class="{ active: turnViewSide === 'player' }" :disabled="isReadOnly" @click="selectTurnContext('player')">Friendly Turn</button>
              <button type="button" class="turn-context-button enemy" :class="{ active: turnViewSide === 'opponent' }" :disabled="isReadOnly" @click="selectTurnContext('opponent')">Enemy's Turn</button>
            </div>
          </div>
        </div>

        <div v-if="isSetupArmiesStep" class="game-setup-content">
          <MatchTipPanel v-if="tipsVisible" title="Tip — Match Setup" :text="setupTip" :collapsed="currentTipCollapsed" @toggle="setCurrentTipCollapsed" />
          <section class="match-setup-summary-grid">
            <article class="match-roster-summary friendly"><p class="eyebrow">FRIENDLY GENERAL</p><h3>{{ game.playerName }}</h3><strong>{{ game.playerListName }}</strong><p>{{ game.playerArmyName }}</p><dl><div><dt>Points</dt><dd>{{ playerActualPoints || game.points }} / {{ game.points }}</dd></div><div><dt>Composition</dt><dd>{{ playerCompositionName }}</dd></div><div><dt>Battle composition</dt><dd>{{ playerCompositionRule }}</dd></div></dl><div v-if="playerOptionLabels.length" class="match-option-chips"><span v-for="label in playerOptionLabels" :key="label">{{ label }}</span></div></article>
            <article class="match-roster-summary enemy"><p class="eyebrow">ENEMY GENERAL</p><h3>{{ game.opponentName }}</h3><strong>{{ game.opponentListName || 'No enemy roster selected' }}</strong><p>{{ game.opponentArmyName || 'Opponent' }}</p><dl><div><dt>Points</dt><dd>{{ opponentActualPoints || game.opponentPoints || 0 }} / {{ game.points }}</dd></div><div><dt>Composition</dt><dd>{{ opponentCompositionName }}</dd></div><div><dt>Battle composition</dt><dd>{{ opponentCompositionRule }}</dd></div></dl><div v-if="opponentOptionLabels.length" class="match-option-chips"><span v-for="label in opponentOptionLabels" :key="label">{{ label }}</span></div></article>
          </section>
          <section class="scenario-setup-card card-inset">
            <div class="setup-section-heading"><div><p class="eyebrow">SCENARIO</p><h3>{{ game.scenario }}</h3></div></div>
            <p v-if="scenarioLoading" class="setup-inline-status">Loading scenario rules…</p>
            <template v-else><p v-if="scenarioGuidance?.setupText">{{ scenarioGuidance.setupText }}</p><details v-if="scenarioGuidance?.scenarioRules.length" class="phase-rule-details scenario-inline-details"><summary>Scenario special rules</summary><p v-for="rule in scenarioGuidance.scenarioRules" :key="rule">{{ rule }}</p></details><img v-if="scenarioGuidance?.mapImageUrl" class="scenario-deployment-map scenario-rules-bottom-image" :src="scenarioGuidance.mapImageUrl" :alt="`${game.scenario} battlefield and deployment map`" loading="lazy" decoding="async" /></template>
          </section>
          <section class="game-length-card card-inset"><div class="setup-section-heading"><div><p class="eyebrow">GAME LENGTH</p><h3>{{ roundLimit }} rounds</h3></div></div><p>{{ scenarioGuidance?.gameLength || 'Old.dex defaults to four rounds unless the selected scenario specifies a different game length.' }}</p><label class="round-limit-control"><span>Rounds</span><input type="number" min="1" max="20" :value="roundLimit" :disabled="isReadOnly || battleStarted" @change="handleRoundLimit" /></label></section>
          <section v-if="battleMarchEnabled" class="battlefield-condition-card card-inset">
            <div class="setup-section-heading"><div><p class="eyebrow">BATTLE CONDITIONS</p><h3>Battle March random happenings</h3></div></div>
            <p class="setup-inline-status">Select the Battle Conditions being used. Their D6 tables are resolved when their rules take effect rather than expanded during Setup.</p>
            <div class="battlefield-condition-options"><label v-for="option in randomHappeningOptions" :key="option.id"><input type="checkbox" :checked="selectedBattlefieldConditions.has(option.id)" :disabled="isReadOnly" @change="handleBattlefieldCondition(option.id, $event)" /><span><strong>{{ option.label }}</strong><small v-if="option.id === 'chaos-of-war'">First-turn player's Start of Turn, from Turn 2 onward</small><small v-else-if="option.id === 'wilderness-terrain'">When a unit is deployed in or ends movement in natural terrain</small><small v-else>Before deployment begins</small><RouterLink :to="`/rules/read${option.path}`">Rules</RouterLink></span></label></div>
          </section>
        </div>

        <div v-else-if="isSetupSpellsStep" class="game-setup-content spell-setup-content">
          <MatchTipPanel v-if="tipsVisible" title="Tip — Spell Generation" :text="setupTip" :collapsed="currentTipCollapsed" rule-to="/rules/read/the-lores-of-magic/spells-and-spell-generation" rule-label="Open Spells & Spell Generation rules" @toggle="setCurrentTipCollapsed" />
          <p v-if="magicLoading" class="setup-inline-status">Loading friendly casters…</p>
          <p v-else-if="!magicCasters.length" class="setup-inline-status">The friendly roster contains no detected Wizards or Priests, so there are no pre-deployment magic selections to record.</p>
          <template v-else>
            <details v-for="caster in magicCasters" :key="caster.instanceId" class="spell-caster-panel caster-collapse-panel">
              <summary class="spell-caster-heading"><div><span class="rule-kind-pill">{{ caster.kind }}<template v-if="caster.kind === 'Wizard'"> · Level {{ caster.level }}</template></span><h3>{{ caster.name }}</h3><p>{{ caster.selectedLore || 'No lore selected' }}</p></div><strong v-if="caster.kind === 'Wizard'">{{ caster.selectedSpellIds.length }} / {{ magicSelectionLimit(caster) }} spells</strong></summary>
              <div class="spell-caster-collapse-body">
                <p v-if="magicChoiceLoading.has(caster.instanceId)" class="setup-inline-status">Loading {{ caster.kind === 'Wizard' ? 'spells' : 'prayers' }} from the rules source…</p>
                <div v-else-if="caster.kind === 'Wizard' && caster.choices?.length" class="spell-choice-grid spell-generation-grid canonical-spell-choice-grid">
                  <MatchSpellChoiceCard v-for="choice in caster.choices" :key="choice.id" :choice="choice" :selected="selectedMagicChoice(caster, choice.id)" :disabled="isReadOnly || casterChoiceDisabled(caster, choice.id)" @toggle="toggleMagicChoice(caster, choice.id, $event)" />
                </div>
                <div v-else-if="caster.kind === 'Priest' && caster.choices?.length" class="spell-choice-grid spell-generation-grid canonical-spell-choice-grid"><MatchSpellChoiceCard v-for="choice in caster.choices" :key="choice.id" :choice="choice" :selectable="false" kind-label="Prayer" /></div>
                <div v-else class="setup-inline-status">No {{ caster.kind === 'Wizard' ? 'spell' : 'prayer' }} list could be read for {{ caster.selectedLore || caster.name }}.</div>
              </div>
            </details>
          </template>
        </div>

        <div v-else-if="isOverviewStep" class="game-overview-dashboard">
          <MatchTipPanel v-if="tipsVisible" title="Tip — Battle Overview" :text="setupTip" :collapsed="currentTipCollapsed" @toggle="setCurrentTipCollapsed" />
          <section class="overview-status-grid prebattle-overview-status-grid"><article><small>Scenario</small><strong>{{ game.scenario }}</strong></article><article><small>Battle size</small><strong>{{ game.points }} pts</strong></article><article><small>First turn</small><strong>{{ game.firstPlayerConfirmed ? (game.firstPlayer === 'player' ? game.playerName : game.opponentName) : 'Resolve after deployment' }}</strong></article></section>
          <section class="overview-matchup card-inset"><div><p class="eyebrow">FRIENDLY</p><h3>{{ game.playerName }}</h3><strong>{{ game.playerListName }}</strong><p>{{ game.playerArmyName }} · {{ game.playerPoints || playerActualPoints || game.points }} pts</p></div><span>—</span><div><p class="eyebrow">ENEMY</p><h3>{{ game.opponentName }}</h3><strong>{{ game.opponentListName || 'No enemy roster' }}</strong><p>{{ game.opponentArmyName || 'Opponent' }} · {{ game.opponentPoints || opponentActualPoints || 0 }} pts</p></div></section>
          <section class="overview-battlefield-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">BATTLEFIELD &amp; SCENARIO</p><h3>{{ game.scenario }}</h3></div></div><details class="phase-rule-details scenario-inline-details"><summary>Scenario rules</summary><div><p v-if="scenarioGuidance?.setupText"><strong>Set-up:</strong> {{ scenarioGuidance.setupText }}</p><p v-if="scenarioGuidance?.deploymentText"><strong>Deployment:</strong> {{ scenarioGuidance.deploymentText }}</p><p v-if="scenarioGuidance?.firstTurnText"><strong>First turn:</strong> {{ scenarioGuidance.firstTurnText }}</p><p v-for="rule in scenarioGuidance?.scenarioRules || []" :key="rule">{{ rule }}</p></div></details><img v-if="scenarioGuidance?.mapImageUrl" class="scenario-deployment-map overview-scenario-map" :src="scenarioGuidance.mapImageUrl" :alt="`${game.scenario} battlefield and deployment map`" loading="lazy" decoding="async" /><div v-if="battlefieldConditionRows.length" class="overview-condition-list"><article v-for="condition in battlefieldConditionRows" :key="condition.id"><strong>{{ condition.label }}</strong><RouterLink :to="`/rules/read${condition.path}`">Open rules</RouterLink></article></div></section>
          <section class="overview-composition-options card-inset"><div class="setup-section-heading"><div><p class="eyebrow">COMPOSITION OPTIONS</p><h3>Roster Battle Options</h3></div></div><div class="overview-composition-columns"><article><strong>Friendly</strong><div v-if="playerOptionLabels.length" class="match-option-chips"><span v-for="label in playerOptionLabels" :key="`overview-player-${label}`">{{ label }}</span></div><p v-else>No additional options.</p></article><article><strong>Enemy</strong><div v-if="opponentOptionLabels.length" class="match-option-chips"><span v-for="label in opponentOptionLabels" :key="`overview-opponent-${label}`">{{ label }}</span></div><p v-else>No additional options.</p></article></div></section>
          <section class="overview-magic-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">PREPARED MAGIC</p><h3>Friendly Wizards & Priests</h3></div></div><div v-if="magicCasters.length" class="overview-caster-list"><article v-for="caster in magicCasters" :key="caster.instanceId"><strong>{{ caster.name }}</strong><span>{{ caster.selectedLore || 'No lore' }}</span><small v-if="caster.kind === 'Wizard'">{{ selectedChoiceNames(caster).length ? selectedChoiceNames(caster).join(' · ') : 'Spells not recorded yet' }}</small><small v-else>Prayers available during play</small></article></div><p v-else class="setup-inline-status">No friendly Wizards or Priests detected.</p></section>
        </div>

        <div v-else-if="isDeploymentOrderStep" class="deployment-step-content">
          <MatchTipPanel v-if="tipsVisible" title="Tip — Deployment Order" :text="deploymentTip" :collapsed="currentTipCollapsed" @toggle="setCurrentTipCollapsed" />
          <section v-if="deploymentBattlefieldConditions.length" class="condition-resolution-panel card-inset">
            <div class="setup-section-heading"><div><p class="eyebrow">BATTLE CONDITIONS</p><h3>Resolve before deployment</h3></div></div>
            <details v-for="option in deploymentBattlefieldConditions" :key="`deployment-condition-${option.id}`" open class="phase-rule-details condition-resolution-details disruptive-weather-required">
              <summary><strong>{{ option.label }}</strong><span v-if="battlefieldResolvedRow(option.id)" class="value-chip">D6: {{ battlefieldResolvedRow(option.id)?.roll }}</span></summary>
              <div class="condition-resolution-body"><RouterLink :to="`/rules/read${option.path}`">Open rules</RouterLink><p>This Battle Condition must be rolled before deployment begins. Record the D6 result here before continuing.</p><strong v-if="!battlefieldResult(option.id)" class="condition-required-label">Required before continuing</strong>
                <p v-if="randomHappeningLoading.has(option.id)" class="setup-inline-status">Loading D6 table...</p>
                <div v-else-if="randomHappeningTables[option.id]?.results.length" class="random-happening-table"><div class="random-happening-table-head"><strong>D6</strong><strong>Result</strong></div><label v-for="result in randomHappeningTables[option.id]?.results || []" :key="`${option.id}-${result.roll}`" class="random-happening-row" :class="{ selected: battlefieldResult(option.id) === result.roll }"><span class="random-happening-roll"><input type="radio" :name="`deployment-random-${option.id}`" :checked="battlefieldResult(option.id) === result.roll" :disabled="isReadOnly" @change="setBattlefieldResult(option.id, result.roll)" /><strong>{{ result.roll }}</strong></span><span><strong>{{ result.title }}:</strong> {{ result.text }}</span></label></div>
                <div v-if="battlefieldResolvedRow(option.id)" class="resolved-condition-result"><strong>Recorded — {{ battlefieldResolvedRow(option.id)?.roll }}: {{ battlefieldResolvedRow(option.id)?.title }}</strong><p>{{ battlefieldResolvedRow(option.id)?.text }}</p></div>
              </div>
            </details>
          </section>
          <section class="deployment-guidance-panel card-inset"><p class="eyebrow">SCENARIO DEPLOYMENT</p><h3>{{ game.scenario }}</h3><div class="scenario-deployment-body"><p v-if="scenarioGuidance?.setupText"><strong>Set-up:</strong> {{ scenarioGuidance.setupText }}</p><p v-if="scenarioGuidance?.deploymentText"><strong>Deployment:</strong> {{ scenarioGuidance.deploymentText }}</p><p v-else>No additional scenario-specific deployment rules are listed. Use the standard deployment procedure.</p><p v-for="rule in scenarioGuidance?.scenarioRules || []" :key="`deployment-${rule}`">{{ rule }}</p><img v-if="scenarioGuidance?.mapImageUrl" class="scenario-deployment-map scenario-rules-bottom-image" :src="scenarioGuidance.mapImageUrl" :alt="`${game.scenario} battlefield and deployment map`" loading="lazy" decoding="async" /></div></section>
          <section class="deployment-order-panel card-inset"><p class="eyebrow">FIRST TO DEPLOY</p><h3>Who begins deployment?</h3><div class="deployment-side-actions"><button type="button" class="secondary-button" :class="{ active: game.deploymentFirstSide === 'player' }" :disabled="isReadOnly" @click="chooseDeploymentFirstSide('player')">{{ game.playerName }}</button><button type="button" class="secondary-button" :class="{ active: game.deploymentFirstSide === 'opponent' }" :disabled="isReadOnly" @click="chooseDeploymentFirstSide('opponent')">{{ game.opponentName }}</button></div></section>
        </div>

        <div v-else-if="isDeployArmiesStep" class="deployment-step-content">
          <MatchTipPanel v-if="tipsVisible" title="Tip — Deploying Armies" :text="deploymentTip" :collapsed="currentTipCollapsed" rule-to="/rules/read/overview-of-the-game" rule-label="Open deployment rules" @toggle="setCurrentTipCollapsed" />
          <p v-if="deploymentLoading" class="setup-inline-status">Reading deployment rules and legal formations for the friendly roster…</p>
          <section class="deployment-roster-grid friendly-only-deployment-grid"><article class="deployment-roster-panel card-inset"><div class="deployment-roster-heading"><div><p class="eyebrow">FRIENDLY ROSTER</p><h3>{{ game.playerListName }}</h3></div><strong>{{ deploymentFriendlyCount }} / {{ playerRoster.length }} deployed</strong></div><section v-for="group in deploymentRosterGroups" :key="group.id" class="deployment-category-group" :class="{ locked: !deploymentRankReady(deploymentSequenceRank(group.rows[0])) }"><header><strong>{{ group.label }}</strong><small>{{ group.detail }}</small><small v-if="!deploymentRankReady(deploymentSequenceRank(group.rows[0]))" class="deployment-stage-lock-note">Complete the previous deployment group first.</small></header><article v-for="row in group.rows" :key="row.instanceId" class="deployment-unit-row deployment-unit-guidance" :class="{ deployed: deployedPlayerIds.has(row.instanceId), reserved: reservePlayerIds.has(row.instanceId), locked: deploymentRowLocked(row) }"><div class="deployment-unit-status-controls"><label><input type="checkbox" :checked="deployedPlayerIds.has(row.instanceId)" :disabled="isReadOnly || deploymentRowLocked(row) || Boolean(isCharacter(row) && joinedHostId(row.instanceId))" @change="handleDeployedUnit('player', row.instanceId, $event)" /><span>{{ isCharacter(row) && joinedHostId(row.instanceId) ? 'Deployed with joined unit' : isWarMachine(row) ? 'Deploy war machines' : 'Deployed' }}</span></label><label title="Track this unit as held in Reserve"><input type="checkbox" :checked="reservePlayerIds.has(row.instanceId)" :disabled="isReadOnly || deploymentRowLocked(row) || Boolean(isCharacter(row) && joinedHostId(row.instanceId))" @change="handleReserveUnit(row.instanceId, $event)" /><span>Held in Reserve</span></label></div><div class="deployment-unit-copy"><div class="deployment-unit-title"><strong>{{ row.name }}</strong><small>{{ row.modelCount }} model{{ row.modelCount === 1 ? '' : 's' }} · {{ row.totalPoints }} pts</small><small class="deployment-sequence-note">{{ deploymentSequenceLabel(row) }}</small></div><label v-if="isCharacter(row)" class="deployment-character-join"><span>Joined unit</span><select :value="joinedHostId(row.instanceId)" :disabled="isReadOnly" @change="handleCharacterHost(row.instanceId, $event)"><option value="">Not joined</option><option v-for="host in joinableHostsForCharacter(row)" :key="`${row.instanceId}-join-${host.instanceId}`" :value="host.instanceId">{{ host.name }}</option></select></label><div v-if="joinedCharactersForHost(row.instanceId).length" class="joined-character-pills"><span v-for="character in joinedCharactersForHost(row.instanceId)" :key="`${row.instanceId}-joined-${character.instanceId}`">{{ character.name }}</span></div><div v-if="deploymentFor(row.instanceId)?.formations.length" class="deployment-formations"><span class="deployment-detail-label">Formation</span><RouterLink v-for="formation in deploymentFor(row.instanceId)?.formations" :key="`${row.instanceId}-${formation.label}`" :to="`/rules/read${formation.path}`">{{ formation.label }}</RouterLink></div><div v-if="deploymentFor(row.instanceId)?.deploymentRules.length" class="deployment-rule-list"><span class="deployment-detail-label">Deployment rules</span><article v-for="rule in deploymentFor(row.instanceId)?.deploymentRules" :key="`${row.instanceId}-${rule.label}`"><details class="phase-rule-details compact"><summary>{{ rule.label }}</summary><p v-if="rule.summary">{{ rule.summary }}</p></details></article></div><p v-if="deploymentFor(row.instanceId)?.canReserve" class="deployment-reserve-reason">May begin off-table / in Reserve: {{ deploymentFor(row.instanceId)?.reserveReason }}.</p></div></article></section></article></section>
          <details v-if="wildernessTerrainSelected" class="condition-resolution-panel wilderness-terrain-reminder card-inset"><summary><span><span class="eyebrow">BATTLE CONDITION</span><strong>Wilderness Terrain</strong></span><span>Expand</span></summary><div class="condition-resolution-body"><p>Roll on Wilderness Terrain only when a unit is deployed within natural terrain or ends its movement within natural terrain. Track the terrain result on the battlefield; Old.dex does not require a checkbox or saved result for this condition.</p><RouterLink to="/rules/read/battle-march/wilderness-terrain">Open rules</RouterLink><div v-if="randomHappeningTables['wilderness-terrain']?.results.length" class="random-happening-table"><div class="random-happening-table-head"><strong>D6</strong><strong>Result</strong></div><div v-for="result in randomHappeningTables['wilderness-terrain']?.results || []" :key="`wilderness-deploy-${result.roll}`" class="random-happening-row"><span class="random-happening-roll"><strong>{{ result.roll }}</strong></span><span><strong>{{ result.title }}:</strong> {{ result.text }}</span></div></div></div></details>
          <section class="game-first-turn-window deployment-first-turn-window card-inset" aria-label="First turn result"><p class="eyebrow">FIRST TURN</p><strong>Who takes the first turn?</strong><p>{{ firstTurnProcedureText }}</p><div class="game-first-turn-actions"><button type="button" class="secondary-button friendly-turn-action" :class="{ active: game.firstPlayerConfirmed && game.firstPlayer === 'player' }" :disabled="isReadOnly" @click="chooseFirstPlayer('player')">{{ game.playerListName }}</button><button type="button" class="secondary-button enemy-turn-action" :class="{ active: game.firstPlayerConfirmed && game.firstPlayer === 'opponent' }" :disabled="isReadOnly" @click="chooseFirstPlayer('opponent')">{{ game.opponentListName || game.opponentName }}</button></div></section>
        </div>

        <div v-else-if="isRoundStartStep" class="round-start-content">
          <MatchTipPanel v-if="tipsVisible" title="Tip — Start of Round" :text="deploymentTip" :collapsed="currentTipCollapsed" rule-to="/rules/read/the-turn-sequence" rule-label="Open Turn Sequence rules" @toggle="setCurrentTipCollapsed" />
          <details v-if="wildernessTerrainSelected" class="wilderness-terrain-reminder card-inset"><summary><strong>Wilderness Terrain</strong><span>Battle Condition</span></summary><div><p>Whenever a unit ends its movement within natural terrain, roll on the Wilderness Terrain table and track that terrain result on the battlefield.</p><RouterLink to="/rules/read/battle-march/wilderness-terrain">Open rules</RouterLink><div v-if="randomHappeningTables['wilderness-terrain']?.results.length" class="random-happening-table"><div class="random-happening-table-head"><strong>D6</strong><strong>Result</strong></div><div v-for="result in randomHappeningTables['wilderness-terrain']?.results || []" :key="`wilderness-reminder-${phase?.id}-${step?.id}-${result.roll}`" class="random-happening-row"><span class="random-happening-roll"><strong>{{ result.roll }}</strong></span><span><strong>{{ result.title }}:</strong> {{ result.text }}</span></div></div></div></details>
          <p v-if="startRoundLoading" class="setup-inline-status">Checking both rosters and battle rules for Start of Round effects…</p>
          <section v-if="isRoundBattleEffectsStep" class="start-round-rule-panel battle card-inset"><div class="setup-section-heading"><div><p class="eyebrow">STEP 1 · BATTLE</p><h3>Scenario, Composition &amp; Battlefield</h3></div></div><template v-if="battleStartRoundRules.length"><details v-for="rule in battleStartRoundRules" :key="`${rule.source}-${rule.label}`" class="phase-rule-details"><summary><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span></summary><div v-if="rule.source === 'Battlefield' && battlefieldResolvedRowForPath(rule.path)" class="resolved-condition-result"><strong>{{ battlefieldResolvedRowForPath(rule.path)?.title }}</strong><p>{{ battlefieldResolvedRowForPath(rule.path)?.text }}</p></div><div v-else class="match-rule-copy"><p v-for="paragraph in ruleParagraphs(rule.summary)" :key="paragraph">{{ paragraph }}</p></div></details></template><p v-else class="setup-inline-status">No actions.</p></section>
          <section v-if="isRoundPlayerEffectsStep" class="start-round-rule-columns"><article class="start-round-rule-panel friendly card-inset"><div class="setup-section-heading"><div><p class="eyebrow">STEP 2 · FRIENDLY</p><h3>Army &amp; Model Rules</h3></div></div><template v-if="friendlyStartRoundRules.length"><details v-for="rule in friendlyStartRoundRules" :key="`${rule.source}-${rule.label}`" class="phase-rule-details"><summary><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span></summary><div class="match-rule-copy"><p v-for="paragraph in ruleParagraphs(rule.summary)" :key="paragraph">{{ paragraph }}</p></div></details></template><p v-else class="setup-inline-status">No actions.</p></article><article class="start-round-rule-panel enemy card-inset"><div class="setup-section-heading"><div><p class="eyebrow">STEP 2 · ENEMY</p><h3>Army &amp; Model Rules</h3></div></div><template v-if="enemyStartRoundRules.length"><details v-for="rule in enemyStartRoundRules" :key="`${rule.source}-${rule.label}`" class="phase-rule-details"><summary><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span></summary><div class="match-rule-copy"><p v-for="paragraph in ruleParagraphs(rule.summary)" :key="paragraph">{{ paragraph }}</p></div></details></template><p v-else class="setup-inline-status">No actions.</p></article></section>
        </div>

        <section v-if="isBattleTurnPhase" class="turn-guidance-shell">
          <MatchTipPanel v-if="tipsVisible && battleStepTip && !isAnyDeclareChargeStep && !isCombatResultStep" :title="`Tip — ${step.label}`" :text="battleStepTip" :collapsed="currentTipCollapsed" :rule-to="`/rules/read${battleStepRulePath}`" rule-label="Open phase rules" @toggle="setCurrentTipCollapsed" />
          <details v-if="wildernessTerrainSelected" class="wilderness-terrain-reminder card-inset"><summary><strong>Wilderness Terrain</strong><span>Battle Condition</span></summary><div><p>Whenever a unit ends its movement within natural terrain, roll on the Wilderness Terrain table and track that terrain result on the battlefield.</p><RouterLink to="/rules/read/battle-march/wilderness-terrain">Open rules</RouterLink><div v-if="randomHappeningTables['wilderness-terrain']?.results.length" class="random-happening-table"><div class="random-happening-table-head"><strong>D6</strong><strong>Result</strong></div><div v-for="result in randomHappeningTables['wilderness-terrain']?.results || []" :key="`wilderness-reminder-${phase?.id}-${step?.id}-${result.roll}`" class="random-happening-row"><span class="random-happening-roll"><strong>{{ result.roll }}</strong></span><span><strong>{{ result.title }}:</strong> {{ result.text }}</span></div></div></div></details>
          <article v-if="showChaosOfWarResolution" class="condition-resolution-panel chaos-of-war-resolution card-inset">
            <div class="setup-section-heading"><div><p class="eyebrow">BATTLE CONDITION</p><h3>Chaos of War</h3></div><RouterLink to="/rules/read/battle-march/the-chaos-of-war">Open rules</RouterLink></div>
            <p class="setup-inline-status">When using the Chaos of War in your games, from their second turn onwards, the player who took the first turn rolls a D6 at the beginning of each of their Start of Turn sub-phases. If the number rolled is equal to or lower than their current turn number, their opponent rolls a D6 on the table below, re-rolling any results rolled previously.</p>
            <div v-if="randomHappeningTables['chaos-of-war']?.results.length" class="random-happening-table">
              <div class="random-happening-table-head"><strong>D6</strong><strong>Result</strong></div>
              <label v-for="result in randomHappeningTables['chaos-of-war']?.results || []" :key="`chaos-${result.roll}`" class="random-happening-row" :class="{ selected: battlefieldResult(chaosOfWarResultKey) === result.roll }"><span class="random-happening-roll"><input type="radio" :name="`chaos-of-war-result-${turnViewSide}`" :checked="battlefieldResult(chaosOfWarResultKey) === result.roll" :disabled="isReadOnly || chaosOfWarPreviousRolls.has(result.roll)" @change="setBattlefieldResult(chaosOfWarResultKey, result.roll)" /><strong>{{ result.roll }}</strong></span><span><strong>{{ result.title }}:</strong> {{ result.text }}</span></label>
            </div>
            <div v-if="battlefieldResolvedRow('chaos-of-war', chaosOfWarResultKey)" class="resolved-condition-result"><strong>Recorded — {{ battlefieldResolvedRow('chaos-of-war', chaosOfWarResultKey)?.roll }}: {{ battlefieldResolvedRow('chaos-of-war', chaosOfWarResultKey)?.title }}</strong><p>{{ battlefieldResolvedRow('chaos-of-war', chaosOfWarResultKey)?.text }}</p></div>
          </article>
          <article v-if="isDeclareChargeStep" class="match-procedure-panel charge-procedure-panel card-inset"><p class="eyebrow">CHARGE PROCEDURE</p><h3>Declare, roll &amp; resolve one charge at a time</h3><p>Choose an eligible charging unit and a legal target within its maximum declaration range. Declare the charge and resolve the target's charge reaction. For the Charge roll, roll 2D6 and discard the lower die; add the higher result to the unit's Movement characteristic, then apply any charge-roll or maximum-range rules shown with that unit. If that range reaches the target, complete the Charge Move; otherwise move directly toward the target by the Charge roll as a failed charge. Finish the entire charge before declaring another.</p><RouterLink :to="`/rules/read${battleStepRulePath}`">Open charge rules</RouterLink></article>
          <article v-if="isEnemyDeclareChargeStep" class="match-procedure-panel charge-reaction-procedure-panel card-inset"><p class="eyebrow">CHARGE REACTIONS</p><h3>Resolve each friendly unit's reaction when it is charged</h3><p>When the enemy declares a charge, choose a legal reaction for the unit being charged before the enemy rolls its charge. Hold accepts the charge. Flee immediately resolves a flee move. Stand &amp; Shoot is available only when the unit has a selected missile weapon and the normal range/restriction requirements are met. Special reactions such as Counter Charge appear only when that unit has the rule.</p><RouterLink to="/rules/read/the-movement-phase/charge-reactions">Open charge reaction rules</RouterLink></article>
          <article v-if="isCombatResultStep" class="match-procedure-panel break-procedure-panel card-inset"><p class="eyebrow">COMBAT PROCEDURE</p><h3>Combat Result, Break Tests &amp; follow up</h3><p>Resolve one combat completely before moving to the next. Record casualties or wounds, total Combat Result and mark each friendly unit as winner, loser or draw. A losing unit rolls 2D6 and adds the amount by which it lost. Compare the natural and modified totals with the highest Leadership in the unit: a natural total above Leadership Breaks and flees; a natural total at or below Leadership but a modified total above Leadership Falls Back in Good Order; a modified total at or below Leadership, or natural double 1, Gives Ground. Winning units then record the legal follow-up, pursuit, restraint or overrun response.</p><div class="procedure-rule-links"><RouterLink to="/rules/read/the-combat-phase/calculate-combat-result">Combat Result rules</RouterLink><RouterLink to="/rules/read/the-combat-phase/break-test">Break Test rules</RouterLink><RouterLink to="/rules/read/the-combat-phase/follow-up-and-pursuit">Follow Up rules</RouterLink></div></article>

          <p v-if="turnGuidanceLoading" class="setup-inline-status">Checking the friendly roster, spells, battlefield and battle rules for this {{ turnContextLabel.toLowerCase() }} step…</p>
          <template v-else>
            <article v-if="battleTurnGuidanceDisplay.length" class="turn-guidance-panel battle card-inset scenario-priority-panel">
              <div class="setup-section-heading"><div><p class="eyebrow">BATTLE &amp; BATTLEFIELD RULES</p><h3>Scenario, Battlefield &amp; Battle Rules</h3></div></div>
              <details v-for="(rule, battleIndex) in battleTurnGuidanceDisplay" :key="`${rule.source}-${rule.label}-${rule.path || ''}-${battleIndex}`" class="phase-rule-details turn-rule-details" :class="{ complete: guidanceChecked(rule, battleIndex) }">
                <summary><label class="turn-action-check" @click.stop><input type="checkbox" :checked="guidanceChecked(rule, battleIndex)" :disabled="isReadOnly" @change="toggleGuidanceCheck(rule, battleIndex, ($event.target as HTMLInputElement).checked)" /><span aria-hidden="true"></span></label><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span></summary>
                <div v-if="rule.sourceKind === 'battlefield' && battlefieldResolvedRowForRule(rule)" class="resolved-condition-result"><strong>{{ battlefieldResolvedRowForRule(rule)?.title }}</strong><p>{{ battlefieldResolvedRowForRule(rule)?.text }}</p></div>
                <div v-else class="match-rule-copy"><p v-for="paragraph in ruleParagraphs(rule.summary)" :key="paragraph">{{ paragraph }}</p></div>
              </details>
            </article>

            <article v-if="spellGuidance.length" class="turn-guidance-panel combat-spell-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">{{ spellPanelEyebrow }}</p><h3>{{ spellPanelTitle }}</h3><small class="optional-check-hint">Resolve the spell from its normal rule box, then record whether the casting attempt succeeded or failed.</small></div></div><div class="match-phase-spell-grid"><MatchSpellChoiceCard v-for="rule in spellGuidance" :key="`${rule.source}-${rule.label}-${rule.id}`" :choice="spellGuidanceChoice(rule)" :selectable="false" :source-label="rule.source" :track-result="true" :result="spellResult(rule)" :disabled="isReadOnly" @result="setSpellResult(rule, $event)" /></div></article>

            <article v-if="isShootingStep" class="turn-guidance-panel shooting-weapon-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">RANGED WEAPONS</p><h3>Units able to shoot</h3><small class="optional-check-hint">BS and To Hit use the roster-derived match profile. Selected modifiers are cumulative and update the target roll immediately.</small></div></div><div v-if="shootingUnits.length" class="shooting-unit-list"><article v-for="entry in shootingUnits" :key="`shooting-${entry.unit.instanceId}`" class="shooting-unit-row" :class="{ complete: shootingUnitChecked(entry.unit.instanceId) }"><label class="turn-action-check"><input type="checkbox" :checked="shootingUnitChecked(entry.unit.instanceId)" :disabled="isReadOnly" @change="toggleShootingUnit(entry.unit.instanceId, ($event.target as HTMLInputElement).checked)" /><span aria-hidden="true"></span></label><div class="shooting-unit-copy"><header><RouterLink :to="matchUnitProfileRoute(entry.unit)"><strong>{{ entry.unit.name }}</strong></RouterLink><div class="shooting-bs-summary"><span class="value-chip">BS {{ ballisticSkill(entry.unit.instanceId) || '—' }}</span><span class="value-chip shooting-to-hit-chip">To Hit {{ shootingToHitLabel(entry.unit.instanceId) }}</span><span v-if="shootingModifierTotal(entry.unit.instanceId)" class="value-chip">Modifier {{ shootingModifierTotal(entry.unit.instanceId) }}</span></div><small v-if="joinedHostId(entry.unit.instanceId)">Joined to {{ joinedHostName(entry.unit.instanceId) }}</small></header><details v-if="ballisticSkillRows(entry.unit.instanceId).length > 1" class="shooting-bs-breakdown"><summary>Different Ballistic Skills in this unit</summary><div><span v-for="row in ballisticSkillRows(entry.unit.instanceId)" :key="`${entry.unit.instanceId}-${row.name}-${row.bs}`"><strong>{{ row.name }}</strong><small>BS {{ row.bs }} · To Hit {{ shootingToHitFor(entry.unit.instanceId, row.bs).label }}</small></span></div></details><div class="shooting-penalty-options" aria-label="Shooting To Hit modifiers"><label v-for="penalty in shootingPenaltyOptions" :key="`${entry.unit.instanceId}-${penalty.id}`" :class="{ selected: shootingPenaltyIds(entry.unit.instanceId).has(penalty.id) }"><input type="checkbox" :checked="shootingPenaltyIds(entry.unit.instanceId).has(penalty.id)" :disabled="isReadOnly" @change="toggleShootingPenalty(entry.unit.instanceId, penalty.id, ($event.target as HTMLInputElement).checked)" /><span>{{ penalty.label }}</span><strong>{{ penalty.modifier }}</strong></label></div><div class="shooting-weapon-list"><div v-for="weapon in entry.weapons" :key="`${entry.unit.instanceId}-${weapon.id}`" class="shooting-weapon-row"><strong>{{ weapon.name }}<small v-if="weapon.count > 1"> ×{{ weapon.count }}</small></strong><span>{{ weapon.range }}</span><span>S {{ weapon.strength }}</span><span>AP {{ weapon.ap }}</span><small v-if="weapon.rules.length">{{ weapon.rules.join(' · ') }}</small></div></div></div></article></div><p v-else class="setup-inline-status">No selected ranged weapons were found in the friendly roster.</p></article>

            <article v-if="showGenericActionPanel" class="turn-guidance-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">SPECIAL RULES &amp; ACTIONS</p><h3>{{ turnContextLabel }} — {{ step.label }}</h3><small class="optional-check-hint">Checks are optional and only track what you have resolved.</small></div></div>
              <template v-if="normalFriendlyGuidance.length"><article v-for="(rule, ruleIndex) in normalFriendlyGuidance" :key="`${rule.source}-${rule.label}-${rule.path || ''}`" class="start-round-rule-row turn-action-row" :class="{ complete: guidanceChecked(rule, battleTurnGuidanceDisplay.length + spellGuidance.length + ruleIndex) }"><label class="turn-action-check"><input type="checkbox" :checked="guidanceChecked(rule, battleTurnGuidanceDisplay.length + spellGuidance.length + ruleIndex)" :disabled="guidanceDisabled(rule, battleTurnGuidanceDisplay.length + spellGuidance.length + ruleIndex)" @change="toggleGuidanceCheck(rule, battleTurnGuidanceDisplay.length + spellGuidance.length + ruleIndex, ($event.target as HTMLInputElement).checked)" /><span aria-hidden="true"></span></label><details class="phase-rule-details turn-rule-details"><summary><strong>{{ rule.source }}</strong><span>{{ rule.label }}<small v-if="rule.useLimit" class="tracked-quantity">{{ guidanceQuantityText(rule) }}</small><small v-if="isFatedDispelRule(rule) && fatedDispelUsedThisRound" class="tracked-quantity fated-dispel-used">USED THIS ROUND</small></span></summary><div class="match-rule-copy"><p v-for="paragraph in ruleParagraphs(rule.summary)" :key="paragraph">{{ paragraph }}</p></div></details></article></template>
              <template v-if="requiredChargeRuleGuidance.length"><details v-for="rule in requiredChargeRuleGuidance" :key="`${rule.label}-${rule.path || ''}`" class="phase-rule-details required-charge-rule-details"><summary class="required-charge-rule-summary"><strong>{{ rule.label }}</strong><span v-if="rule.unitRefs?.length" class="required-charge-unit-pills"><span v-for="unit in rule.unitRefs" :key="`${rule.label}-${unit.instanceId}`">{{ unit.name }} — Ld {{ unitLeadershipByInstanceId(unit.instanceId) }}</span></span></summary><div class="match-rule-copy"><p v-for="paragraph in ruleParagraphs(rule.summary)" :key="paragraph">{{ paragraph }}</p></div></details></template>
              <p v-if="!normalFriendlyGuidance.length && !requiredChargeRuleGuidance.length" class="setup-inline-status">No actions.</p>
            </article>

            <article v-if="isRallyStep" class="turn-guidance-panel rally-tracker-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">RALLY FLEEING TROOPS</p><h3>Fleeing units</h3><small class="optional-check-hint">Fleeing state persists between turns and rounds until the unit rallies or is removed.</small></div></div><div v-if="fleeingUnits.length" class="rally-unit-list"><article v-for="unit in fleeingUnits" :key="`rally-${unit.instanceId}`"><strong>{{ unit.name }} — Ld {{ unitLeadershipByInstanceId(unit.instanceId) }}</strong><div class="charge-test-controls"><label><input type="checkbox" :checked="rallyResult(unit.instanceId) === 'pass'" :disabled="isReadOnly" @change="setRallyResult(unit.instanceId, 'pass', ($event.target as HTMLInputElement).checked)" /><span>Rallied</span></label><label><input type="checkbox" :checked="rallyResult(unit.instanceId) === 'fail'" :disabled="isReadOnly" @change="setRallyResult(unit.instanceId, 'fail', ($event.target as HTMLInputElement).checked)" /><span>Failed</span></label></div></article></div><p v-else class="setup-inline-status">No friendly units are currently fleeing.</p></article>

            <article v-if="isRequiredChargeStep && requiredChargeUnits.length" class="turn-guidance-panel required-charge-test-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">REQUIRED CHARGE TEST</p><h3>Units that must test</h3></div></div><div class="required-charge-unit-grid"><div v-for="unit in requiredChargeUnits" :key="unit.instanceId" class="required-charge-test-unit"><strong>{{ unit.name }} — Ld {{ unitLeadershipByInstanceId(unit.instanceId) }}</strong><div class="charge-test-controls" role="group" :aria-label="`${unit.name} required charge test`"><label><input type="checkbox" :checked="chargeTestResult(unit.instanceId) === 'pass'" :disabled="isReadOnly" @change="setChargeTestResult(unit.instanceId, 'pass', ($event.target as HTMLInputElement).checked)" /><span>Pass</span></label><label><input type="checkbox" :checked="chargeTestResult(unit.instanceId) === 'fail'" :disabled="isReadOnly" @change="setChargeTestResult(unit.instanceId, 'fail', ($event.target as HTMLInputElement).checked)" /><span>Fail</span></label></div></div></div></article>

            <article v-if="isDeclareChargeStep" class="turn-guidance-panel declare-charge-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">CHARGE SEQUENCE</p><h3>Eligible charging units</h3><small class="optional-check-hint">Joined characters travel with their unit and are not listed as separate chargers.</small></div></div><div v-if="declareChargeGuidance.length" class="declare-charge-sequence-list"><article v-for="(rule, index) in declareChargeGuidance" :key="`${rule.source}-${rule.unitRefs?.[0]?.instanceId || index}`" class="declare-resolve-charge-row" :class="{ complete: chargeHeld(rule.unitRefs?.[0]?.instanceId || '') || chargeInCombat(rule.unitRefs?.[0]?.instanceId || '') || chargeDeclared(rule.unitRefs?.[0]?.instanceId || ''), required: rule.requiredCharge, held: chargeHeld(rule.unitRefs?.[0]?.instanceId || ''), inCombat: chargeInCombat(rule.unitRefs?.[0]?.instanceId || ''), successful: chargeSuccessful(rule.unitRefs?.[0]?.instanceId || '') }"><header><div><strong>{{ rule.unitRefs?.[0]?.name || rule.source }}</strong><small v-if="rule.requiredCharge">MUST CHARGE IF POSSIBLE</small><small v-else>Declare this charge only if the unit is eligible and you choose to charge.</small><div v-if="joinedCharactersForHost(rule.unitRefs?.[0]?.instanceId || '').length" class="joined-character-pills"><span v-for="character in joinedCharactersForHost(rule.unitRefs?.[0]?.instanceId || '')" :key="`charge-joined-${character.instanceId}`">{{ character.name }}</span></div></div><span class="declare-charge-range"><small>MAX DECLARATION RANGE</small><strong>{{ rule.unitRefs?.[0]?.chargeRange || 'See profile' }}</strong><em v-if="rule.unitRefs?.[0]?.chargeRangeNote">{{ rule.unitRefs?.[0]?.chargeRangeNote }}</em></span></header><div class="charge-resolution-checks"><label><input type="checkbox" :checked="chargeHeld(rule.unitRefs?.[0]?.instanceId || '')" :disabled="isReadOnly || chargeInCombat(rule.unitRefs?.[0]?.instanceId || '') || chargeDeclared(rule.unitRefs?.[0]?.instanceId || '') || chargeSuccessful(rule.unitRefs?.[0]?.instanceId || '')" @change="setChargeHeld(rule.unitRefs?.[0]?.instanceId || '', ($event.target as HTMLInputElement).checked)" /><span>Hold</span></label><label><input type="checkbox" :checked="chargeInCombat(rule.unitRefs?.[0]?.instanceId || '')" :disabled="isReadOnly || chargeHeld(rule.unitRefs?.[0]?.instanceId || '') || chargeDeclared(rule.unitRefs?.[0]?.instanceId || '') || chargeSuccessful(rule.unitRefs?.[0]?.instanceId || '')" @change="setChargeInCombat(rule.unitRefs?.[0]?.instanceId || '', ($event.target as HTMLInputElement).checked)" /><span>In Combat</span></label><label><input type="checkbox" :checked="chargeDeclared(rule.unitRefs?.[0]?.instanceId || '')" :disabled="isReadOnly || chargeHeld(rule.unitRefs?.[0]?.instanceId || '') || chargeInCombat(rule.unitRefs?.[0]?.instanceId || '')" @change="setChargeDeclared(rule.unitRefs?.[0]?.instanceId || '', ($event.target as HTMLInputElement).checked)" /><span>Charge declared</span></label><label><input type="checkbox" :checked="chargeSuccessful(rule.unitRefs?.[0]?.instanceId || '')" :disabled="isReadOnly || chargeHeld(rule.unitRefs?.[0]?.instanceId || '') || chargeInCombat(rule.unitRefs?.[0]?.instanceId || '')" @change="setChargeSuccessful(rule.unitRefs?.[0]?.instanceId || '', ($event.target as HTMLInputElement).checked)" /><span>Successful</span></label></div><details v-if="chargeRelatedRules(rule).length" class="phase-rule-details charge-unit-rule-details"><summary>Rules that apply while resolving this charge</summary><article v-for="related in chargeRelatedRules(rule)" :key="`${related.label}-${related.path || ''}-${related.summary}`" class="charge-related-rule"><strong>{{ related.label }}</strong><div class="match-rule-copy"><p v-for="paragraph in ruleParagraphs(related.summary)" :key="paragraph">{{ paragraph }}</p></div><RouterLink v-if="related.path" :to="`/rules/read${related.path}`">Open rule</RouterLink></article></details></article></div><p v-else class="setup-inline-status">No friendly unit is available for a charge declaration in the current roster snapshot.</p></article>

            <article v-if="isEnemyDeclareChargeStep" class="turn-guidance-panel charge-reaction-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">CHARGE REACTIONS</p><h3>Friendly units</h3><small class="optional-check-hint">Joined Characters use the reaction chosen for the unit they joined and are not listed separately.</small></div></div><div v-if="enemyChargeReactionUnits.length" class="charge-reaction-unit-list"><article v-for="unit in enemyChargeReactionUnits" :key="`reaction-${unit.instanceId}`" class="charge-reaction-unit"><header><div><strong>{{ unit.name }}</strong><div v-if="joinedCharactersForHost(unit.instanceId).length" class="joined-character-pills"><span v-for="character in joinedCharactersForHost(unit.instanceId)" :key="`reaction-joined-${character.instanceId}`">{{ character.name }}</span></div></div><small v-if="chargeReaction(unit.instanceId)" class="value-chip">{{ chargeReactionLabel(chargeReaction(unit.instanceId)) }}</small></header><div class="charge-reaction-options"><label><input type="checkbox" :checked="chargeReaction(unit.instanceId) === 'hold'" :disabled="isReadOnly" @change="setChargeReaction(unit.instanceId, 'hold', ($event.target as HTMLInputElement).checked)" /><span>Hold</span></label><label v-if="missileWeaponsForUnit(unit.instanceId).length"><input type="checkbox" :checked="chargeReaction(unit.instanceId) === 'stand-shoot'" :disabled="isReadOnly" @change="setChargeReaction(unit.instanceId, 'stand-shoot', ($event.target as HTMLInputElement).checked)" /><span>Stand &amp; Shoot</span></label><label><input type="checkbox" :checked="chargeReaction(unit.instanceId) === 'flee'" :disabled="isReadOnly" @change="setChargeReaction(unit.instanceId, 'flee', ($event.target as HTMLInputElement).checked)" /><span>Flee</span></label><label v-if="unitHasCounterCharge(unit.instanceId)"><input type="checkbox" :checked="chargeReaction(unit.instanceId) === 'counter-charge'" :disabled="isReadOnly" @change="setChargeReaction(unit.instanceId, 'counter-charge', ($event.target as HTMLInputElement).checked)" /><span>Counter Charge</span></label></div><details v-if="chargeReactionRules(unit.instanceId).length" class="phase-rule-details charge-unit-rule-details"><summary>Rules that apply to this charge reaction</summary><article v-for="rule in chargeReactionRules(unit.instanceId)" :key="`reaction-rule-${unit.instanceId}-${rule.label}-${rule.path || ''}`" class="charge-related-rule"><strong>{{ rule.label }}</strong><div class="match-rule-copy"><p v-for="paragraph in ruleParagraphs(rule.summary)" :key="paragraph">{{ paragraph }}</p></div><RouterLink v-if="rule.path" :to="`/rules/read${rule.path}`">Open rule</RouterLink></article></details></article></div><p v-else class="setup-inline-status">No friendly units are available to receive a charge.</p></article>

            <article v-if="isCompulsoryMoveStep" class="turn-guidance-panel movement-unit-panel compulsory-move-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">COMPULSORY MOVES</p><h3>Units that require compulsory movement</h3></div></div><div v-if="compulsoryMovementUnits.length" class="movement-unit-checklist"><label v-for="unit in compulsoryMovementUnits" :key="unit.instanceId" :class="{ complete: compulsoryMoved(unit.instanceId) }"><input type="checkbox" :checked="compulsoryMoved(unit.instanceId)" :disabled="isReadOnly" @change="setCompulsoryMoved(unit.instanceId, ($event.target as HTMLInputElement).checked)" /><span><strong>{{ unit.name }}</strong><small>Compulsory movement resolved</small></span></label></div><p v-else class="setup-inline-status">No friendly units currently require a tracked compulsory move.</p></article>

            <article v-if="isRemainingMoveStep" class="turn-guidance-panel movement-unit-panel remaining-move-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">REMAINING MOVES</p><h3>Units still available to move</h3><small class="optional-check-hint">Units that declared a charge, resolved compulsory movement, or remain in Reserve are excluded automatically.</small></div></div><div v-if="remainingMoveUnits.length" class="movement-unit-checklist remaining-move-list"><article v-for="unit in remainingMoveUnits" :key="`remaining-${unit.instanceId}`" class="remaining-move-unit" :class="{ complete: Boolean(remainingMoveMode(unit.instanceId)) }"><header><strong>{{ unit.name }}</strong><small v-if="movementCharacteristic(unit)">M {{ movementCharacteristic(unit) }}</small></header><div class="remaining-move-options"><label><input type="checkbox" :checked="remainingMoveMode(unit.instanceId) === 'normal'" :disabled="isReadOnly" @change="setRemainingMoveMode(unit.instanceId, 'normal', ($event.target as HTMLInputElement).checked)" /><span>Normal Move</span><strong>{{ remainingMoveDistance(unit, 'normal') }}</strong></label><label><input type="checkbox" :checked="remainingMoveMode(unit.instanceId) === 'march'" :disabled="isReadOnly" @change="setRemainingMoveMode(unit.instanceId, 'march', ($event.target as HTMLInputElement).checked)" /><span>March</span><strong>{{ remainingMoveDistance(unit, 'march') }}</strong></label><label><input type="checkbox" :checked="remainingMoveMode(unit.instanceId) === 'hold'" :disabled="isReadOnly" @change="setRemainingMoveMode(unit.instanceId, 'hold', ($event.target as HTMLInputElement).checked)" /><span>Hold</span></label></div><div v-if="joinedCharactersForHost(unit.instanceId).length" class="joined-character-leave-list"><span class="deployment-detail-label">Joined characters</span><div v-for="character in joinedCharactersForHost(unit.instanceId)" :key="`remaining-joined-${character.instanceId}`"><strong>{{ character.name }}</strong><button type="button" class="secondary-button" :disabled="isReadOnly || Boolean(remainingMoveMode(unit.instanceId))" @click="leaveCharacter(character.instanceId)">Leave unit</button></div></div></article></div><p v-else class="setup-inline-status">No friendly units remain eligible for an ordinary Remaining Move.</p></article>
            <article v-if="isCombatFightStep" class="turn-guidance-panel combat-unit-panel combat-profile-panel card-inset">
              <div class="setup-section-heading"><div><p class="eyebrow">CHOOSE &amp; FIGHT COMBAT</p><h3>Friendly roster units</h3><small class="optional-check-hint">Mark the friendly roster entries that fought in this Combat phase. Joined Characters remain separate entries for wound tracking.</small></div></div>
              <div v-if="combatFightUnits.length" class="combat-fight-list"><article v-for="unit in combatFightUnits" :key="unit.instanceId" class="combat-fight-unit" :class="{ complete: combatUnitChecked(unit.instanceId) }"><label class="turn-action-check combat-fight-check"><input type="checkbox" :checked="combatUnitChecked(unit.instanceId)" :disabled="isReadOnly" @change="toggleCombatUnit(unit.instanceId, ($event.target as HTMLInputElement).checked)" /><span aria-hidden="true"></span></label><div class="combat-fight-unit-copy"><div class="combat-unit-name-line"><RouterLink class="combat-profile-roster-link" :to="matchUnitProfileRoute(unit)"><strong>{{ unit.name }}</strong></RouterLink><span v-if="unitChargedThisTurn(unit.instanceId)" class="value-chip combat-charged-chip">Charged</span></div><small>{{ combatRemainingLabel(unit) }}</small><small v-if="joinedHostId(unit.instanceId)" class="combat-joined-note">Joined to {{ joinedHostName(unit.instanceId) }}</small></div></article></div>
              <p v-else class="setup-inline-status">No active friendly roster units remain available for Combat.</p>
            </article>

            <article v-if="isCombatResultStep" class="turn-guidance-panel combat-result-tracker combined-combat-resolution card-inset">
              <div class="setup-section-heading"><div><p class="eyebrow">COMBAT RESULT &amp; BREAK TESTS</p><h3>Resolve units that fought</h3><small class="optional-check-hint">Destroyed models, wounds and command-model losses are persistent match state and carry into every later turn and round.</small></div></div>
              <div v-if="foughtUnits.length" class="combat-result-unit-list">
                <article v-for="unit in foughtUnits" :key="`combat-result-${unit.instanceId}`" class="combat-result-unit compact-combat-resolution">
                  <header><div><strong>{{ unit.name }}</strong><small v-if="joinedHostId(unit.instanceId)" class="combat-joined-note">Joined to {{ joinedHostName(unit.instanceId) }}</small></div><div class="casualty-stepper"><span>{{ casualtyLabel(unit) }}</span><div><button type="button" :disabled="isReadOnly || destroyedCount(unit.instanceId) <= 0" @click="adjustCasualties(unit, -1)">−</button><strong>{{ destroyedCount(unit.instanceId) }} / {{ casualtyLimit(unit) }}</strong><button type="button" :disabled="isReadOnly || destroyedCount(unit.instanceId) >= casualtyLimit(unit)" @click="adjustCasualties(unit, 1)">+</button></div></div></header>
                  <template v-if="joinedHostId(unit.instanceId)"><p class="combat-result-host-note">Combat Results Tracked by Joined Unit - {{ joinedHostName(unit.instanceId) }}</p></template>
                  <template v-else>
                    <div class="command-loss-options"><label v-if="hasCommandModel(unit, 'banner')"><input type="checkbox" :checked="persistentUnitState(unit.instanceId).bannerLost" :disabled="isReadOnly" @change="setCommandLoss(unit.instanceId, 'bannerLost', ($event.target as HTMLInputElement).checked)" /><span>Banner lost</span></label><label v-if="hasCommandModel(unit, 'champion')"><input type="checkbox" :checked="persistentUnitState(unit.instanceId).championLost" :disabled="isReadOnly" @change="setCommandLoss(unit.instanceId, 'championLost', ($event.target as HTMLInputElement).checked)" /><span>Champion lost</span></label><label v-if="hasCommandModel(unit, 'musician')"><input type="checkbox" :checked="persistentUnitState(unit.instanceId).musicianLost" :disabled="isReadOnly" @change="setCommandLoss(unit.instanceId, 'musicianLost', ($event.target as HTMLInputElement).checked)" /><span>Musician lost</span></label></div>
                    <div class="combat-disposition-actions"><button type="button" class="secondary-button" :class="{ active: combatDispositionFor(unit.instanceId) === 'won' }" :disabled="isReadOnly" @click="setCombatDisposition(unit.instanceId, 'won')">Won Combat</button><button type="button" class="secondary-button" :class="{ active: combatDispositionFor(unit.instanceId) === 'lost' }" :disabled="isReadOnly" @click="setCombatDisposition(unit.instanceId, 'lost')">Lost Combat</button><button type="button" class="secondary-button" :class="{ active: combatDispositionFor(unit.instanceId) === 'draw' }" :disabled="isReadOnly" @click="setCombatDisposition(unit.instanceId, 'draw')">Draw</button></div>
                    <section v-if="combatDispositionFor(unit.instanceId) === 'lost'" class="break-test-resolution"><label class="combat-loss-input"><span>Lost combat by</span><input type="number" min="0" max="20" :value="combatLostBy(unit.instanceId)" :disabled="isReadOnly" @change="setCombatLostBy(unit.instanceId, Number(($event.target as HTMLInputElement).value))" /></label><div class="break-leadership-summary"><span>Leadership <strong>{{ unitBreakBands(unit).leadership }}</strong></span><span>Modified Give Ground threshold <strong>{{ unitBreakBands(unit).modifiedThreshold }}</strong></span></div><div class="break-outcome-grid"><label v-for="result in breakResultOptions" :key="`${unit.instanceId}-${result.id}`" class="break-outcome-card" :class="{ selected: unitTurnState(unit.instanceId).breakResult === result.id }"><input type="checkbox" :checked="unitTurnState(unit.instanceId).breakResult === result.id" :disabled="isReadOnly" @change="setBreakResult(unit.instanceId, result.id, ($event.target as HTMLInputElement).checked)" /><span><strong>{{ result.label }}</strong><small v-if="result.id === 'give-ground'">{{ unitBreakBands(unit).giveGround }}</small><small v-else-if="result.id === 'fall-back'">{{ unitBreakBands(unit).fallBack }}</small><small v-else>{{ unitBreakBands(unit).breakAndFlee }}</small></span></label></div></section>
                    <fieldset v-else-if="combatDispositionFor(unit.instanceId) === 'won'" class="follow-up-checks"><legend>Winner follow up</legend><label v-for="result in followUpOptions" :key="`${unit.instanceId}-follow-${result.id}`"><input type="checkbox" :checked="unitTurnState(unit.instanceId).followUpResult === result.id" :disabled="isReadOnly" @change="setFollowUpResult(unit.instanceId, result.id, ($event.target as HTMLInputElement).checked)" /><span><strong>{{ result.label }}</strong><small>{{ result.detail }}</small></span></label></fieldset>
                    <p v-else-if="combatDispositionFor(unit.instanceId) === 'draw'" class="combat-result-host-note">Drawn combat: no Break Test is made because there is no losing side.</p>
                  </template>
                </article>
              </div><p v-else class="setup-inline-status">No units have been marked as having fought in Choose &amp; Fight Combat.</p>
            </article>
          </template>
        </section>

        <section v-if="isEndScoreStep" class="end-round-score-panel card-inset" aria-label="Round score calculation"><div class="setup-section-heading"><div><p class="eyebrow">END OF ROUND · STEP 2</p><h3>Round &amp; Score Calculation</h3></div></div><p>Record the current running score after resolving this round’s scoring conditions, then choose which turn begins next or mark the round complete.</p><div class="game-score-board end-round-score-board"><div class="game-score-side"><small>{{ game.playerListName }}</small><div><button type="button" :disabled="isReadOnly" @click="adjustScore('player', -1)">−</button><strong>{{ game.playerScore }}</strong><button type="button" :disabled="isReadOnly" @click="adjustScore('player', 1)">+</button></div></div><span class="game-score-divider">—</span><div class="game-score-side"><small>{{ game.opponentListName || game.opponentName }}</small><div><button type="button" :disabled="isReadOnly" @click="adjustScore('opponent', -1)">−</button><strong>{{ game.opponentScore }}</strong><button type="button" :disabled="isReadOnly" @click="adjustScore('opponent', 1)">+</button></div></div></div></section>
        <div v-if="!isReadOnly && isEndScoreStep" class="game-step-actions end-round-actions"><button type="button" class="secondary-button" @click="back">‹ Back</button><button type="button" class="secondary-button friendly-turn-action" :disabled="roundsComplete" @click="startTurnFromEnd('player')">Friendly Turn</button><button type="button" class="secondary-button enemy-turn-action" :disabled="roundsComplete" @click="startTurnFromEnd('opponent')">Enemy Turn</button><button type="button" class="primary-button" :disabled="roundsComplete" @click="endRoundFromEnd">End of Round</button></div>
        <div v-else-if="!isReadOnly" class="game-step-actions match-sticky-nav"><button type="button" class="secondary-button" :disabled="battleStarted && isOverviewStep" @click="back">‹ Back</button><button type="button" class="primary-button" :disabled="advanceButtonDisabled" @click="advance">{{ advanceButtonLabel }} ›</button></div>
      </section>

      <div v-if="!isReadOnly" class="game-finish-row match-lifecycle-actions"><template v-if="!battleStarted"><button type="button" class="secondary-button danger-button" @click="cancelMatch">Cancel Match</button><button type="button" class="secondary-button" @click="startOver">Start Over</button></template><template v-else><button type="button" class="secondary-button" @click="endMatchEarly('conceded')">Concede</button><button type="button" class="secondary-button" @click="endMatchEarly('enemy-yielded')">Enemy Yielded</button><button type="button" class="secondary-button" @click="endMatchEarly('draw')">Draw</button></template><button type="button" class="secondary-button match-save-button" @click="saveMatchToOngoing">Save to Ongoing</button><button v-if="roundsComplete" type="button" class="primary-button" @click="finishMatch('completed')">Complete Match</button></div>
      <div v-else class="game-finish-row match-readonly-actions"><span v-if="matchLocked && game.status === 'open'" class="match-lock-note">This open match is locked. Unlock it from Games to continue editing.</span><button type="button" class="secondary-button" @click="returnToGames">{{ game.status === 'complete' ? 'Return to Match History' : 'Return to Games' }}</button></div>
    </section>
    <section v-else class="empty-state card-surface"><div class="empty-icon">!</div><h2>Match not found</h2><p>This saved match is no longer available on this device.</p><RouterLink to="/games" class="primary-button">Back to Games</RouterLink></section>
  </main>
</template>