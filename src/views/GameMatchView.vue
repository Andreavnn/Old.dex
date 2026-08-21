<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { compositionOptions, compositionRuleLabel } from '../data/listBuilder'
import { completeSavedGame, deleteSavedGame, gameWorkflow, getSavedGame, resetSavedGame, updateSavedGame, type GameMagicCaster, type GameOutcome, type GameSide, type SavedGame } from '../services/games'
import { getSavedArmyList } from '../services/savedLists'
import { hydrateFriendlyMagicSetup, loadFriendlyDeploymentGuidance, loadMagicChoices, loadScenarioGuidance, loadStartOfRoundGuidance, magicSelectionLimit, randomHappeningOptions, type GameDeploymentGuidance, type GameStartRoundRule } from '../services/gameSetup'

const route = useRoute()
const router = useRouter()
const game = ref<SavedGame | null>(getSavedGame(String(route.params.gameId || '')))
const notes = ref('')
const magicCasters = ref<GameMagicCaster[]>([])
const magicLoading = ref(false)
const magicChoiceLoading = ref(new Set<string>())
const scenarioLoading = ref(false)
const deploymentLoading = ref(false)
const deploymentGuidance = ref<GameDeploymentGuidance[]>([])
const startRoundLoading = ref(false)
const startRoundGuidance = ref<GameStartRoundRule[]>([])

const phase = computed(() => game.value ? gameWorkflow[Math.min(game.value.phaseIndex, gameWorkflow.length - 1)] : null)
const step = computed(() => phase.value && game.value ? phase.value.steps[Math.min(game.value.stepIndex, phase.value.steps.length - 1)] : null)
const isReadOnly = computed(() => game.value?.status === 'complete')
const isFirstTurnStep = computed(() => phase.value?.id === 'deployment' && step.value?.id === 'first-turn')
const isSetupArmiesStep = computed(() => phase.value?.id === 'setup' && step.value?.id === 'armies-battle')
const isSetupSpellsStep = computed(() => phase.value?.id === 'setup' && step.value?.id === 'spells')
const isOverviewStep = computed(() => phase.value?.id === 'overview')
const isDeploymentOrderStep = computed(() => phase.value?.id === 'deployment' && step.value?.id === 'deployment-order')
const isDeployArmiesStep = computed(() => phase.value?.id === 'deployment' && step.value?.id === 'deploy-armies')
const isRoundStartStep = computed(() => phase.value?.id === 'round-start')
const roundStartPhaseIndex = computed(() => Math.max(0, gameWorkflow.findIndex((item) => item.id === 'round-start')))
const strategyPhaseIndex = computed(() => Math.max(0, gameWorkflow.findIndex((item) => item.id === 'strategy')))
const stepKey = computed(() => game.value && phase.value && step.value ? `${game.value.round}:${game.value.activeSide}:${phase.value.id}:${step.value.id}` : '')

const playerListFallback = computed(() => game.value ? getSavedArmyList(game.value.playerListId) : null)
const opponentListFallback = computed(() => game.value?.opponentListId ? getSavedArmyList(game.value.opponentListId) : null)
const playerRoster = computed(() => game.value?.playerRoster?.length ? game.value.playerRoster : (playerListFallback.value?.roster || []))
const opponentRoster = computed(() => game.value?.opponentRoster?.length ? game.value.opponentRoster : (opponentListFallback.value?.roster || []))
const playerActualPoints = computed(() => playerRoster.value.reduce((sum, row) => sum + Number(row.totalPoints || 0), 0))
const opponentActualPoints = computed(() => opponentRoster.value.reduce((sum, row) => sum + Number(row.totalPoints || 0), 0))
const playerCompositionName = computed(() => game.value?.playerCompositionName || playerListFallback.value?.compositionName || '—')
const opponentCompositionName = computed(() => game.value?.opponentCompositionName || opponentListFallback.value?.compositionName || '—')
const playerCompositionRule = computed(() => compositionRuleLabel(game.value?.playerCompositionRule || playerListFallback.value?.rule || 'open-war'))
const opponentCompositionRule = computed(() => { const rule = game.value?.opponentCompositionRule || opponentListFallback.value?.rule || ''; return rule ? compositionRuleLabel(rule) : '—' })
const playerOptionLabels = computed(() => (game.value?.playerOptions || playerListFallback.value?.options || []).map((id) => compositionOptions.find((option) => option.value === id)?.label || id))

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

watch(stepKey, () => { notes.value = game.value?.stepNotes?.[stepKey.value] || '' }, { immediate: true })
watch(() => step.value?.id, () => { if (isSetupSpellsStep.value) void preloadMagicChoices() })
watch(() => [phase.value?.id, step.value?.id], () => {
  if (isDeployArmiesStep.value) void hydrateDeploymentGuidance()
  if (isRoundStartStep.value) void hydrateStartRoundGuidance()
})

