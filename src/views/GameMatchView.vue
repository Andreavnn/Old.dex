<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { compositionOptions, compositionRuleLabel } from '../data/listBuilder'
import { completeSavedGame, deleteSavedGame, gameWorkflow as baseGameWorkflow, getSavedGame, resetSavedGame, updateSavedGame, type GameChargeTestResult, type GameMagicCaster, type GameOutcome, type GameSide, type SavedGame } from '../services/games'
import { getSavedArmyList } from '../services/savedLists'
import { hydrateFriendlyMagicSetup, loadMagicChoices, loadScenarioGuidance, magicSelectionLimit, randomHappeningOptions } from '../services/gameSetup'
import { loadMatchDeploymentGuidance, loadMatchStartRoundGuidance, loadMatchTurnGuidance, type MatchDeploymentGuidance, type MatchGuidanceRule, type MatchStartRoundRule } from '../services/matchIntelligence'
import { isGameLocked } from '../services/gameLocksV034'
import type { BuilderRosterSelection } from '../domain/rosterTypes'
import { clearMatchTrackingV036, loadMatchTrackingV036, saveMatchTrackingV036, type MatchCombatDisposition, type MatchTrackingStateV036, type MatchTurnUnitStateV036 } from '../services/matchTrackingV036'
import { loadMatchUnitProfileV036, type MatchUnitProfileSnapshotV036 } from '../services/matchUnitProfilesV036'

const route = useRoute()
const router = useRouter()
const game = ref<SavedGame | null>(getSavedGame(String(route.params.gameId || '')))
const notes = ref('')
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
const matchTracking = ref<MatchTrackingStateV036>(loadMatchTrackingV036(game.value?.id || ''))
const combatProfiles = ref<Record<string, MatchUnitProfileSnapshotV036 | null>>({})
const combatProfileLoading = ref(new Set<string>())
let turnGuidanceRequest = 0

// v0.36 presents the table sequence instead of mirroring every source-book
// heading as a separate screen. Charges are declared and resolved one at a time;
// Break Tests and follow-up movement are also resolved combat-by-combat.
const gameWorkflow = baseGameWorkflow.map((workflowPhase) => {
  if (workflowPhase.id === 'movement') return {
    ...workflowPhase,
    steps: workflowPhase.steps
      .filter((workflowStep) => workflowStep.id !== 'charge-moves')
      .map((workflowStep) => workflowStep.id === 'declare-charges'
        ? { ...workflowStep, label: 'Declare & Resolve Charges', description: 'Declare a charge, roll and resolve it completely, then move to the next eligible charging unit.' }
        : workflowStep),
  }
  if (workflowPhase.id === 'combat') return {
    ...workflowPhase,
    steps: workflowPhase.steps
      .filter((workflowStep) => workflowStep.id !== 'follow-up')
      .map((workflowStep) => workflowStep.id === 'break-test'
        ? { ...workflowStep, label: 'Break Tests & Follow Up', description: 'Resolve each Break Test and its resulting Give Ground, Fall Back, Flee, follow up, pursuit, restraint or overrun before moving to the next combat.' }
        : workflowStep),
  }
  return { ...workflowPhase, steps: workflowPhase.steps.map((workflowStep) => ({ ...workflowStep })) }
})

const phase = computed(() => game.value ? gameWorkflow[Math.min(game.value.phaseIndex, gameWorkflow.length - 1)] : null)
const step = computed(() => phase.value && game.value ? phase.value.steps[Math.min(game.value.stepIndex, phase.value.steps.length - 1)] : null)
const isReadOnly = computed(() => game.value?.status === 'complete' || matchLocked.value)
const isFirstTurnStep = computed(() => phase.value?.id === 'deployment' && step.value?.id === 'first-turn')
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
const stepKey = computed(() => game.value && phase.value && step.value ? `${game.value.round}:${game.value.activeSide}:${phase.value.id}:${step.value.id}` : '')
const checklistKey = computed(() => game.value && phase.value && step.value ? `${game.value.round}:${turnViewSide.value}:${phase.value.id}:${step.value.id}` : '')
const isRequiredChargeStep = computed(() => phase.value?.id === 'movement' && step.value?.id === 'required-charges' && turnViewSide.value === 'player')
const isDeclareChargeStep = computed(() => phase.value?.id === 'movement' && step.value?.id === 'declare-charges' && turnViewSide.value === 'player')
const isCompulsoryMoveStep = computed(() => phase.value?.id === 'movement' && step.value?.id === 'compulsory-moves' && turnViewSide.value === 'player')
const isRemainingMoveStep = computed(() => phase.value?.id === 'movement' && step.value?.id === 'remaining-moves' && turnViewSide.value === 'player')
const isCombatResultStep = computed(() => phase.value?.id === 'combat' && step.value?.id === 'combat-result' && turnViewSide.value === 'player')
const isBreakFollowStep = computed(() => phase.value?.id === 'combat' && step.value?.id === 'break-test' && turnViewSide.value === 'player')

const playerListFallback = computed(() => game.value ? getSavedArmyList(game.value.playerListId) : null)
const opponentListFallback = computed(() => game.value?.opponentListId ? getSavedArmyList(game.value.opponentListId) : null)
const playerRoster = computed(() => game.value?.playerRoster?.length ? game.value.playerRoster : (playerListFallback.value?.roster || []))
const opponentRoster = computed(() => game.value?.opponentRoster?.length ? game.value.opponentRoster : (opponentListFallback.value?.roster || []))
const characterRows = computed(() => playerRoster.value.filter((row) => String(row.category || '').toLowerCase().includes('character')))
const joinableUnitRows = computed(() => playerRoster.value.filter((row) => !String(row.category || '').toLowerCase().includes('character')))
const joinedCharacters = computed(() => matchTracking.value.joinedCharacters)
const playerActualPoints = computed(() => playerRoster.value.reduce((sum, row) => sum + Number(row.totalPoints || 0), 0))
const opponentActualPoints = computed(() => opponentRoster.value.reduce((sum, row) => sum + Number(row.totalPoints || 0), 0))
const playerCompositionName = computed(() => game.value?.playerCompositionName || playerListFallback.value?.compositionName || '—')
const opponentCompositionName = computed(() => game.value?.opponentCompositionName || opponentListFallback.value?.compositionName || '—')
const playerCompositionRule = computed(() => compositionRuleLabel(game.value?.playerCompositionRule || playerListFallback.value?.rule || 'open-war'))
const opponentCompositionRule = computed(() => { const rule = game.value?.opponentCompositionRule || opponentListFallback.value?.rule || ''; return rule ? compositionRuleLabel(rule) : '—' })
const playerOptionLabels = computed(() => (game.value?.playerOptions || playerListFallback.value?.options || []).map((id) => compositionOptions.find((option) => option.value === id)?.label || id))
const opponentOptionLabels = computed(() => (game.value?.opponentOptions || opponentListFallback.value?.options || []).map((id) => compositionOptions.find((option) => option.value === id)?.label || id))