function persist(patch: Partial<Omit<SavedGame, 'id' | 'createdAt'>> = {}) {
  if (!game.value) return
  const updated = updateSavedGame(game.value.id, patch)
  if (updated) game.value = updated
}
function saveNotes() {
  if (!game.value || isReadOnly.value || !stepKey.value) return
  persist({ stepNotes: { ...game.value.stepNotes, [stepKey.value]: notes.value } })
}
function setPhase(index: number) {
  if (!game.value || isReadOnly.value) return
  saveNotes(); persist({ phaseIndex: index, stepIndex: 0 })
}
function advance() {
  if (!game.value || !phase.value || isReadOnly.value) return
  saveNotes()
  if (game.value.stepIndex < phase.value.steps.length - 1) { persist({ stepIndex: game.value.stepIndex + 1 }); return }

  // Once a battle has started, Overview acts as a dashboard. Advancing returns
  // to the current turn sequence rather than re-entering Deployment.
  if (phase.value.id === 'overview' && battleStarted.value) {
    persist({ phaseIndex: strategyPhaseIndex.value, stepIndex: 0 })
    return
  }

  // Finishing Deployment starts Round 1 at the dedicated Start of Round phase.
  if (phase.value.id === 'deployment') {
    const firstSide = game.value.firstPlayerConfirmed ? game.value.firstPlayer : game.value.activeSide
    persist({ phaseIndex: roundStartPhaseIndex.value, stepIndex: 0, activeSide: firstSide, battleStarted: true, round: 1 })
    return
  }

  if (game.value.phaseIndex < gameWorkflow.length - 1) { persist({ phaseIndex: game.value.phaseIndex + 1, stepIndex: 0 }); return }

  // The End phase finishes one player's turn. A round is complete after the
  // player who went second has finished their End phase.
  const firstSide = game.value.firstPlayerConfirmed ? game.value.firstPlayer : 'player'
  const secondSide: GameSide = firstSide === 'player' ? 'opponent' : 'player'
  if (game.value.activeSide === firstSide) {
    persist({ activeSide: secondSide, phaseIndex: strategyPhaseIndex.value, stepIndex: 0, battleStarted: true })
    return
  }

  const completed = Math.min(roundLimit.value, game.value.roundsCompleted + 1)
  if (completed >= roundLimit.value) {
    persist({ roundsCompleted: completed, battleStarted: true })
    return
  }
  persist({ roundsCompleted: completed, round: game.value.round + 1, activeSide: firstSide, phaseIndex: roundStartPhaseIndex.value, stepIndex: 0, battleStarted: true })
}
function back() {
  if (!game.value || !phase.value || isReadOnly.value) return
  saveNotes()
  if (game.value.stepIndex > 0) { persist({ stepIndex: game.value.stepIndex - 1 }); return }
  if (game.value.phaseIndex > 0) {
    if (battleStarted.value && phase.value.id === 'strategy') { persist({ phaseIndex: roundStartPhaseIndex.value, stepIndex: 0 }); return }
    const previous = gameWorkflow[game.value.phaseIndex - 1]
    persist({ phaseIndex: game.value.phaseIndex - 1, stepIndex: Math.max(0, previous.steps.length - 1) })
  }
}
function chooseFirstPlayer(side: GameSide) {
  if (!game.value || isReadOnly.value) return
  persist({ firstPlayer: side, firstPlayerConfirmed: true, activeSide: side })
}
function chooseDeploymentFirstSide(side: GameSide) {
  if (!game.value || isReadOnly.value) return
  persist({ deploymentFirstSide: side })
}
function toggleDeployedUnit(side: GameSide, instanceId: string, checked: boolean) {
  if (!game.value || isReadOnly.value) return
  const key = side === 'player' ? 'deployedPlayerIds' : 'deployedOpponentIds'
  const current = new Set(side === 'player' ? game.value.deployedPlayerIds || [] : game.value.deployedOpponentIds || [])
  if (checked) current.add(instanceId); else current.delete(instanceId)
  if (side === 'player' && checked) {
    const reserves = new Set(game.value.reservePlayerIds || [])
    reserves.delete(instanceId)
    persist({ [key]: [...current], reservePlayerIds: [...reserves] } as Partial<SavedGame>)
    return
  }
  persist({ [key]: [...current] } as Partial<SavedGame>)
}
function handleDeployedUnit(side: GameSide, instanceId: string, event: Event) { toggleDeployedUnit(side, instanceId, Boolean((event.target as HTMLInputElement).checked)) }
function toggleReserveUnit(instanceId: string, checked: boolean) {
  if (!game.value || isReadOnly.value) return
  const current = new Set(game.value.reservePlayerIds || [])
  if (checked) current.add(instanceId); else current.delete(instanceId)
  const deployed = new Set(game.value.deployedPlayerIds || [])
  if (checked) deployed.delete(instanceId)
  persist({ reservePlayerIds: [...current], deployedPlayerIds: [...deployed] })
}
function handleReserveUnit(instanceId: string, event: Event) { toggleReserveUnit(instanceId, Boolean((event.target as HTMLInputElement).checked)) }
function setRoundLimit(value: number) {
  if (!game.value || isReadOnly.value || battleStarted.value) return
  const next = Math.max(1, Math.min(20, Math.round(Number(value) || 1)))
  persist({ roundLimit: next, roundLimitCustomized: true })
}
function handleRoundLimit(event: Event) { setRoundLimit(Number((event.target as HTMLInputElement).value)) }
function adjustScore(side: GameSide, delta: number) {
  if (!game.value || isReadOnly.value) return
  if (side === 'player') persist({ playerScore: Math.max(0, game.value.playerScore + delta) })
  else persist({ opponentScore: Math.max(0, game.value.opponentScore + delta) })
}
function finishMatch(outcome: GameOutcome = 'completed') {
  if (!game.value || isReadOnly.value) return
  if (outcome === 'completed' && !roundsComplete.value) return
  saveNotes()
  const updated = completeSavedGame(game.value.id, outcome)
  if (updated) game.value = updated
}
function cancelMatch() {
  if (!game.value || isReadOnly.value || typeof window === 'undefined') return
  if (!window.confirm('Cancel this match? The saved match and its recorded setup will be removed from this device.')) return
  const id = game.value.id
  deleteSavedGame(id)
  void router.push('/games')
}
async function startOver() {
  if (!game.value || isReadOnly.value || typeof window === 'undefined') return
  if (!window.confirm('Start this match over? Scores, round progress, notes, first-turn result and match-specific magic selections will be reset.')) return
  const updated = resetSavedGame(game.value.id)
  if (!updated) return
  game.value = updated
  magicCasters.value = []
  await hydrateMagicSetup()
}
function endMatchEarly(outcome: Exclude<GameOutcome, 'completed'>) {
  if (!game.value || isReadOnly.value || !battleStarted.value || typeof window === 'undefined') return
  const label = outcome === 'conceded' ? 'record a concession' : outcome === 'enemy-yielded' ? 'record that the enemy yielded' : 'record this match as a draw'
  if (!window.confirm(`End the match and ${label}?`)) return
  finishMatch(outcome)
}
function returnToGames() { void router.push('/games') }