const roundLimit = computed(() => Math.max(1, Number(game.value?.roundLimit || game.value?.scenarioGuidance?.roundLimit || 6)))
const battleStarted = computed(() => Boolean(game.value?.battleStarted))
const roundsComplete = computed(() => Boolean(game.value && game.value.roundsCompleted >= roundLimit.value))
const battleMarchEnabled = computed(() => String(game.value?.playerCompositionRule || playerListFallback.value?.rule || '').toLowerCase() === 'battle-march' || playerCompositionRule.value.toLowerCase().includes('battle march'))
const selectedBattlefieldConditions = computed(() => new Set(game.value?.battlefieldConditions || []))
const battlefieldConditionRows = computed(() => randomHappeningOptions.filter((option) => selectedBattlefieldConditions.value.has(option.id)))
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
const compulsoryMovementUnits = computed(() => {
  if (!isCompulsoryMoveStep.value) return [] as BuilderRosterSelection[]
  const ids = new Set(friendlyActionGuidance.value.flatMap((rule) => rule.unitRefs || []).map((unit) => unit.instanceId))
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
const combatTopLevelUnits = computed(() => playerRoster.value.filter((row) => !isJoinedCharacterId(row.instanceId)))
const foughtUnits = computed(() => playerRoster.value.filter((row) => !isJoinedCharacterId(row.instanceId) && foughtInCombat(row.instanceId)))
const breakFollowUnits = computed(() => foughtUnits.value.filter((row) => Boolean(unitTurnState(row.instanceId).combatDisposition)))
const turnContextLabel = computed(() => turnViewSide.value === 'opponent' ? "Enemy's Turn" : 'Your Turn')
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
    'combat-result': 'After both sides have fought, total Combat Result bonuses and determine the winner before any Break Tests are taken.',
    'break-test': 'Resolve one combat at a time: take the required Break Test, record the resulting movement, then immediately resolve follow up, pursuit, restraint or overrun before moving to the next combat.',
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
  fight: '/the-combat-phase/choose-and-fight-combat', 'combat-result': '/the-combat-phase/calculate-combat-result', 'break-test': '/the-combat-phase/break-test', 'follow-up': '/the-combat-phase/follow-up-and-pursuit',
}
const battleStepRulePath = computed(() => battleStepRulePaths[step.value?.id || ''] || '/the-turn-sequence')
const standardFirstTurnText = 'If the scenario gives no different procedure, roll off after deployment. In matched play, the player who finished deploying first (including units deployed using Scouts) adds +1 to the roll; the winner chooses who takes the first turn.'
const firstTurnProcedureText = computed(() => scenarioGuidance.value?.firstTurnText || standardFirstTurnText)

watch(stepKey, () => { notes.value = game.value?.stepNotes?.[stepKey.value] || '' }, { immediate: true })
watch(() => game.value?.activeSide, (side) => { if (side) turnViewSide.value = side }, { immediate: true })
watch(() => step.value?.id, () => { if (isSetupSpellsStep.value) void preloadMagicChoices() })
watch(() => [phase.value?.id, step.value?.id, turnViewSide.value], () => {
  if (isDeployArmiesStep.value) void hydrateDeploymentGuidance()
  if (isRoundStartStep.value) void hydrateStartRoundGuidance()
  if (isBattleTurnPhase.value) void hydrateTurnGuidance()
  else { turnGuidanceRequest += 1; turnGuidance.value = []; turnGuidanceLoading.value = false }
}, { immediate: true })

function persist(patch: Partial<Omit<SavedGame, 'id' | 'createdAt'>> = {}) { if (!game.value) return; const updated = updateSavedGame(game.value.id, patch); if (updated) game.value = updated }

function saveTracking(next: MatchTrackingStateV036) {
  if (!game.value) return
  matchTracking.value = next
  saveMatchTrackingV036(game.value.id, next)
}
function mutateTracking(change: (next: MatchTrackingStateV036) => void) {
  const next: MatchTrackingStateV036 = JSON.parse(JSON.stringify(matchTracking.value)) as MatchTrackingStateV036
  change(next)
  saveTracking(next)
}
function trackingTurnKey() { return game.value ? `${game.value.round}:${turnViewSide.value}` : '' }
function unitTurnState(instanceId: string): MatchTurnUnitStateV036 {
  const key = trackingTurnKey()
  return key ? matchTracking.value.turns[key]?.[instanceId] || {} : {}
}
function patchUnitTurnState(instanceId: string, patch: Partial<MatchTurnUnitStateV036>) {
  if (!game.value || isReadOnly.value) return
  const key = trackingTurnKey()
  if (!key) return
  mutateTracking((next) => {
    const group = { ...(next.turns[key] || {}) }
    group[instanceId] = { ...(group[instanceId] || {}), ...patch }
    next.turns[key] = group
  })
}
function isCharacter(row: BuilderRosterSelection) { return String(row.category || '').toLowerCase().includes('character') }
function joinedHostId(characterId: string) { return joinedCharacters.value[characterId] || '' }
function isJoinedCharacterId(instanceId: string) { return Boolean(joinedCharacters.value[instanceId]) }
function joinedCharactersForHost(hostId: string) { return characterRows.value.filter((row) => joinedHostId(row.instanceId) === hostId) }
function joinedCharacterChargeRules(hostId: string) {
  const ids = new Set(joinedCharactersForHost(hostId).map((row) => row.instanceId))
  const seen = new Set<string>()
  return allDeclareChargeGuidance.value
    .filter((rule) => ids.has(rule.unitRefs?.[0]?.instanceId || ''))
    .flatMap((rule) => rule.relatedRules || [])
    .filter((rule) => { const key = `${rule.label}|${rule.path || ''}|${rule.summary}`.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true })
}
function setCharacterHost(characterId: string, hostId: string) {
  if (!game.value || isReadOnly.value) return
  mutateTracking((next) => { if (hostId) next.joinedCharacters[characterId] = hostId; else delete next.joinedCharacters[characterId] })
}
function handleCharacterHost(characterId: string, event: Event) { setCharacterHost(characterId, (event.target as HTMLSelectElement).value) }
function leaveCharacter(characterId: string) { setCharacterHost(characterId, '') }
function chargeDeclared(instanceId: string) { return Boolean(unitTurnState(instanceId).chargeDeclared) }
function chargeResolved(instanceId: string) { return Boolean(unitTurnState(instanceId).chargeResolved) }
function setChargeDeclared(instanceId: string, checked: boolean) { patchUnitTurnState(instanceId, { chargeDeclared: checked, chargeResolved: checked ? unitTurnState(instanceId).chargeResolved : false }) }
function setChargeResolved(instanceId: string, checked: boolean) { patchUnitTurnState(instanceId, { chargeDeclared: checked || unitTurnState(instanceId).chargeDeclared, chargeResolved: checked }) }
function compulsoryMoved(instanceId: string) { return Boolean(unitTurnState(instanceId).compulsoryMoved) }
function setCompulsoryMoved(instanceId: string, checked: boolean) { patchUnitTurnState(instanceId, { compulsoryMoved: checked }) }
function remainingMoved(instanceId: string) { return Boolean(unitTurnState(instanceId).remainingMoved) }
function setRemainingMoved(instanceId: string, checked: boolean) { patchUnitTurnState(instanceId, { remainingMoved: checked }) }
function setDestroyedModels(instanceId: string, event: Event) { patchUnitTurnState(instanceId, { destroyedModels: Math.max(0, Math.floor(Number((event.target as HTMLInputElement).value) || 0)) }) }
function setCommandLoss(instanceId: string, field: 'bannerLost' | 'championLost' | 'musicianLost', checked: boolean) { patchUnitTurnState(instanceId, { [field]: checked } as Partial<MatchTurnUnitStateV036>) }
function setCombatDisposition(instanceId: string, disposition: MatchCombatDisposition) {
  const current = unitTurnState(instanceId).combatDisposition || ''
  patchUnitTurnState(instanceId, { combatDisposition: current === disposition ? '' : disposition, breakResult: '', followUpResult: '' })
}
function setBreakResult(instanceId: string, event: Event) { patchUnitTurnState(instanceId, { breakResult: (event.target as HTMLSelectElement).value }) }
function setFollowUpResult(instanceId: string, event: Event) { patchUnitTurnState(instanceId, { followUpResult: (event.target as HTMLSelectElement).value }) }
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
const breakResultOptions = ['Give Ground', 'Fall Back in Good Order', 'Flee', 'Destroyed', 'No further movement']
const followUpOptions = ['Follow Up', 'Pursue', 'Restrain', 'Overrun', 'No follow up']

async function ensureCombatProfile(row: BuilderRosterSelection) {
  if (!game.value || Object.prototype.hasOwnProperty.call(combatProfiles.value, row.instanceId) || combatProfileLoading.value.has(row.instanceId)) return
  const loading = new Set(combatProfileLoading.value); loading.add(row.instanceId); combatProfileLoading.value = loading
  try {
    const profile = await loadMatchUnitProfileV036(game.value, row)
    combatProfiles.value = { ...combatProfiles.value, [row.instanceId]: profile }
  } finally {
    const next = new Set(combatProfileLoading.value); next.delete(row.instanceId); combatProfileLoading.value = next
  }
}
function handleCombatProfileToggle(row: BuilderRosterSelection, event: Event) {
  if ((event.currentTarget as HTMLDetailsElement).open) {
    void ensureCombatProfile(row)
    for (const character of joinedCharactersForHost(row.instanceId)) void ensureCombatProfile(character)
  }
}
function profileColumns(profile: MatchUnitProfileSnapshotV036 | null | undefined) {
  if (!profile) return [] as string[]
  const preferred = ['M','WS','BS','S','T','W','I','A','Ld','Armour Save','Ward Save','Regeneration']
  const present = new Set(profile.rows.flatMap((row) => Object.keys(row.profile)))
  return [...preferred.filter((key) => present.has(key)), ...[...present].filter((key) => !preferred.includes(key))]
}
function combatProfile(instanceId: string) { return combatProfiles.value[instanceId] }
function scrollTabs(target: 'phase' | 'step', direction: -1 | 1) {
  const element = target === 'phase' ? phaseTabsRef.value : stepTabsRef.value
  if (!element) return
  element.scrollBy({ left: direction * Math.max(240, Math.round(element.clientWidth * .72)), behavior: 'smooth' })
}
function migrateWorkflowV036() {
  if (!game.value || matchTracking.value.workflowMigrated) return
  const sourcePhase = baseGameWorkflow[game.value.phaseIndex]
  let stepIndex = game.value.stepIndex
  if (sourcePhase?.id === 'movement' && stepIndex >= 2) stepIndex = Math.max(1, stepIndex - 1)
  if (sourcePhase?.id === 'combat' && stepIndex >= 3) stepIndex = 2
  if (stepIndex !== game.value.stepIndex) persist({ stepIndex })
  mutateTracking((next) => { next.workflowMigrated = true })
}
function saveNotes() { if (!game.value || isReadOnly.value || !stepKey.value) return; persist({ stepNotes: { ...game.value.stepNotes, [stepKey.value]: notes.value } }) }
function setPhase(index: number) { if (!game.value || isReadOnly.value) return; saveNotes(); persist({ phaseIndex: index, stepIndex: 0 }) }
function setStep(index: number) { if (!game.value || isReadOnly.value) return; saveNotes(); persist({ stepIndex: index }) }
function advance() {
  if (!game.value || !phase.value || isReadOnly.value) return
  saveNotes()
  if (game.value.stepIndex < phase.value.steps.length - 1) { persist({ stepIndex: game.value.stepIndex + 1 }); return }
  if (phase.value.id === 'overview' && battleStarted.value) { persist({ phaseIndex: strategyPhaseIndex.value, stepIndex: 0 }); return }
  if (phase.value.id === 'deployment') { const firstSide = game.value.firstPlayerConfirmed ? game.value.firstPlayer : game.value.activeSide; turnViewSide.value = firstSide; persist({ phaseIndex: roundStartPhaseIndex.value, stepIndex: 0, activeSide: firstSide, battleStarted: true, round: 1 }); return }
  if (phase.value.id === 'round-start') { const firstSide = game.value.firstPlayerConfirmed ? game.value.firstPlayer : game.value.activeSide; turnViewSide.value = firstSide; persist({ phaseIndex: strategyPhaseIndex.value, stepIndex: 0, activeSide: firstSide, battleStarted: true }); return }
  if (game.value.phaseIndex < gameWorkflow.length - 1) { persist({ phaseIndex: game.value.phaseIndex + 1, stepIndex: 0 }); return }
}
function back() {
  if (!game.value || !phase.value || isReadOnly.value) return
  saveNotes()
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
function toggleGuidanceCheck(rule: MatchGuidanceRule, index: number, checked: boolean) { if (!game.value || isReadOnly.value || !checklistKey.value) return; const group = { ...(game.value.stepChecks?.[checklistKey.value] || {}) }; const id = guidanceCheckId(rule, index); if (checked) group[id] = true; else delete group[id]; persist({ stepChecks: { ...(game.value.stepChecks || {}), [checklistKey.value]: group } }) }
function chargeTestKey(instanceId: string) { return game.value ? `${game.value.round}:${turnViewSide.value}:required-charges:${instanceId}` : '' }
function chargeTestResult(instanceId: string): GameChargeTestResult | '' { if (!game.value) return ''; return game.value.chargeTests?.[chargeTestKey(instanceId)] || '' }
function setChargeTestResult(instanceId: string, result: GameChargeTestResult, checked: boolean) { if (!game.value || isReadOnly.value) return; const next = { ...(game.value.chargeTests || {}) }; const key = chargeTestKey(instanceId); if (!checked || next[key] === result) delete next[key]; else next[key] = result; persist({ chargeTests: next }); if (step.value?.id === 'declare-charges') void hydrateTurnGuidance() }
function combatCheckId(instanceId: string) { return `combat-unit:${instanceId}` }
function combatUnitChecked(instanceId: string) { return Boolean(game.value && checklistKey.value && game.value.stepChecks?.[checklistKey.value]?.[combatCheckId(instanceId)]) }
function toggleCombatUnit(instanceId: string, checked: boolean) { if (!game.value || isReadOnly.value || !checklistKey.value) return; const group = { ...(game.value.stepChecks?.[checklistKey.value] || {}) }; const id = combatCheckId(instanceId); if (checked) group[id] = true; else delete group[id]; persist({ stepChecks: { ...(game.value.stepChecks || {}), [checklistKey.value]: group } }) }

function startTurnFromEnd(side: GameSide) { if (!game.value || isReadOnly.value || roundsComplete.value) return; saveNotes(); turnViewSide.value = side; persist({ activeSide: side, phaseIndex: strategyPhaseIndex.value, stepIndex: 0, battleStarted: true }) }
function endRoundFromEnd() { if (!game.value || isReadOnly.value || roundsComplete.value) return; saveNotes(); const completed = Math.min(roundLimit.value, game.value.roundsCompleted + 1); if (completed >= roundLimit.value) { persist({ roundsCompleted: completed, battleStarted: true }); return }; const firstSide = game.value.firstPlayerConfirmed ? game.value.firstPlayer : 'player'; turnViewSide.value = firstSide; persist({ roundsCompleted: completed, round: game.value.round + 1, activeSide: firstSide, phaseIndex: roundStartPhaseIndex.value, stepIndex: 0, battleStarted: true }) }
function chooseFirstPlayer(side: GameSide) { if (!game.value || isReadOnly.value) return; turnViewSide.value = side; persist({ firstPlayer: side, firstPlayerConfirmed: true, activeSide: side }) }
function chooseDeploymentFirstSide(side: GameSide) { if (!game.value || isReadOnly.value) return; persist({ deploymentFirstSide: side }) }
function toggleDeployedUnit(side: GameSide, instanceId: string, checked: boolean) { if (!game.value || isReadOnly.value) return; const key = side === 'player' ? 'deployedPlayerIds' : 'deployedOpponentIds'; const current = new Set(side === 'player' ? game.value.deployedPlayerIds || [] : game.value.deployedOpponentIds || []); if (checked) current.add(instanceId); else current.delete(instanceId); if (side === 'player' && checked) { const reserves = new Set(game.value.reservePlayerIds || []); reserves.delete(instanceId); persist({ [key]: [...current], reservePlayerIds: [...reserves] } as Partial<SavedGame>); return }; persist({ [key]: [...current] } as Partial<SavedGame>) }
function handleDeployedUnit(side: GameSide, instanceId: string, event: Event) { toggleDeployedUnit(side, instanceId, Boolean((event.target as HTMLInputElement).checked)) }
function toggleReserveUnit(instanceId: string, checked: boolean) { if (!game.value || isReadOnly.value) return; const current = new Set(game.value.reservePlayerIds || []); if (checked) current.add(instanceId); else current.delete(instanceId); const deployed = new Set(game.value.deployedPlayerIds || []); if (checked) deployed.delete(instanceId); persist({ reservePlayerIds: [...current], deployedPlayerIds: [...deployed] }) }
function handleReserveUnit(instanceId: string, event: Event) { toggleReserveUnit(instanceId, Boolean((event.target as HTMLInputElement).checked)) }
function setRoundLimit(value: number) { if (!game.value || isReadOnly.value || battleStarted.value) return; persist({ roundLimit: Math.max(1, Math.min(20, Math.round(Number(value) || 1))), roundLimitCustomized: true }) }
function handleRoundLimit(event: Event) { setRoundLimit(Number((event.target as HTMLInputElement).value)) }
function adjustScore(side: GameSide, delta: number) { if (!game.value || isReadOnly.value) return; if (side === 'player') persist({ playerScore: Math.max(0, game.value.playerScore + delta) }); else persist({ opponentScore: Math.max(0, game.value.opponentScore + delta) }) }
function saveMatchToOngoing() { if (!game.value || isReadOnly.value) return; saveNotes(); persist({ status: 'open' }) }
function finishMatch(outcome: GameOutcome = 'completed') { if (!game.value || isReadOnly.value || (outcome === 'completed' && !roundsComplete.value)) return; saveNotes(); const updated = completeSavedGame(game.value.id, outcome); if (updated) game.value = updated }
function cancelMatch() { if (!game.value || isReadOnly.value || typeof window === 'undefined') return; if (!window.confirm('Cancel this match? The saved match and its recorded setup will be removed from this device.')) return; const id = game.value.id; clearMatchTrackingV036(id); deleteSavedGame(id); void router.push('/games') }
async function startOver() { if (!game.value || isReadOnly.value || typeof window === 'undefined') return; if (!window.confirm('Start this match over? Scores, round progress, notes, first-turn result and match-specific magic selections will be reset.')) return; const id = game.value.id; clearMatchTrackingV036(id); matchTracking.value = loadMatchTrackingV036(id); const updated = resetSavedGame(id); if (!updated) return; game.value = updated; magicCasters.value = []; await hydrateMagicSetup() }
function endMatchEarly(outcome: Exclude<GameOutcome, 'completed'>) { if (!game.value || isReadOnly.value || !battleStarted.value || typeof window === 'undefined') return; const label = outcome === 'conceded' ? 'record a concession' : outcome === 'enemy-yielded' ? 'record that the enemy yielded' : 'record this match as a draw'; if (!window.confirm(`End the match and ${label}?`)) return; finishMatch(outcome) }
function returnToGames() { void router.push('/games') }

function cloneMagicSetup() { return magicCasters.value.map((caster) => ({ ...caster, availableLores: [...caster.availableLores], selectedSpellIds: [...caster.selectedSpellIds], choices: caster.choices?.map((choice) => ({ ...choice })) })) }
function persistMagicSetup() { if (game.value && !isReadOnly.value) persist({ magicSetup: cloneMagicSetup() }) }
async function hydrateMagicSetup() { if (!game.value) return; magicLoading.value = true; try { magicCasters.value = await hydrateFriendlyMagicSetup(game.value); persistMagicSetup(); if (isSetupSpellsStep.value) await preloadMagicChoices() } finally { magicLoading.value = false } }
async function ensureMagicChoices(caster: GameMagicCaster) { if (!caster.selectedLore || caster.choices?.length) return; const loading = new Set(magicChoiceLoading.value); loading.add(caster.instanceId); magicChoiceLoading.value = loading; try { caster.choices = await loadMagicChoices(caster); const ids = new Set(caster.choices.map((choice) => choice.id)); caster.selectedSpellIds = caster.selectedSpellIds.filter((id) => ids.has(id)); persistMagicSetup() } finally { const next = new Set(magicChoiceLoading.value); next.delete(caster.instanceId); magicChoiceLoading.value = next } }
async function preloadMagicChoices() { await Promise.allSettled(magicCasters.value.map((caster) => ensureMagicChoices(caster))) }
async function changeCasterLore(caster: GameMagicCaster, lore: string) { if (isReadOnly.value || lore === caster.selectedLore) return; caster.selectedLore = lore; caster.selectedSpellIds = []; caster.choices = undefined; persistMagicSetup(); await ensureMagicChoices(caster) }
function handleLoreChange(caster: GameMagicCaster, event: Event) { void changeCasterLore(caster, (event.target as HTMLSelectElement).value) }
function selectedMagicChoice(caster: GameMagicCaster, id: string) { return caster.selectedSpellIds.includes(id) }
function toggleMagicChoice(caster: GameMagicCaster, id: string, selected: boolean) { if (isReadOnly.value || caster.kind !== 'Wizard') return; const next = new Set(caster.selectedSpellIds); if (selected) { if (!next.has(id) && next.size >= magicSelectionLimit(caster)) return; next.add(id) } else next.delete(id); caster.selectedSpellIds = [...next]; persistMagicSetup() }
function handleMagicChoice(caster: GameMagicCaster, id: string, event: Event) { toggleMagicChoice(caster, id, Boolean((event.target as HTMLInputElement).checked)) }
function casterChoiceDisabled(caster: GameMagicCaster, id: string) { return !selectedMagicChoice(caster, id) && caster.selectedSpellIds.length >= magicSelectionLimit(caster) }
function selectedChoiceNames(caster: GameMagicCaster) { const selected = new Set(caster.selectedSpellIds); return (caster.choices || []).filter((choice) => selected.has(choice.id)).map((choice) => choice.name) }

async function hydrateScenarioGuidance() { if (!game.value || game.value.scenarioGuidance) return; scenarioLoading.value = true; try { const guidance = await loadScenarioGuidance(game.value.scenario); persist({ scenarioGuidance: guidance, roundLimit: game.value.roundLimitCustomized ? game.value.roundLimit : guidance.roundLimit }) } finally { scenarioLoading.value = false; if (isBattleTurnPhase.value) void hydrateTurnGuidance() } }
async function hydrateDeploymentGuidance() { if (!game.value || deploymentLoading.value) return; deploymentLoading.value = true; try { deploymentGuidance.value = await loadMatchDeploymentGuidance(game.value) } finally { deploymentLoading.value = false } }
async function hydrateStartRoundGuidance() { if (!game.value || startRoundLoading.value) return; startRoundLoading.value = true; try { startRoundGuidance.value = await loadMatchStartRoundGuidance(game.value) } finally { startRoundLoading.value = false } }
function deploymentFor(instanceId: string) { return deploymentGuidanceMap.value.get(instanceId) }
function toggleBattlefieldCondition(id: string, checked: boolean) { if (!game.value || isReadOnly.value) return; const next = new Set(game.value.battlefieldConditions || []); if (checked) next.add(id); else next.delete(id); persist({ battlefieldConditions: [...next] }); if (isBattleTurnPhase.value) void hydrateTurnGuidance() }
function handleBattlefieldCondition(id: string, event: Event) { toggleBattlefieldCondition(id, Boolean((event.target as HTMLInputElement).checked)) }

const setupTip = computed(() => { if (isSetupArmiesStep.value) return 'Confirm the roster, scenario and battle-composition details before deployment. Wizard lore choices are made when the model permits a choice; changing a lore here changes this match setup only and does not rewrite the saved roster.'; if (isSetupSpellsStep.value) return 'Generate spells before deployment. For a Wizard, roll one D6 per Wizard Level and re-roll duplicates; each result selects the matching numbered spell. One generated spell may be exchanged for the signature spell. A single Wizard cannot know the same spell twice.'; if (isOverviewStep.value) return 'Use Overview as the at-a-glance battle dashboard. Check the matchup, scenario, prepared magic and current turn state here before moving into Deployment and the turn phases.'; return '' })
const deploymentTip = computed(() => { if (isDeploymentOrderStep.value) return 'Review the scenario deployment instructions before placing models. Record which side begins deployment here; this is separate from determining which side takes the first turn.'; if (isDeployArmiesStep.value) return 'Follow the selected scenario’s deployment instructions and alternate placing eligible units as required. For each friendly unit, choose one of its legal formations when it is deployed and resolve any deployment rules shown here. Units with rules or scenario instructions that allow them to begin off-table may be marked Held in Reserve instead of Deployed. Resolve post-deployment rules such as Scouts or Vanguard exactly when their linked rule instructs.'; if (isFirstTurnStep.value) return firstTurnProcedureText.value; if (isRoundBattleEffectsStep.value) return 'Start of Round begins with effects that apply to the battle as a whole. Resolve scenario, battlefield and battle-composition effects before either player resolves army or model-specific Start of Round rules.'; if (isRoundPlayerEffectsStep.value) return 'After shared battle effects, resolve the friendly and enemy army, unit and model rules that trigger at Start of Round. Keep each side separate so no model-specific effect is missed.'; return '' })
const advanceButtonLabel = computed(() => { if (roundsComplete.value && phase.value?.id === 'end') return 'Round limit reached'; if (isOverviewStep.value) return 'Prepare For Battle! (Next)'; if (phase.value?.id === 'deployment' && game.value?.stepIndex === phase.value.steps.length - 1) return 'To War! - (Start Battle)'; if (isRoundBattleEffectsStep.value) return 'Player Effects (Next)'; if (isRoundPlayerEffectsStep.value) return 'Begin Round'; return step.value && phase.value && game.value?.stepIndex === phase.value.steps.length - 1 ? `Next: ${gameWorkflow[game.value.phaseIndex + 1]?.label || 'Next'}` : `Next: ${phase.value?.steps[(game.value?.stepIndex || 0) + 1]?.label || 'Next'}` })
const advanceButtonDisabled = computed(() => Boolean((roundsComplete.value && phase.value?.id === 'end') || (phase.value?.id === 'deployment' && game.value?.stepIndex === phase.value.steps.length - 1 && !game.value?.firstPlayerConfirmed)))

onMounted(() => { matchLocked.value = Boolean(game.value && isGameLocked(game.value.id)); migrateWorkflowV036(); void Promise.allSettled([hydrateMagicSetup(), hydrateScenarioGuidance()]) })
</script>

<template>
  <main class="page game-match-page">
    <AppHeader compact back-to="/games" prefer-back-to />
    <section v-if="game" class="game-match-shell">
      <header class="game-match-hero card-surface"><div><p class="eyebrow">{{ game.status === 'complete' ? 'MATCH HISTORY' : matchLocked ? 'MATCH LOCKED' : !game.firstPlayerConfirmed ? 'TURN ORDER PENDING' : `ROUND ${game.round} · ${game.activeSide === 'player' ? 'YOUR TURN' : 'OPPONENT TURN'}` }}</p><h1>{{ game.name }}</h1><p>{{ game.scenario }} · {{ game.points }} pts</p></div><span v-if="matchLocked" class="match-locked-pill">LOCKED</span></header>

      <div class="match-tab-scroll-shell phase-scroll-shell"><button type="button" class="match-tab-scroll-arrow left" aria-label="Scroll battle phases left" @click="scrollTabs('phase', -1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7" /></svg></button><nav ref="phaseTabsRef" class="game-phase-tabs" aria-label="Battle phases"><button v-for="(item, index) in gameWorkflow" :key="item.id" type="button" :class="{ active: game.phaseIndex === index }" :disabled="isReadOnly" @click="setPhase(index)">{{ item.label }}</button></nav><button type="button" class="match-tab-scroll-arrow right" aria-label="Scroll battle phases right" @click="scrollTabs('phase', 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 5 7 7-7 7" /></svg></button></div>
      <div v-if="phase" class="match-tab-scroll-shell step-scroll-shell"><button type="button" class="match-tab-scroll-arrow left" aria-label="Scroll phase steps left" @click="scrollTabs('step', -1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7" /></svg></button><div ref="stepTabsRef" class="game-step-list game-subphase-tabs" aria-label="Current phase subphases"><button v-for="(item, index) in phase.steps" :key="item.id" type="button" :class="{ active: game.stepIndex === index }" :disabled="isReadOnly" @click="setStep(index)"><span>{{ index + 1 }}</span>{{ item.label }}</button></div><button type="button" class="match-tab-scroll-arrow right" aria-label="Scroll phase steps right" @click="scrollTabs('step', 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 5 7 7-7 7" /></svg></button></div>

      <section v-if="phase && step" class="game-step-card card-surface">
        <div class="game-step-heading"><div><p class="eyebrow">{{ phaseStepLabel }}</p><h2>{{ step.label }}</h2><p>{{ step.description }}</p></div><div class="game-step-heading-tools"><div v-if="isBattleTurnPhase" class="turn-context-actions compact-turn-context" role="group" aria-label="Turn view"><button type="button" class="turn-context-button friendly" :class="{ active: turnViewSide === 'player' }" :disabled="isReadOnly" @click="selectTurnContext('player')">Your Turn</button><button type="button" class="turn-context-button enemy" :class="{ active: turnViewSide === 'opponent' }" :disabled="isReadOnly" @click="selectTurnContext('opponent')">Enemy's Turn</button></div></div></div>

        <div v-if="isSetupArmiesStep" class="game-setup-content">
          <section class="match-setup-summary-grid"><article class="match-roster-summary friendly"><p class="eyebrow">FRIENDLY GENERAL</p><h3>{{ game.playerName }}</h3><strong>{{ game.playerListName }}</strong><p>{{ game.playerArmyName }}</p><dl><div><dt>Points</dt><dd>{{ playerActualPoints || game.points }} / {{ game.points }}</dd></div><div><dt>Composition</dt><dd>{{ playerCompositionName }}</dd></div><div><dt>Battle composition</dt><dd>{{ playerCompositionRule }}</dd></div></dl><div v-if="playerOptionLabels.length" class="match-option-chips"><span v-for="label in playerOptionLabels" :key="label">{{ label }}</span></div></article><article class="match-roster-summary enemy"><p class="eyebrow">ENEMY GENERAL</p><h3>{{ game.opponentName }}</h3><strong>{{ game.opponentListName || 'No enemy roster selected' }}</strong><p>{{ game.opponentArmyName || 'Opponent details only' }}</p><dl><div><dt>Points</dt><dd>{{ opponentActualPoints || game.points }} / {{ game.points }}</dd></div><div><dt>Composition</dt><dd>{{ opponentCompositionName }}</dd></div><div><dt>Battle composition</dt><dd>{{ opponentCompositionRule }}</dd></div></dl></article></section>
          <section class="setup-round-limit-card card-inset"><div><p class="eyebrow">GAME LENGTH</p><h3>Number of rounds</h3><p>Set how many rounds this match will last. This value carries into Overview and controls when Complete Match becomes available.</p></div><label class="round-limit-input"><span>Rounds</span><input :value="roundLimit" type="number" min="1" max="20" :readonly="isReadOnly || battleStarted" @change="handleRoundLimit" /></label></section>
          <section class="setup-scenario-card"><span class="value-chip">SCENARIO</span><div><h3>{{ game.scenario }}</h3><p v-if="scenarioLoading">Loading scenario guidance…</p><p v-if="!scenarioLoading && scenarioGuidance?.setupText">{{ scenarioGuidance.setupText }}</p><details v-if="scenarioGuidance?.sourcePath" class="phase-rule-details scenario-inline-details"><summary>Scenario rules</summary><div><p v-if="scenarioGuidance?.deploymentText"><strong>Deployment:</strong> {{ scenarioGuidance.deploymentText }}</p><p><strong>First Turn:</strong> {{ firstTurnProcedureText }}</p><p v-for="rule in scenarioGuidance?.scenarioRules || []" :key="rule">{{ rule }}</p><p v-if="scenarioGuidance?.gameLength"><strong>Game Length:</strong> {{ scenarioGuidance.gameLength }}</p><img v-if="scenarioGuidance?.mapImageUrl" class="scenario-deployment-map setup-scenario-map scenario-rules-bottom-image" :src="scenarioGuidance.mapImageUrl" :alt="`${game.scenario} battle map`" loading="lazy" decoding="async" /></div></details></div></section>
          <section v-if="battleMarchEnabled" class="setup-caster-section battlefield-condition-picker"><div class="setup-section-heading"><div><p class="eyebrow">BATTLEFIELD</p><h3>Random Happenings</h3></div></div><p class="setup-inline-status">Mark the Battle March random-happening tables being used for this battle. They will remain visible on Overview.</p><div class="battlefield-condition-options"><label v-for="option in randomHappeningOptions" :key="option.id"><input type="checkbox" :checked="selectedBattlefieldConditions.has(option.id)" :disabled="isReadOnly" @change="handleBattlefieldCondition(option.id, $event)" /><span><strong>{{ option.label }}</strong><RouterLink :to="`/rules/read${option.path}`">Rules</RouterLink></span></label></div></section>
          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip</strong><p>{{ setupTip }}</p></div></aside>
        </div>

        <div v-else-if="isSetupSpellsStep" class="game-setup-content spell-setup-content">
          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — Spell Generation</strong><p>{{ setupTip }}</p><RouterLink to="/rules/read/the-lores-of-magic/spells-and-spell-generation">Open Spells & Spell Generation rules</RouterLink></div></aside>
          <p v-if="magicLoading" class="setup-inline-status">Loading friendly casters…</p><p v-else-if="!magicCasters.length" class="setup-inline-status">The friendly roster contains no detected Wizards or Priests, so there are no pre-deployment magic selections to record.</p>
          <template v-else><details v-for="caster in magicCasters" :key="caster.instanceId" class="spell-caster-panel caster-collapse-panel"><summary class="spell-caster-heading"><div><span class="rule-kind-pill">{{ caster.kind }}<template v-if="caster.kind === 'Wizard'"> · Level {{ caster.level }}</template></span><h3>{{ caster.name }}</h3><p>{{ caster.selectedLore || 'No lore selected' }}</p></div><strong v-if="caster.kind === 'Wizard'">{{ caster.selectedSpellIds.length }} / {{ magicSelectionLimit(caster) }} spells</strong></summary><div class="spell-caster-collapse-body"><p v-if="magicChoiceLoading.has(caster.instanceId)" class="setup-inline-status">Loading {{ caster.kind === 'Wizard' ? 'spells' : 'prayers' }} from the rules source…</p><div v-else-if="caster.kind === 'Wizard' && caster.choices?.length" class="spell-choice-grid spell-rule-choice-grid"><article v-for="choice in caster.choices" :key="choice.id" class="spell-rule-choice" :class="{ selected: selectedMagicChoice(caster, choice.id), signature: choice.signature, unavailable: casterChoiceDisabled(caster, choice.id) }"><label class="spell-rule-select"><input class="spell-rule-checkbox" type="checkbox" :checked="selectedMagicChoice(caster, choice.id)" :disabled="isReadOnly || casterChoiceDisabled(caster, choice.id)" @change="handleMagicChoice(caster, choice.id, $event)" /><span class="spell-rule-checkmark" aria-hidden="true">{{ selectedMagicChoice(caster, choice.id) ? '✓' : '' }}</span><span>{{ selectedMagicChoice(caster, choice.id) ? 'Selected' : 'Select' }}</span></label><details class="spell-rule-card spell-rule-dropdown"><summary><span class="rule-kind-pill">{{ choice.type || 'Spell' }}</span><strong>{{ choice.name }}</strong><small v-if="choice.signature">Signature Spell</small><span class="spell-dropdown-cue">Details</span></summary><div class="spell-rule-card-body"><dl v-if="choice.type || choice.castingValue || choice.range" class="spell-rule-meta"><div v-if="choice.type"><dt>Type</dt><dd>{{ choice.type }}</dd></div><div v-if="choice.castingValue"><dt>Casting Value</dt><dd>{{ choice.castingValue }}</dd></div><div v-if="choice.range"><dt>Range</dt><dd>{{ choice.range }}</dd></div></dl><p v-if="choice.summary">{{ choice.summary }}</p><footer><RouterLink v-if="choice.path" :to="`/rules/read${choice.path}`">Open lore rules</RouterLink></footer></div></details></article></div><div v-else-if="caster.kind === 'Priest' && caster.choices?.length" class="prayer-choice-list"><p class="prayer-availability-note">These prayers are available to this Priest during the appropriate phase; no pre-game prayer selection is required.</p><article v-for="choice in caster.choices" :key="choice.id"><strong>{{ choice.name }}</strong><p>{{ choice.summary }}</p></article></div><div v-else class="setup-inline-status">No {{ caster.kind === 'Wizard' ? 'spell' : 'prayer' }} list could be read for {{ caster.selectedLore || caster.name }}.</div></div></details></template>
        </div>

        <div v-else-if="isOverviewStep" class="game-overview-dashboard">
          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — Battle Overview</strong><p>{{ setupTip }}</p></div></aside>
          <section class="overview-status-grid prebattle-overview-status-grid"><article><small>Scenario</small><strong>{{ game.scenario }}</strong></article><article><small>Battle size</small><strong>{{ game.points }} pts</strong></article><article><small>First turn</small><strong>{{ game.firstPlayerConfirmed ? (game.firstPlayer === 'player' ? game.playerName : game.opponentName) : 'Resolve after deployment' }}</strong></article></section>
          <section class="overview-matchup card-inset"><div><p class="eyebrow">FRIENDLY</p><h3>{{ game.playerName }}</h3><strong>{{ game.playerListName }}</strong><p>{{ game.playerArmyName }} · {{ game.playerPoints || playerActualPoints || game.points }} pts</p></div><span>—</span><div><p class="eyebrow">ENEMY</p><h3>{{ game.opponentName }}</h3><strong>{{ game.opponentListName || 'No enemy roster' }}</strong><p>{{ game.opponentArmyName || 'Opponent' }} · {{ game.opponentPoints || opponentActualPoints || 0 }} pts</p></div></section>
          <section class="overview-battlefield-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">BATTLEFIELD &amp; SCENARIO</p><h3>{{ game.scenario }}</h3></div></div><details class="phase-rule-details scenario-inline-details"><summary>Scenario rules</summary><div><p v-if="scenarioGuidance?.setupText"><strong>Set-up:</strong> {{ scenarioGuidance.setupText }}</p><p v-if="scenarioGuidance?.deploymentText"><strong>Deployment:</strong> {{ scenarioGuidance.deploymentText }}</p><p v-if="scenarioGuidance?.firstTurnText"><strong>First turn:</strong> {{ scenarioGuidance.firstTurnText }}</p><p v-for="rule in scenarioGuidance?.scenarioRules || []" :key="rule">{{ rule }}</p><img v-if="scenarioGuidance?.mapImageUrl" class="scenario-deployment-map scenario-rules-bottom-image" :src="scenarioGuidance.mapImageUrl" :alt="`${game.scenario} battle map`" loading="lazy" decoding="async" /></div></details><div v-if="battlefieldConditionRows.length" class="overview-condition-list"><article v-for="condition in battlefieldConditionRows" :key="condition.id"><strong>{{ condition.label }}</strong><RouterLink :to="`/rules/read${condition.path}`">Open rules</RouterLink></article></div></section>
          <section class="overview-composition-options card-inset"><div class="setup-section-heading"><div><p class="eyebrow">COMPOSITION OPTIONS</p><h3>Roster Battle Options</h3></div></div><div class="overview-composition-columns"><article><strong>Friendly</strong><div v-if="playerOptionLabels.length" class="match-option-chips"><span v-for="label in playerOptionLabels" :key="`overview-player-${label}`">{{ label }}</span></div><p v-else>No additional options.</p></article><article><strong>Enemy</strong><div v-if="opponentOptionLabels.length" class="match-option-chips"><span v-for="label in opponentOptionLabels" :key="`overview-opponent-${label}`">{{ label }}</span></div><p v-else>No additional options.</p></article></div></section>
          <section class="overview-magic-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">PREPARED MAGIC</p><h3>Friendly Wizards & Priests</h3></div></div><div v-if="magicCasters.length" class="overview-caster-list"><article v-for="caster in magicCasters" :key="caster.instanceId"><strong>{{ caster.name }}</strong><span>{{ caster.selectedLore || 'No lore' }}</span><small v-if="caster.kind === 'Wizard'">{{ selectedChoiceNames(caster).length ? selectedChoiceNames(caster).join(' · ') : 'Spells not recorded yet' }}</small><small v-else>Prayers available during play</small></article></div><p v-else class="setup-inline-status">No friendly Wizards or Priests detected.</p></section>
        </div>

        <div v-else-if="isDeploymentOrderStep" class="deployment-step-content"><aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — Deployment Order</strong><p>{{ deploymentTip }}</p></div></aside><section class="deployment-guidance-panel card-inset"><p class="eyebrow">SCENARIO DEPLOYMENT</p><h3>{{ game.scenario }}</h3><details class="phase-rule-details scenario-inline-details"><summary>Scenario rules &amp; deployment</summary><div><p v-if="scenarioGuidance?.setupText"><strong>Set-up:</strong> {{ scenarioGuidance.setupText }}</p><p v-if="scenarioGuidance?.deploymentText"><strong>Deployment:</strong> {{ scenarioGuidance.deploymentText }}</p><p v-else>No additional scenario-specific deployment rules are listed. Use the standard deployment procedure.</p><p><strong>First Turn:</strong> {{ firstTurnProcedureText }}</p><p v-for="rule in scenarioGuidance?.scenarioRules || []" :key="`deployment-${rule}`">{{ rule }}</p><img v-if="scenarioGuidance?.mapImageUrl" class="scenario-deployment-map scenario-rules-bottom-image" :src="scenarioGuidance.mapImageUrl" :alt="`${game.scenario} battle map`" loading="lazy" decoding="async" /></div></details></section><section class="deployment-order-panel card-inset"><p class="eyebrow">FIRST TO DEPLOY</p><h3>Who begins deployment?</h3><div class="deployment-side-actions"><button type="button" class="secondary-button" :class="{ active: game.deploymentFirstSide === 'player' }" :disabled="isReadOnly" @click="chooseDeploymentFirstSide('player')">{{ game.playerName }}</button><button type="button" class="secondary-button" :class="{ active: game.deploymentFirstSide === 'opponent' }" :disabled="isReadOnly" @click="chooseDeploymentFirstSide('opponent')">{{ game.opponentName }}</button></div></section></div>

        <div v-else-if="isDeployArmiesStep" class="deployment-step-content"><aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — Deploying Armies</strong><p>{{ deploymentTip }}</p><RouterLink to="/rules/read/overview-of-the-game">Open deployment rules</RouterLink></div></aside><p v-if="deploymentLoading" class="setup-inline-status">Reading deployment rules and legal formations for the friendly roster…</p><section class="deployment-roster-grid friendly-only-deployment-grid"><article class="deployment-roster-panel card-inset"><div class="deployment-roster-heading"><div><p class="eyebrow">FRIENDLY ROSTER</p><h3>{{ game.playerListName }}</h3></div><strong>{{ deploymentFriendlyCount }} / {{ playerRoster.length }} deployed</strong></div><article v-for="row in playerRoster" :key="row.instanceId" class="deployment-unit-row deployment-unit-guidance" :class="{ deployed: deployedPlayerIds.has(row.instanceId), reserved: reservePlayerIds.has(row.instanceId) }"><div class="deployment-unit-status-controls"><label><input type="checkbox" :checked="deployedPlayerIds.has(row.instanceId)" :disabled="isReadOnly" @change="handleDeployedUnit('player', row.instanceId, $event)" /><span>Deployed</span></label><label title="Track this unit as held in Reserve"><input type="checkbox" :checked="reservePlayerIds.has(row.instanceId)" :disabled="isReadOnly" @change="handleReserveUnit(row.instanceId, $event)" /><span>Held in Reserve</span></label></div><div class="deployment-unit-copy"><div class="deployment-unit-title"><strong>{{ row.name }}</strong><small>{{ row.modelCount }} model{{ row.modelCount === 1 ? '' : 's' }} · {{ row.totalPoints }} pts</small></div><label v-if="isCharacter(row)" class="deployment-character-join"><span>Joined unit</span><select :value="joinedHostId(row.instanceId)" :disabled="isReadOnly" @change="handleCharacterHost(row.instanceId, $event)"><option value="">Not joined</option><option v-for="host in joinableUnitRows" :key="`${row.instanceId}-join-${host.instanceId}`" :value="host.instanceId">{{ host.name }}</option></select></label><div v-if="joinedCharactersForHost(row.instanceId).length" class="joined-character-pills"><span v-for="character in joinedCharactersForHost(row.instanceId)" :key="`${row.instanceId}-joined-${character.instanceId}`">{{ character.name }}</span></div><div v-if="deploymentFor(row.instanceId)?.formations.length" class="deployment-formations"><span class="deployment-detail-label">Formation</span><RouterLink v-for="formation in deploymentFor(row.instanceId)?.formations" :key="`${row.instanceId}-${formation.label}`" :to="`/rules/read${formation.path}`">{{ formation.label }}</RouterLink></div><div v-if="deploymentFor(row.instanceId)?.deploymentRules.length" class="deployment-rule-list"><span class="deployment-detail-label">Deployment rules</span><article v-for="rule in deploymentFor(row.instanceId)?.deploymentRules" :key="`${row.instanceId}-${rule.label}`"><details class="phase-rule-details compact"><summary>{{ rule.label }}</summary><p v-if="rule.summary">{{ rule.summary }}</p></details></article></div><p v-if="deploymentFor(row.instanceId)?.canReserve" class="deployment-reserve-reason">May begin off-table / in Reserve: {{ deploymentFor(row.instanceId)?.reserveReason }}.</p></div></article></article></section></div>

        <section v-else-if="isFirstTurnStep" class="game-first-turn-window deployment-first-turn-window" aria-label="First turn result"><aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — First Turn</strong><p>{{ deploymentTip }}</p><RouterLink to="/rules/read/matched-play/choosing-scenarios">Open First Turn rules</RouterLink></div></aside><strong>Who takes the first turn?</strong><p>Resolve the scenario’s first-turn procedure after deployment, then record the result here.</p><div class="game-first-turn-actions"><button type="button" class="secondary-button" :class="{ active: game.firstPlayerConfirmed && game.firstPlayer === 'player' }" :disabled="isReadOnly" @click="chooseFirstPlayer('player')">{{ game.playerListName }}</button><button type="button" class="secondary-button" :class="{ active: game.firstPlayerConfirmed && game.firstPlayer === 'opponent' }" :disabled="isReadOnly" @click="chooseFirstPlayer('opponent')">{{ game.opponentListName || game.opponentName }}</button></div></section>

        <div v-else-if="isRoundStartStep" class="round-start-content">
          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — Start of Round</strong><p>{{ deploymentTip }}</p><RouterLink to="/rules/read/the-turn-sequence">Open Turn Sequence rules</RouterLink></div></aside>
          <p v-if="startRoundLoading" class="setup-inline-status">Checking both rosters and battle rules for Start of Round effects…</p>
          <section v-if="isRoundBattleEffectsStep" class="start-round-rule-panel battle card-inset"><div class="setup-section-heading"><div><p class="eyebrow">STEP 1 · BATTLE</p><h3>Scenario, Composition &amp; Battlefield</h3></div></div><template v-if="battleStartRoundRules.length"><details v-for="rule in battleStartRoundRules" :key="`${rule.source}-${rule.label}`" class="phase-rule-details"><summary><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span></summary><p>{{ rule.summary }}</p></details></template><p v-else class="setup-inline-status">No shared Start of Round effect needs to be resolved in this step.</p></section>
          <section v-if="isRoundPlayerEffectsStep" class="start-round-rule-columns"><article class="start-round-rule-panel friendly card-inset"><div class="setup-section-heading"><div><p class="eyebrow">STEP 2 · FRIENDLY</p><h3>Army &amp; Model Rules</h3></div></div><template v-if="friendlyStartRoundRules.length"><details v-for="rule in friendlyStartRoundRules" :key="`${rule.source}-${rule.label}`" class="phase-rule-details"><summary><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span></summary><p>{{ rule.summary }}</p></details></template><p v-else class="setup-inline-status">No friendly Start of Round action needs to be resolved.</p></article><article class="start-round-rule-panel enemy card-inset"><div class="setup-section-heading"><div><p class="eyebrow">STEP 2 · ENEMY</p><h3>Army &amp; Model Rules</h3></div></div><template v-if="enemyStartRoundRules.length"><details v-for="rule in enemyStartRoundRules" :key="`${rule.source}-${rule.label}`" class="phase-rule-details"><summary><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span></summary><p>{{ rule.summary }}</p></details></template><p v-else class="setup-inline-status">No enemy Start of Round action needs to be resolved.</p></article></section>
        </div>

        <section v-if="isBattleTurnPhase" class="turn-guidance-shell">
          <aside v-if="battleStepTip" class="game-tip-card battle-step-tip"><span class="game-tip-icon">i</span><div><strong>Tip — {{ step.label }}</strong><p>{{ battleStepTip }}</p><RouterLink :to="`/rules/read${battleStepRulePath}`">Open phase rules</RouterLink></div></aside>
          <p v-if="turnGuidanceLoading" class="setup-inline-status">Checking the friendly roster, spells, battlefield and battle rules for this {{ turnContextLabel.toLowerCase() }} step…</p>
          <template v-else>
            <article v-if="battleTurnGuidance.length" class="turn-guidance-panel battle card-inset scenario-priority-panel"><div class="setup-section-heading"><div><p class="eyebrow">BATTLE &amp; BATTLEFIELD RULES</p><h3>Scenario, Battlefield &amp; Battle Rules</h3></div></div><details v-for="(rule, battleIndex) in battleTurnGuidance" :key="`${rule.source}-${rule.label}-${rule.summary}`" class="phase-rule-details turn-rule-details" :class="{ complete: guidanceChecked(rule, battleIndex) }"><summary><label class="turn-action-check" @click.stop><input type="checkbox" :checked="guidanceChecked(rule, battleIndex)" :disabled="isReadOnly" @change="toggleGuidanceCheck(rule, battleIndex, ($event.target as HTMLInputElement).checked)" /><span aria-hidden="true"></span></label><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span></summary><p>{{ rule.summary }}</p></details></article>

            <article v-if="spellGuidance.length" class="turn-guidance-panel combat-spell-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">{{ spellPanelEyebrow }}</p><h3>{{ spellPanelTitle }}</h3><small class="optional-check-hint">The Wizard that can attempt each spell is shown first.</small></div></div><details v-for="rule in spellGuidance" :key="`${rule.source}-${rule.label}`" class="phase-rule-details"><summary><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span></summary><p>{{ rule.summary }}</p></details></article>

            <article v-if="!isDeclareChargeStep" class="turn-guidance-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">SPECIAL RULES &amp; ACTIONS</p><h3>{{ turnContextLabel }} — {{ step.label }}</h3><small class="optional-check-hint">Checks are optional and only track what you have resolved.</small></div></div>
              <template v-if="normalFriendlyGuidance.length"><article v-for="(rule, ruleIndex) in normalFriendlyGuidance" :key="`${rule.source}-${rule.label}-${rule.summary}`" class="start-round-rule-row turn-action-row" :class="{ complete: guidanceChecked(rule, battleTurnGuidance.length + spellGuidance.length + ruleIndex), 'required-charge-row': rule.requiredCharge }"><label class="turn-action-check"><input type="checkbox" :checked="guidanceChecked(rule, battleTurnGuidance.length + spellGuidance.length + ruleIndex)" :disabled="isReadOnly" @change="toggleGuidanceCheck(rule, battleTurnGuidance.length + spellGuidance.length + ruleIndex, ($event.target as HTMLInputElement).checked)" /><span aria-hidden="true"></span></label><details class="phase-rule-details turn-rule-details"><summary><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span><em v-if="rule.requiredCharge" class="required-charge-flag">MUST CHARGE IF POSSIBLE</em></summary><p>{{ rule.summary }}</p><div v-if="rule.unitRefs?.length" class="turn-rule-unit-list"><div v-for="unit in rule.unitRefs" :key="`${rule.label}-${unit.instanceId}`" class="turn-rule-unit"><strong>{{ unit.name }}</strong></div></div></details></article></template>
              <template v-if="requiredChargeRuleGuidance.length"><details v-for="rule in requiredChargeRuleGuidance" :key="`${rule.source}-${rule.label}-${rule.summary}`" class="phase-rule-details required-charge-rule-details"><summary><strong>{{ rule.source }}</strong><span>{{ rule.label }}</span></summary><p>{{ rule.summary }}</p><div v-if="rule.unitRefs?.length" class="turn-rule-unit-list"><div v-for="unit in rule.unitRefs" :key="`${rule.label}-${unit.instanceId}`" class="turn-rule-unit"><strong>{{ unit.name }}</strong></div></div></details></template>
              <p v-if="!normalFriendlyGuidance.length && !requiredChargeRuleGuidance.length" class="setup-inline-status">No relevant roster special rule or action needs to be resolved in this step.</p>
            </article>

            <article v-if="isRequiredChargeStep && requiredChargeUnits.length" class="turn-guidance-panel required-charge-test-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">REQUIRED CHARGE TEST</p><h3>Units that must test</h3></div></div><div class="required-charge-unit-grid"><div v-for="unit in requiredChargeUnits" :key="unit.instanceId" class="required-charge-test-unit"><strong>{{ unit.name }}</strong><div class="charge-test-controls" role="group" :aria-label="`${unit.name} required charge test`"><label><input type="checkbox" :checked="chargeTestResult(unit.instanceId) === 'pass'" :disabled="isReadOnly" @change="setChargeTestResult(unit.instanceId, 'pass', ($event.target as HTMLInputElement).checked)" /><span>Pass</span></label><label><input type="checkbox" :checked="chargeTestResult(unit.instanceId) === 'fail'" :disabled="isReadOnly" @change="setChargeTestResult(unit.instanceId, 'fail', ($event.target as HTMLInputElement).checked)" /><span>Fail</span></label></div></div></div></article>

            <article v-if="isDeclareChargeStep" class="turn-guidance-panel declare-charge-panel charge-sequence-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">CHARGE SEQUENCE</p><h3>Declare, roll &amp; resolve one charge at a time</h3><small class="optional-check-hint">Complete a unit's declaration and Charge Move before declaring the next charge. Joined characters travel with their unit and are not listed as separate chargers.</small></div></div><div v-if="declareChargeGuidance.length" class="declare-charge-list charge-sequence-list"><article v-for="(rule, index) in declareChargeGuidance" :key="`${rule.source}-${rule.unitRefs?.[0]?.instanceId || index}`" class="declare-charge-row charge-sequence-card" :class="{ complete: chargeResolved(rule.unitRefs?.[0]?.instanceId || ''), required: rule.requiredCharge }"><div class="charge-sequence-summary"><span class="declare-charge-copy"><strong>{{ rule.unitRefs?.[0]?.name || rule.source }}</strong><small v-if="rule.requiredCharge">MUST CHARGE IF POSSIBLE — failed Required Charge Test.</small><small v-else>Declare this charge only if the unit is eligible and you choose to charge.</small><span v-if="joinedCharactersForHost(rule.unitRefs?.[0]?.instanceId || '').length" class="joined-character-pills"><span v-for="character in joinedCharactersForHost(rule.unitRefs?.[0]?.instanceId || '')" :key="`charge-joined-${character.instanceId}`">{{ character.name }}</span></span></span><span class="declare-charge-range"><small>Max Declaration Range</small><strong>{{ rule.unitRefs?.[0]?.chargeRange || 'See profile' }}</strong><em v-if="rule.unitRefs?.[0]?.chargeRangeNote">{{ rule.unitRefs?.[0]?.chargeRangeNote }}</em></span></div><div class="charge-sequence-controls"><label><input type="checkbox" :checked="chargeDeclared(rule.unitRefs?.[0]?.instanceId || '')" :disabled="isReadOnly" @change="setChargeDeclared(rule.unitRefs?.[0]?.instanceId || '', ($event.target as HTMLInputElement).checked)" /><span>Charge declared</span></label><label><input type="checkbox" :checked="chargeResolved(rule.unitRefs?.[0]?.instanceId || '')" :disabled="isReadOnly || !chargeDeclared(rule.unitRefs?.[0]?.instanceId || '')" @change="setChargeResolved(rule.unitRefs?.[0]?.instanceId || '', ($event.target as HTMLInputElement).checked)" /><span>Charge rolled &amp; resolved</span></label></div><details v-if="rule.relatedRules?.length || joinedCharacterChargeRules(rule.unitRefs?.[0]?.instanceId || '').length" class="phase-rule-details charge-related-rules"><summary>Rules that apply while resolving this charge</summary><div><article v-for="related in [...(rule.relatedRules || []), ...joinedCharacterChargeRules(rule.unitRefs?.[0]?.instanceId || '')]" :key="`${related.label}-${related.path || ''}-${related.summary}`"><strong>{{ related.source }} — {{ related.label }}</strong><p>{{ related.summary }}</p><RouterLink v-if="related.path" :to="`/rules/read${related.path}`">Open rule</RouterLink></article></div></details></article></div><p v-else class="setup-inline-status">No friendly unit is available for a charge declaration in the current roster snapshot.</p></article>

            <article v-if="isCompulsoryMoveStep && compulsoryMovementUnits.length" class="turn-guidance-panel movement-unit-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">COMPULSORY MOVEMENT</p><h3>Units with compulsory movement</h3><small class="optional-check-hint">Mark each unit after its compulsory movement has been resolved. These units are removed from Remaining Moves for this turn.</small></div></div><div class="movement-unit-checklist"><label v-for="unit in compulsoryMovementUnits" :key="`compulsory-${unit.instanceId}`" :class="{ complete: compulsoryMoved(unit.instanceId) }"><input type="checkbox" :checked="compulsoryMoved(unit.instanceId)" :disabled="isReadOnly" @change="setCompulsoryMoved(unit.instanceId, ($event.target as HTMLInputElement).checked)" /><span><strong>{{ unit.name }}</strong><small>Compulsory move resolved</small><span v-if="joinedCharactersForHost(unit.instanceId).length" class="joined-character-pills"><span v-for="character in joinedCharactersForHost(unit.instanceId)" :key="`compulsory-joined-${character.instanceId}`">{{ character.name }}</span></span></span></label></div></article>

            <article v-if="isRemainingMoveStep" class="turn-guidance-panel movement-unit-panel remaining-move-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">REMAINING MOVES</p><h3>Units still available to move</h3><small class="optional-check-hint">Units that declared a charge, resolved compulsory movement, or remain in Reserve are excluded automatically. A joined character may leave its unit here before either model completes its Remaining Move.</small></div></div><div v-if="remainingMoveUnits.length" class="movement-unit-checklist"><article v-for="unit in remainingMoveUnits" :key="`remaining-${unit.instanceId}`" class="remaining-move-unit" :class="{ complete: remainingMoved(unit.instanceId) }"><label><input type="checkbox" :checked="remainingMoved(unit.instanceId)" :disabled="isReadOnly" @change="setRemainingMoved(unit.instanceId, ($event.target as HTMLInputElement).checked)" /><span><strong>{{ unit.name }}</strong><small>Remaining Move resolved</small></span></label><div v-if="joinedCharactersForHost(unit.instanceId).length" class="joined-character-leave-list"><span class="deployment-detail-label">Joined characters</span><div v-for="character in joinedCharactersForHost(unit.instanceId)" :key="`remaining-joined-${character.instanceId}`"><strong>{{ character.name }}</strong><button type="button" class="secondary-button" :disabled="isReadOnly || remainingMoved(unit.instanceId)" @click="leaveCharacter(character.instanceId)">Leave unit</button></div></div></article></div><p v-else class="setup-inline-status">No friendly units remain eligible for an ordinary Remaining Move.</p></article>

            <article v-if="isCombatFightStep && turnViewSide === 'player'" class="turn-guidance-panel combat-unit-panel combat-profile-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">CHOOSE &amp; FIGHT COMBAT</p><h3>Army units &amp; profiles</h3><small class="optional-check-hint">Expand a unit to see its current model profile while resolving attacks. Mark the unit when its Combat rolls are complete.</small></div></div><div class="combat-profile-list"><details v-for="unit in combatTopLevelUnits" :key="unit.instanceId" class="combat-profile-unit" :class="{ complete: combatUnitChecked(unit.instanceId) }" @toggle="handleCombatProfileToggle(unit, $event)"><summary><label class="turn-action-check" @click.stop><input type="checkbox" :checked="combatUnitChecked(unit.instanceId)" :disabled="isReadOnly" @change="toggleCombatUnit(unit.instanceId, ($event.target as HTMLInputElement).checked)" /><span aria-hidden="true"></span></label><span class="combat-profile-summary-copy"><strong>{{ unit.name }}</strong><small>{{ unit.modelCount || 1 }} model{{ (unit.modelCount || 1) === 1 ? '' : 's' }}</small><span v-if="joinedCharactersForHost(unit.instanceId).length" class="joined-character-pills"><span v-for="character in joinedCharactersForHost(unit.instanceId)" :key="`fight-joined-${character.instanceId}`">{{ character.name }}</span></span></span><span class="combat-profile-cue">Profiles</span></summary><div class="combat-profile-body"><p v-if="combatProfileLoading.has(unit.instanceId)" class="setup-inline-status">Loading current profile…</p><template v-else-if="combatProfile(unit.instanceId)"><p v-if="combatProfile(unit.instanceId)?.troopType" class="combat-profile-type">{{ combatProfile(unit.instanceId)?.troopType }}</p><div class="combat-profile-table-wrap"><table><thead><tr><th>Model</th><th v-for="column in profileColumns(combatProfile(unit.instanceId))" :key="`${unit.instanceId}-${column}`">{{ column }}</th></tr></thead><tbody><tr v-for="profileRow in combatProfile(unit.instanceId)?.rows || []" :key="`${unit.instanceId}-${profileRow.name}`"><th>{{ profileRow.name }}</th><td v-for="column in profileColumns(combatProfile(unit.instanceId))" :key="`${unit.instanceId}-${profileRow.name}-${column}`">{{ profileRow.profile[column] || '—' }}</td></tr></tbody></table></div><div v-if="combatProfile(unit.instanceId)?.equipment.length" class="combat-profile-equipment"><span class="deployment-detail-label">Selected equipment</span><span>{{ combatProfile(unit.instanceId)?.equipment.join(' · ') }}</span></div></template><p v-else-if="!combatProfileLoading.has(unit.instanceId)" class="setup-inline-status">Profile data could not be loaded for this saved unit.</p><section v-for="character in joinedCharactersForHost(unit.instanceId)" :key="`fight-profile-${character.instanceId}`" class="joined-character-profile"><h4>{{ character.name }} <small>Joined character</small></h4><p v-if="combatProfileLoading.has(character.instanceId)" class="setup-inline-status">Loading character profile…</p><template v-else-if="combatProfile(character.instanceId)"><div class="combat-profile-table-wrap"><table><thead><tr><th>Model</th><th v-for="column in profileColumns(combatProfile(character.instanceId))" :key="`${character.instanceId}-${column}`">{{ column }}</th></tr></thead><tbody><tr v-for="profileRow in combatProfile(character.instanceId)?.rows || []" :key="`${character.instanceId}-${profileRow.name}`"><th>{{ profileRow.name }}</th><td v-for="column in profileColumns(combatProfile(character.instanceId))" :key="`${character.instanceId}-${profileRow.name}-${column}`">{{ profileRow.profile[column] || '—' }}</td></tr></tbody></table></div></template></section></div></details></div></article>
            <article v-if="isCombatResultStep" class="turn-guidance-panel combat-result-tracker card-inset"><div class="setup-section-heading"><div><p class="eyebrow">CALCULATE COMBAT RESULT</p><h3>Units that fought</h3><small class="optional-check-hint">Record casualties and command-model losses for units marked as having fought. Optionally flag a unit as the combat winner or as having failed its Break Test.</small></div></div><div v-if="foughtUnits.length" class="combat-result-unit-list"><article v-for="unit in foughtUnits" :key="`combat-result-${unit.instanceId}`" class="combat-result-unit"><header><div><strong>{{ unit.name }}</strong><span v-if="joinedCharactersForHost(unit.instanceId).length" class="joined-character-pills"><span v-for="character in joinedCharactersForHost(unit.instanceId)" :key="`result-joined-${character.instanceId}`">{{ character.name }}</span></span></div><label class="destroyed-model-input"><span>Destroyed models</span><input type="number" min="0" :max="unit.modelCount || 1" :value="unitTurnState(unit.instanceId).destroyedModels || 0" :disabled="isReadOnly" @change="setDestroyedModels(unit.instanceId, $event)" /></label></header><div class="command-loss-options"><label v-if="hasCommandModel(unit, 'banner')"><input type="checkbox" :checked="unitTurnState(unit.instanceId).bannerLost" :disabled="isReadOnly" @change="setCommandLoss(unit.instanceId, 'bannerLost', ($event.target as HTMLInputElement).checked)" /><span>Banner lost</span></label><label v-if="hasCommandModel(unit, 'champion')"><input type="checkbox" :checked="unitTurnState(unit.instanceId).championLost" :disabled="isReadOnly" @change="setCommandLoss(unit.instanceId, 'championLost', ($event.target as HTMLInputElement).checked)" /><span>Champion lost</span></label><label v-if="hasCommandModel(unit, 'musician')"><input type="checkbox" :checked="unitTurnState(unit.instanceId).musicianLost" :disabled="isReadOnly" @change="setCommandLoss(unit.instanceId, 'musicianLost', ($event.target as HTMLInputElement).checked)" /><span>Musician lost</span></label></div><div v-if="joinedCharactersForHost(unit.instanceId).length" class="joined-character-casualties"><label v-for="character in joinedCharactersForHost(unit.instanceId)" :key="`character-casualty-${character.instanceId}`"><input type="checkbox" :checked="(unitTurnState(character.instanceId).destroyedModels || 0) > 0" :disabled="isReadOnly" @change="patchUnitTurnState(character.instanceId, { destroyedModels: ($event.target as HTMLInputElement).checked ? 1 : 0 })" /><span>{{ character.name }} destroyed</span></label></div><div class="combat-disposition-actions"><button type="button" class="secondary-button" :class="{ active: unitTurnState(unit.instanceId).combatDisposition === 'won' }" :disabled="isReadOnly" @click="setCombatDisposition(unit.instanceId, 'won')">Won Combat</button><button type="button" class="secondary-button" :class="{ active: unitTurnState(unit.instanceId).combatDisposition === 'failed-break' }" :disabled="isReadOnly" @click="setCombatDisposition(unit.instanceId, 'failed-break')">Failed Break Test</button></div></article></div><p v-else class="setup-inline-status">No units have been marked as having completed Combat rolls in Choose &amp; Fight Combat.</p></article>

            <article v-if="isBreakFollowStep" class="turn-guidance-panel break-follow-tracker card-inset"><div class="setup-section-heading"><div><p class="eyebrow">BREAK TESTS &amp; FOLLOW UP</p><h3>Resolve each combat before the next</h3><small class="optional-check-hint">Only units flagged as Won Combat or Failed Break Test on the previous step appear here. Record the result and the immediate follow-up or pursuit action.</small></div></div><div v-if="breakFollowUnits.length" class="break-follow-unit-list"><article v-for="unit in breakFollowUnits" :key="`break-follow-${unit.instanceId}`"><header><strong>{{ unit.name }}</strong><span class="value-chip">{{ unitTurnState(unit.instanceId).combatDisposition === 'won' ? 'WON COMBAT' : 'FAILED BREAK TEST' }}</span></header><label><span>Break / combat movement result</span><select :value="unitTurnState(unit.instanceId).breakResult || ''" :disabled="isReadOnly" @change="setBreakResult(unit.instanceId, $event)"><option value="">Not recorded</option><option v-for="result in breakResultOptions" :key="`${unit.instanceId}-${result}`" :value="result">{{ result }}</option></select></label><label><span>Follow up / pursuit</span><select :value="unitTurnState(unit.instanceId).followUpResult || ''" :disabled="isReadOnly" @change="setFollowUpResult(unit.instanceId, $event)"><option value="">Not recorded</option><option v-for="result in followUpOptions" :key="`${unit.instanceId}-follow-${result}`" :value="result">{{ result }}</option></select></label><span v-if="joinedCharactersForHost(unit.instanceId).length" class="joined-character-pills"><span v-for="character in joinedCharactersForHost(unit.instanceId)" :key="`break-joined-${character.instanceId}`">{{ character.name }}</span></span></article></div><p v-else class="setup-inline-status">No combat has been flagged for Break Test / follow-up tracking.</p></article>
          </template>
        </section>

        <section v-if="isEndScoreStep" class="end-round-score-panel card-inset" aria-label="Round score calculation"><div class="setup-section-heading"><div><p class="eyebrow">END OF ROUND · STEP 2</p><h3>Round &amp; Score Calculation</h3></div></div><p>Record the current running score after resolving this round’s scoring conditions, then choose which turn begins next or mark the round complete.</p><div class="game-score-board end-round-score-board"><div class="game-score-side"><small>{{ game.playerListName }}</small><div><button type="button" :disabled="isReadOnly" @click="adjustScore('player', -1)">−</button><strong>{{ game.playerScore }}</strong><button type="button" :disabled="isReadOnly" @click="adjustScore('player', 1)">+</button></div></div><span class="game-score-divider">—</span><div class="game-score-side"><small>{{ game.opponentListName || game.opponentName }}</small><div><button type="button" :disabled="isReadOnly" @click="adjustScore('opponent', -1)">−</button><strong>{{ game.opponentScore }}</strong><button type="button" :disabled="isReadOnly" @click="adjustScore('opponent', 1)">+</button></div></div></div></section>

        <label class="game-step-notes"><span>Step notes</span><textarea v-model="notes" :readonly="isReadOnly" rows="5" placeholder="Record targets, results, effects, or table notes for this step." @blur="saveNotes"></textarea></label>
        <div v-if="!isReadOnly && isEndScoreStep" class="game-step-actions end-round-actions"><button type="button" class="secondary-button" @click="back">‹ Back</button><button type="button" class="secondary-button" :disabled="roundsComplete" @click="startTurnFromEnd('player')">Your Turn</button><button type="button" class="secondary-button" :disabled="roundsComplete" @click="startTurnFromEnd('opponent')">Enemy's Turn</button><button type="button" class="primary-button" :disabled="roundsComplete" @click="endRoundFromEnd">End of Round</button></div>
        <div v-else-if="!isReadOnly" class="game-step-actions match-sticky-nav"><button type="button" class="secondary-button" :disabled="battleStarted && isOverviewStep" @click="back">‹ Back</button><button type="button" class="primary-button" :disabled="advanceButtonDisabled" @click="advance">{{ advanceButtonLabel }} ›</button></div>
      </section>

      <div v-if="!isReadOnly" class="game-finish-row match-lifecycle-actions"><template v-if="!battleStarted"><button type="button" class="secondary-button danger-button" @click="cancelMatch">Cancel Match</button><button type="button" class="secondary-button" @click="startOver">Start Over</button></template><template v-else><button type="button" class="secondary-button" @click="endMatchEarly('conceded')">Concede</button><button type="button" class="secondary-button" @click="endMatchEarly('enemy-yielded')">Enemy Yielded</button><button type="button" class="secondary-button" @click="endMatchEarly('draw')">Draw</button></template><button type="button" class="secondary-button match-save-button" @click="saveMatchToOngoing">Save to Ongoing</button><button v-if="roundsComplete" type="button" class="primary-button" @click="finishMatch('completed')">Complete Match</button></div>
      <div v-else class="game-finish-row match-readonly-actions"><span v-if="matchLocked && game.status === 'open'" class="match-lock-note">This open match is locked. Unlock it from Games to continue editing.</span><button type="button" class="secondary-button" @click="returnToGames">{{ game.status === 'complete' ? 'Return to Match History' : 'Return to Games' }}</button></div>

    </section>
    <section v-else class="empty-state card-surface"><div class="empty-icon">!</div><h2>Match not found</h2><p>This saved match is no longer available on this device.</p><RouterLink to="/games" class="primary-button">Back to Games</RouterLink></section>
  </main>
</template>