function cloneMagicSetup() {
  return magicCasters.value.map((caster) => ({
    ...caster,
    availableLores: [...caster.availableLores],
    selectedSpellIds: [...caster.selectedSpellIds],
    choices: caster.choices?.map((choice) => ({ ...choice })),
  }))
}
function persistMagicSetup() { if (game.value && !isReadOnly.value) persist({ magicSetup: cloneMagicSetup() }) }
async function hydrateMagicSetup() {
  if (!game.value) return
  magicLoading.value = true
  try {
    magicCasters.value = await hydrateFriendlyMagicSetup(game.value)
    persistMagicSetup()
    if (isSetupSpellsStep.value) await preloadMagicChoices()
  } finally {
    magicLoading.value = false
  }
}
async function ensureMagicChoices(caster: GameMagicCaster) {
  if (!caster.selectedLore || caster.choices?.length) return
  const loading = new Set(magicChoiceLoading.value); loading.add(caster.instanceId); magicChoiceLoading.value = loading
  try {
    caster.choices = await loadMagicChoices(caster)
    // Drop stale selections when a lore has changed or the source list changed.
    const ids = new Set(caster.choices.map((choice) => choice.id))
    caster.selectedSpellIds = caster.selectedSpellIds.filter((id) => ids.has(id))
    persistMagicSetup()
  } finally {
    const next = new Set(magicChoiceLoading.value); next.delete(caster.instanceId); magicChoiceLoading.value = next
  }
}
async function preloadMagicChoices() { await Promise.allSettled(magicCasters.value.map((caster) => ensureMagicChoices(caster))) }
async function changeCasterLore(caster: GameMagicCaster, lore: string) {
  if (isReadOnly.value || lore === caster.selectedLore) return
  caster.selectedLore = lore
  caster.selectedSpellIds = []
  caster.choices = undefined
  persistMagicSetup()
  await ensureMagicChoices(caster)
}
function handleLoreChange(caster: GameMagicCaster, event: Event) { void changeCasterLore(caster, (event.target as HTMLSelectElement).value) }
function selectedMagicChoice(caster: GameMagicCaster, id: string) { return caster.selectedSpellIds.includes(id) }
function toggleMagicChoice(caster: GameMagicCaster, id: string, selected: boolean) {
  if (isReadOnly.value || caster.kind !== 'Wizard') return
  const next = new Set(caster.selectedSpellIds)
  if (selected) {
    if (!next.has(id) && next.size >= magicSelectionLimit(caster)) return
    next.add(id)
  } else next.delete(id)
  caster.selectedSpellIds = [...next]
  persistMagicSetup()
}
function handleMagicChoice(caster: GameMagicCaster, id: string, event: Event) { toggleMagicChoice(caster, id, Boolean((event.target as HTMLInputElement).checked)) }
function casterChoiceDisabled(caster: GameMagicCaster, id: string) { return !selectedMagicChoice(caster, id) && caster.selectedSpellIds.length >= magicSelectionLimit(caster) }
function selectedChoiceNames(caster: GameMagicCaster) {
  const selected = new Set(caster.selectedSpellIds)
  return (caster.choices || []).filter((choice) => selected.has(choice.id)).map((choice) => choice.name)
}

async function hydrateScenarioGuidance() {
  if (!game.value || game.value.scenarioGuidance) return
  scenarioLoading.value = true
  try {
    const guidance = await loadScenarioGuidance(game.value.scenario)
    persist({ scenarioGuidance: guidance, roundLimit: game.value.roundLimitCustomized ? game.value.roundLimit : guidance.roundLimit })
  } finally {
    scenarioLoading.value = false
  }
}
async function hydrateDeploymentGuidance() {
  if (!game.value || deploymentLoading.value) return
  deploymentLoading.value = true
  try { deploymentGuidance.value = await loadFriendlyDeploymentGuidance(game.value) }
  finally { deploymentLoading.value = false }
}
async function hydrateStartRoundGuidance() {
  if (!game.value || startRoundLoading.value) return
  startRoundLoading.value = true
  try { startRoundGuidance.value = await loadStartOfRoundGuidance(game.value) }
  finally { startRoundLoading.value = false }
}
function deploymentFor(instanceId: string) { return deploymentGuidanceMap.value.get(instanceId) }

function toggleBattlefieldCondition(id: string, checked: boolean) {
  if (!game.value || isReadOnly.value) return
  const next = new Set(game.value.battlefieldConditions || [])
  if (checked) next.add(id); else next.delete(id)
  persist({ battlefieldConditions: [...next] })
}
function handleBattlefieldCondition(id: string, event: Event) { toggleBattlefieldCondition(id, Boolean((event.target as HTMLInputElement).checked)) }

const setupTip = computed(() => {
  if (isSetupArmiesStep.value) return 'Confirm the roster, scenario and battle-composition details before deployment. Wizard lore choices are made when the model permits a choice; changing a lore here changes this match setup only and does not rewrite the saved roster.'
  if (isSetupSpellsStep.value) return 'Generate spells before deployment. For a Wizard, roll one D6 per Wizard Level and re-roll duplicates; each result selects the matching numbered spell. One generated spell may be exchanged for the signature spell. A single Wizard cannot know the same spell twice.'
  if (isOverviewStep.value) return 'Use Overview as the at-a-glance battle dashboard. Check the matchup, scenario, score, prepared magic and current turn state here before moving into Deployment and the turn phases.'
  return ''
})

const deploymentTip = computed(() => {
  if (isDeploymentOrderStep.value) return 'Review the scenario deployment instructions before placing models. Record which side begins deployment here; this is separate from determining which side takes the first turn.'
  if (isDeployArmiesStep.value) return 'Follow the selected scenario’s deployment instructions and alternate placing eligible units as required. For each friendly unit, choose one of its legal formations when it is deployed and resolve any deployment rules shown here. Units with rules or scenario instructions that allow them to begin off-table may be marked Reserve instead of Deployed. Resolve post-deployment rules such as Scouts or Vanguard exactly when their linked rule instructs.'
  if (isFirstTurnStep.value) return 'After deployment is complete, resolve the scenario’s first-turn procedure and record the result. The selected side becomes the active side when Round 1 begins.'
  if (isRoundStartStep.value) return 'Start of Round happens once before either player begins their turn. Resolve the friendly, enemy, scenario, battlefield and composition effects listed here before moving to the first player’s Strategy phase.'
  return ''
})
const advanceButtonLabel = computed(() => {
  if (roundsComplete.value && phase.value?.id === 'end') return 'Round limit reached'
  if (isOverviewStep.value) return 'Prepare For Battle! (Next)'
  if (phase.value?.id === 'deployment' && game.value?.stepIndex === phase.value.steps.length - 1) return 'To War! - (Start Battle)'
  if (isRoundStartStep.value) return 'Begin Round'
  return 'Next'
})
const advanceButtonDisabled = computed(() => Boolean(
  (roundsComplete.value && phase.value?.id === 'end') ||
  (phase.value?.id === 'deployment' && game.value?.stepIndex === phase.value.steps.length - 1 && !game.value?.firstPlayerConfirmed)
))

onMounted(() => { void Promise.allSettled([hydrateMagicSetup(), hydrateScenarioGuidance()]) })
</script>

<template>
  <main class="page game-match-page">
    <AppHeader compact back-to="/games" prefer-back-to />
    <section v-if="game" class="game-match-shell">
      <header class="game-match-hero card-surface">
        <div><p class="eyebrow">{{ game.status === 'complete' ? 'MATCH HISTORY' : !game.firstPlayerConfirmed ? 'TURN ORDER PENDING' : `ROUND ${game.round} · ${game.activeSide === 'player' ? 'YOUR TURN' : 'OPPONENT TURN'}` }}</p><h1>{{ game.name }}</h1><p>{{ game.scenario }} · {{ game.points }} pts</p></div>
        <div class="game-score-board"><div class="game-score-side"><small>{{ game.playerListName }}</small><div><button type="button" :disabled="isReadOnly" @click="adjustScore('player', -1)">−</button><strong>{{ game.playerScore }}</strong><button type="button" :disabled="isReadOnly" @click="adjustScore('player', 1)">+</button></div></div><span class="game-score-divider">—</span><div class="game-score-side"><small>{{ game.opponentListName || game.opponentName }}</small><div><button type="button" :disabled="isReadOnly" @click="adjustScore('opponent', -1)">−</button><strong>{{ game.opponentScore }}</strong><button type="button" :disabled="isReadOnly" @click="adjustScore('opponent', 1)">+</button></div></div></div>
      </header>

      <nav class="game-phase-tabs" aria-label="Battle phases"><button v-for="(item, index) in gameWorkflow" :key="item.id" type="button" :class="{ active: game.phaseIndex === index }" :disabled="isReadOnly" @click="setPhase(index)">{{ item.label }}</button></nav>

      <section v-if="phase && step" class="game-step-card card-surface">
        <div class="game-step-heading"><div><p class="eyebrow">{{ phase.label }}</p><h2>{{ step.label }}</h2><p>{{ step.description }}</p></div><span>{{ game.stepIndex + 1 }} / {{ phase.steps.length }}</span></div>
        <div class="game-step-list" aria-label="Current phase steps"><button v-for="(item, index) in phase.steps" :key="item.id" type="button" :class="{ active: game.stepIndex === index }" :disabled="isReadOnly" @click="saveNotes(); persist({ stepIndex: index })"><span>{{ index + 1 }}</span>{{ item.label }}</button></div>

        <div v-if="isSetupArmiesStep" class="game-setup-content">
          <section class="match-setup-summary-grid">
            <article class="match-roster-summary friendly"><p class="eyebrow">FRIENDLY GENERAL</p><h3>{{ game.playerName }}</h3><strong>{{ game.playerListName }}</strong><p>{{ game.playerArmyName }}</p><dl><div><dt>Points</dt><dd>{{ playerActualPoints || game.points }} / {{ game.points }}</dd></div><div><dt>Composition</dt><dd>{{ playerCompositionName }}</dd></div><div><dt>Battle composition</dt><dd>{{ playerCompositionRule }}</dd></div></dl><div v-if="playerOptionLabels.length" class="match-option-chips"><span v-for="label in playerOptionLabels" :key="label">{{ label }}</span></div></article>
            <article class="match-roster-summary enemy"><p class="eyebrow">ENEMY GENERAL</p><h3>{{ game.opponentName }}</h3><strong>{{ game.opponentListName || 'No enemy roster selected' }}</strong><p>{{ game.opponentArmyName || 'Opponent details only' }}</p><dl><div><dt>Points</dt><dd>{{ opponentActualPoints || game.points }} / {{ game.points }}</dd></div><div><dt>Composition</dt><dd>{{ opponentCompositionName }}</dd></div><div><dt>Battle composition</dt><dd>{{ opponentCompositionRule }}</dd></div></dl></article>
          </section>

          <section class="setup-scenario-card"><span class="value-chip">SCENARIO</span><div><h3>{{ game.scenario }}</h3><p v-if="scenarioLoading">Loading scenario guidance…</p><p v-else>{{ scenarioGuidance?.gameLength || 'Scenario-specific deployment and scoring checks will be surfaced as the relevant battle steps are expanded.' }}</p><RouterLink v-if="scenarioGuidance?.sourcePath" :to="`/rules/read${scenarioGuidance.sourcePath}`">Open scenario rules</RouterLink></div></section>

          <section class="setup-round-limit-card card-inset"><div><p class="eyebrow">GAME LENGTH</p><h3>Number of rounds</h3><p>Set how many rounds this match will last. This value carries into Overview and controls when Complete Match becomes available.</p></div><label class="round-limit-input"><span>Rounds</span><input :value="roundLimit" type="number" min="1" max="20" :readonly="isReadOnly || battleStarted" @change="handleRoundLimit" /></label></section>

          <section v-if="battleMarchEnabled" class="setup-caster-section battlefield-condition-picker">
            <div class="setup-section-heading"><div><p class="eyebrow">BATTLEFIELD</p><h3>Random Happenings</h3></div><span>{{ battlefieldConditionRows.length }}</span></div>
            <p class="setup-inline-status">Mark the Battle March random-happening tables being used for this battle. They will remain visible on Overview.</p>
            <div class="battlefield-condition-options"><label v-for="option in randomHappeningOptions" :key="option.id"><input type="checkbox" :checked="selectedBattlefieldConditions.has(option.id)" :disabled="isReadOnly" @change="handleBattlefieldCondition(option.id, $event)" /><span><strong>{{ option.label }}</strong><RouterLink :to="`/rules/read${option.path}`">Rules</RouterLink></span></label></div>
          </section>

          <section class="setup-caster-section">
            <div class="setup-section-heading"><div><p class="eyebrow">FRIENDLY MAGIC</p><h3>Wizards & Priests</h3></div><span>{{ magicCasters.length }}</span></div>
            <p v-if="magicLoading" class="setup-inline-status">Loading caster and lore options from the army source…</p>
            <p v-else-if="!magicCasters.length" class="setup-inline-status">No Wizards or Priests were detected in the friendly roster.</p>
            <div v-else class="setup-caster-grid">
              <article v-for="caster in magicCasters" :key="caster.instanceId" class="setup-caster-card">
                <div><span class="rule-kind-pill">{{ caster.kind }}<template v-if="caster.kind === 'Wizard'"> · Level {{ caster.level }}</template></span><h4>{{ caster.name }}</h4></div>
                <label v-if="caster.availableLores.length > 1" class="field-label compact-field">Lore<select class="field-control" :value="caster.selectedLore" :disabled="isReadOnly" @change="handleLoreChange(caster, $event)"><option v-for="lore in caster.availableLores" :key="lore" :value="lore">{{ lore }}</option></select></label>
                <div v-else class="caster-fixed-lore"><small>{{ caster.kind === 'Priest' ? 'Prayer lore' : 'Lore' }}</small><strong>{{ caster.selectedLore || 'Source lore unavailable' }}</strong></div>
              </article>
            </div>
          </section>

          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip</strong><p>{{ setupTip }}</p></div></aside>
        </div>

        <div v-else-if="isSetupSpellsStep" class="game-setup-content spell-setup-content">
          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — Spell Generation</strong><p>{{ setupTip }}</p><RouterLink to="/rules/read/the-lores-of-magic/spells-and-spell-generation">Open Spells & Spell Generation rules</RouterLink></div></aside>
          <p v-if="magicLoading" class="setup-inline-status">Loading friendly casters…</p>
          <p v-else-if="!magicCasters.length" class="setup-inline-status">The friendly roster contains no detected Wizards or Priests, so there are no pre-deployment magic selections to record.</p>
          <template v-else>
            <section v-for="caster in magicCasters" :key="caster.instanceId" class="spell-caster-panel">
              <div class="spell-caster-heading"><div><span class="rule-kind-pill">{{ caster.kind }}<template v-if="caster.kind === 'Wizard'"> · Level {{ caster.level }}</template></span><h3>{{ caster.name }}</h3><p>{{ caster.selectedLore || 'No lore selected' }}</p></div><strong v-if="caster.kind === 'Wizard'">{{ caster.selectedSpellIds.length }} / {{ magicSelectionLimit(caster) }} spells</strong></div>
              <p v-if="magicChoiceLoading.has(caster.instanceId)" class="setup-inline-status">Loading {{ caster.kind === 'Wizard' ? 'spells' : 'prayers' }} from the rules source…</p>
              <div v-else-if="caster.kind === 'Wizard' && caster.choices?.length" class="spell-choice-grid spell-rule-choice-grid">
                <label v-for="choice in caster.choices" :key="choice.id" class="spell-rule-choice" :class="{ selected: selectedMagicChoice(caster, choice.id), signature: choice.signature, unavailable: casterChoiceDisabled(caster, choice.id) }">
                  <input class="spell-rule-checkbox" type="checkbox" :checked="selectedMagicChoice(caster, choice.id)" :disabled="isReadOnly || casterChoiceDisabled(caster, choice.id)" @change="handleMagicChoice(caster, choice.id, $event)" />
                  <span class="spell-rule-checkmark" aria-hidden="true">{{ selectedMagicChoice(caster, choice.id) ? '✓' : '' }}</span>
                  <article class="spell-rule-card">
                    <header><span class="rule-kind-pill">Spell</span><strong>{{ choice.name }}</strong><small v-if="choice.signature">Signature Spell</small></header>
                    <p v-if="choice.summary">{{ choice.summary }}</p>
                    <footer><span>{{ caster.selectedLore }}</span><RouterLink v-if="choice.path" :to="`/rules/read${choice.path}`">Open lore rules</RouterLink></footer>
                  </article>
                </label>
              </div>
              <div v-else-if="caster.kind === 'Priest' && caster.choices?.length" class="prayer-choice-list">
                <p class="prayer-availability-note">These prayers are available to this Priest during the appropriate phase; no pre-game prayer selection is required.</p>
                <article v-for="choice in caster.choices" :key="choice.id"><strong>{{ choice.name }}</strong><p>{{ choice.summary }}</p></article>
              </div>
              <div v-else class="setup-inline-status">No {{ caster.kind === 'Wizard' ? 'spell' : 'prayer' }} list could be read for {{ caster.selectedLore || caster.name }}.</div>
            </section>
          </template>
        </div>

        <div v-else-if="isOverviewStep" class="game-overview-dashboard">
          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — Battle Overview</strong><p>{{ setupTip }}</p></div></aside>
          <section class="overview-status-grid prebattle-overview-status-grid">
            <article><small>Scenario</small><strong>{{ game.scenario }}</strong></article>
            <article><small>Battle size</small><strong>{{ game.points }} pts</strong></article>
            <article><small>Game length</small><strong>{{ roundLimit }} rounds</strong></article>
            <article><small>First turn</small><strong>{{ game.firstPlayerConfirmed ? (game.firstPlayer === 'player' ? game.playerName : game.opponentName) : 'Resolve after deployment' }}</strong></article>
          </section>
          <section class="overview-matchup card-inset"><div><p class="eyebrow">FRIENDLY</p><h3>{{ game.playerName }}</h3><strong>{{ game.playerListName }}</strong><p>{{ game.playerArmyName }} · {{ game.playerPoints || playerActualPoints || game.points }} pts</p></div><span>—</span><div><p class="eyebrow">ENEMY</p><h3>{{ game.opponentName }}</h3><strong>{{ game.opponentListName || 'No enemy roster' }}</strong><p>{{ game.opponentArmyName || 'Opponent' }} · {{ game.opponentPoints || opponentActualPoints || 0 }} pts</p></div></section>

          <section class="overview-battlefield-panel card-inset">
            <div class="setup-section-heading"><div><p class="eyebrow">BATTLEFIELD &amp; SCENARIO</p><h3>Battle Conditions</h3></div></div>
            <div v-if="scenarioGuidance?.specificTerrain" class="scenario-terrain-guidance"><strong>Scenario terrain guidance</strong><p>{{ scenarioGuidance.setupText }}</p><RouterLink :to="`/rules/read${scenarioGuidance.sourcePath}`">Open scenario rules</RouterLink></div>
            <aside v-else class="game-tip-card terrain-tip"><span class="game-tip-icon">i</span><div><strong>Tip — Battlefield Terrain</strong><p>This scenario does not call for a specific terrain layout. A varied battlefield creates more movement choices, cover, obstacles and tactical decisions for both players.</p><RouterLink to="/rules/read/battlefield-terrain">Open Battlefield Terrain rules</RouterLink></div></aside>
            <div v-if="battlefieldConditionRows.length" class="overview-condition-list"><article v-for="condition in battlefieldConditionRows" :key="condition.id"><strong>{{ condition.label }}</strong><RouterLink :to="`/rules/read${condition.path}`">Open rules</RouterLink></article></div>
            <div v-if="scenarioGuidance?.scenarioRules.length" class="scenario-special-rule-list"><strong>Scenario special rules</strong><p v-for="rule in scenarioGuidance.scenarioRules" :key="rule">{{ rule }}</p></div>
            <p v-if="scenarioGuidance?.gameLength" class="scenario-game-length"><strong>Game length:</strong> {{ scenarioGuidance.gameLength }}</p>
          </section>
          <section class="overview-magic-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">PREPARED MAGIC</p><h3>Friendly Wizards & Priests</h3></div><span>{{ magicCasters.length }}</span></div><div v-if="magicCasters.length" class="overview-caster-list"><article v-for="caster in magicCasters" :key="caster.instanceId"><strong>{{ caster.name }}</strong><span>{{ caster.selectedLore || 'No lore' }}</span><small v-if="caster.kind === 'Wizard'">{{ selectedChoiceNames(caster).length ? selectedChoiceNames(caster).join(' · ') : 'Spells not recorded yet' }}</small><small v-else>Prayers available during play</small></article></div><p v-else class="setup-inline-status">No friendly Wizards or Priests detected.</p></section>
        </div>

        <div v-else-if="isDeploymentOrderStep" class="deployment-step-content">
          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — Deployment Order</strong><p>{{ deploymentTip }}</p><RouterLink v-if="scenarioGuidance?.sourcePath" :to="`/rules/read${scenarioGuidance.sourcePath}`">Open scenario rules</RouterLink></div></aside>
          <section class="deployment-guidance-panel card-inset"><p class="eyebrow">SCENARIO DEPLOYMENT</p><h3>{{ game.scenario }}</h3><p>{{ scenarioGuidance?.setupText || 'Use the deployment instructions for the selected scenario, alternating units as required.' }}</p></section>
          <section class="deployment-order-panel card-inset"><p class="eyebrow">FIRST TO DEPLOY</p><h3>Who begins deployment?</h3><div class="deployment-side-actions"><button type="button" class="secondary-button" :class="{ active: game.deploymentFirstSide === 'player' }" :disabled="isReadOnly" @click="chooseDeploymentFirstSide('player')">{{ game.playerName }}</button><button type="button" class="secondary-button" :class="{ active: game.deploymentFirstSide === 'opponent' }" :disabled="isReadOnly" @click="chooseDeploymentFirstSide('opponent')">{{ game.opponentName }}</button></div></section>
        </div>

        <div v-else-if="isDeployArmiesStep" class="deployment-step-content">
          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — Deploying Armies</strong><p>{{ deploymentTip }}</p><RouterLink to="/rules/read/overview-of-the-game">Open deployment rules</RouterLink></div></aside>
          <p v-if="deploymentLoading" class="setup-inline-status">Reading deployment rules and legal formations for the friendly roster…</p>
          <section class="deployment-roster-grid friendly-only-deployment-grid">
            <article class="deployment-roster-panel card-inset"><div class="deployment-roster-heading"><div><p class="eyebrow">FRIENDLY ROSTER</p><h3>{{ game.playerListName }}</h3></div><strong>{{ deploymentFriendlyCount }} / {{ playerRoster.length }} deployed</strong></div>
              <article v-for="row in playerRoster" :key="row.instanceId" class="deployment-unit-row deployment-unit-guidance" :class="{ deployed: deployedPlayerIds.has(row.instanceId), reserved: reservePlayerIds.has(row.instanceId) }">
                <div class="deployment-unit-status-controls"><label><input type="checkbox" :checked="deployedPlayerIds.has(row.instanceId)" :disabled="isReadOnly" @change="handleDeployedUnit('player', row.instanceId, $event)" /><span>Deployed</span></label><label v-if="deploymentFor(row.instanceId)?.canReserve"><input type="checkbox" :checked="reservePlayerIds.has(row.instanceId)" :disabled="isReadOnly" @change="handleReserveUnit(row.instanceId, $event)" /><span>Reserve</span></label></div>
                <div class="deployment-unit-copy"><div class="deployment-unit-title"><strong>{{ row.name }}</strong><small>{{ row.modelCount }} model{{ row.modelCount === 1 ? '' : 's' }} · {{ row.totalPoints }} pts</small></div>
                  <div class="deployment-formations"><span class="deployment-detail-label">Formation</span><template v-if="deploymentFor(row.instanceId)?.formations.length"><RouterLink v-for="formation in deploymentFor(row.instanceId)?.formations" :key="`${row.instanceId}-${formation.label}`" :to="`/rules/read${formation.path}`">{{ formation.label }}</RouterLink></template><span v-else>Use the formation permitted by the unit’s troop type/rules.</span></div>
                  <div v-if="deploymentFor(row.instanceId)?.deploymentRules.length" class="deployment-rule-list"><span class="deployment-detail-label">Deployment rules</span><article v-for="rule in deploymentFor(row.instanceId)?.deploymentRules" :key="`${row.instanceId}-${rule.label}`"><RouterLink :to="`/rules/read${rule.path}`">{{ rule.label }}</RouterLink><p v-if="rule.summary">{{ rule.summary }}</p></article></div>
                  <p v-if="deploymentFor(row.instanceId)?.canReserve" class="deployment-reserve-reason">May begin off-table / in Reserve: {{ deploymentFor(row.instanceId)?.reserveReason }}.</p>
                </div>
              </article>
            </article>
          </section>
        </div>

        <section v-else-if="isFirstTurnStep" class="game-first-turn-window deployment-first-turn-window" aria-label="First turn result">
          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — First Turn</strong><p>{{ deploymentTip }}</p><RouterLink to="/rules/read/the-turn-sequence">Open First Turn rules</RouterLink></div></aside>
          <strong>Who takes the first turn?</strong>
          <p>Resolve the scenario’s first-turn procedure after deployment, then record the result here.</p>
          <div class="game-first-turn-actions">
            <button type="button" class="secondary-button" :class="{ active: game.firstPlayerConfirmed && game.firstPlayer === 'player' }" :disabled="isReadOnly" @click="chooseFirstPlayer('player')">{{ game.playerListName }}</button>
            <button type="button" class="secondary-button" :class="{ active: game.firstPlayerConfirmed && game.firstPlayer === 'opponent' }" :disabled="isReadOnly" @click="chooseFirstPlayer('opponent')">{{ game.opponentListName || game.opponentName }}</button>
          </div>
        </section>

        <div v-else-if="isRoundStartStep" class="round-start-content">
          <aside class="game-tip-card"><span class="game-tip-icon">i</span><div><strong>Tip — Start of Round</strong><p>{{ deploymentTip }}</p><RouterLink to="/rules/read/the-turn-sequence">Open Turn Sequence rules</RouterLink></div></aside>
          <section class="round-start-summary card-inset"><div><p class="eyebrow">ROUND</p><strong>{{ game.round }} / {{ roundLimit }}</strong></div><div><p class="eyebrow">FIRST PLAYER</p><strong>{{ game.firstPlayer === 'player' ? game.playerName : game.opponentName }}</strong></div><div><p class="eyebrow">BATTLE CONDITIONS</p><strong>{{ battlefieldConditionRows.length ? battlefieldConditionRows.map((row) => row.label).join(' · ') : 'No additional condition selected' }}</strong></div></section>
          <p v-if="startRoundLoading" class="setup-inline-status">Checking both rosters and battle rules for Start of Round effects…</p>
          <section class="start-round-rule-columns">
            <article class="start-round-rule-panel friendly card-inset"><div class="setup-section-heading"><div><p class="eyebrow">FRIENDLY</p><h3>Start of Round Rules</h3></div><span>{{ friendlyStartRoundRules.length }}</span></div><template v-if="friendlyStartRoundRules.length"><article v-for="rule in friendlyStartRoundRules" :key="`${rule.source}-${rule.label}`" class="start-round-rule-row"><div><strong>{{ rule.source }}</strong><RouterLink v-if="rule.path" :to="`/rules/read${rule.path}`">{{ rule.label }}</RouterLink><span v-else>{{ rule.label }}</span></div><p>{{ rule.summary }}</p></article></template><p v-else class="setup-inline-status">No friendly Start of Round rules detected.</p></article>
            <article class="start-round-rule-panel enemy card-inset"><div class="setup-section-heading"><div><p class="eyebrow">ENEMY</p><h3>Start of Round Rules</h3></div><span>{{ enemyStartRoundRules.length }}</span></div><template v-if="enemyStartRoundRules.length"><article v-for="rule in enemyStartRoundRules" :key="`${rule.source}-${rule.label}`" class="start-round-rule-row"><div><strong>{{ rule.source }}</strong><RouterLink v-if="rule.path" :to="`/rules/read${rule.path}`">{{ rule.label }}</RouterLink><span v-else>{{ rule.label }}</span></div><p>{{ rule.summary }}</p></article></template><p v-else class="setup-inline-status">No enemy Start of Round rules detected.</p></article>
          </section>
          <section v-if="battleStartRoundRules.length" class="start-round-rule-panel battle card-inset"><div class="setup-section-heading"><div><p class="eyebrow">BATTLE</p><h3>Scenario, Composition &amp; Battlefield</h3></div><span>{{ battleStartRoundRules.length }}</span></div><article v-for="rule in battleStartRoundRules" :key="`${rule.source}-${rule.label}`" class="start-round-rule-row"><div><strong>{{ rule.source }}</strong><RouterLink v-if="rule.path" :to="`/rules/read${rule.path}`">{{ rule.label }}</RouterLink><span v-else>{{ rule.label }}</span></div><p>{{ rule.summary }}</p></article></section>
        </div>

        <label class="game-step-notes"><span>Step notes</span><textarea v-model="notes" :readonly="isReadOnly" rows="5" placeholder="Record targets, results, effects, or table notes for this step." @blur="saveNotes"></textarea></label>
        <div v-if="!isReadOnly" class="game-step-actions"><button type="button" class="secondary-button" :disabled="battleStarted && isOverviewStep" @click="back">Back</button><button type="button" class="primary-button" :disabled="advanceButtonDisabled" @click="advance">{{ advanceButtonLabel }}</button></div>
      </section>

      <div v-if="!isReadOnly" class="game-finish-row match-lifecycle-actions">
        <button type="button" class="secondary-button danger-button" @click="cancelMatch">Cancel Match</button>
        <button type="button" class="secondary-button" @click="startOver">Start Over</button>
        <template v-if="battleStarted"><button type="button" class="secondary-button" @click="endMatchEarly('conceded')">Concede</button><button type="button" class="secondary-button" @click="endMatchEarly('enemy-yielded')">Enemy Yielded</button><button type="button" class="secondary-button" @click="endMatchEarly('draw')">Draw</button></template>
        <button v-if="roundsComplete" type="button" class="primary-button" @click="finishMatch('completed')">Complete Match</button>
      </div>
      <div v-else class="game-finish-row"><button type="button" class="secondary-button" @click="returnToGames">Return to Match History</button></div>
    </section>
    <section v-else class="empty-state card-surface"><div class="empty-icon">!</div><h2>Match not found</h2><p>This saved match is no longer available on this device.</p><RouterLink to="/games" class="primary-button">Back to Games</RouterLink></section>
  </main>
</template>
