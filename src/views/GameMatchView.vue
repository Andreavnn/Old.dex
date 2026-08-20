<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { compositionOptions, compositionRuleLabel } from '../data/listBuilder'
import { completeSavedGame, gameWorkflow, getSavedGame, updateSavedGame, type GameMagicCaster, type GameSide, type SavedGame } from '../services/games'
import { getSavedArmyList } from '../services/savedLists'
import { hydrateFriendlyMagicSetup, loadMagicChoices, magicSelectionLimit } from '../services/gameSetup'

const route = useRoute()
const router = useRouter()
const game = ref<SavedGame | null>(getSavedGame(String(route.params.gameId || '')))
const notes = ref('')
const magicCasters = ref<GameMagicCaster[]>([])
const magicLoading = ref(false)
const magicChoiceLoading = ref(new Set<string>())

const phase = computed(() => game.value ? gameWorkflow[Math.min(game.value.phaseIndex, gameWorkflow.length - 1)] : null)
const step = computed(() => phase.value && game.value ? phase.value.steps[Math.min(game.value.stepIndex, phase.value.steps.length - 1)] : null)
const isReadOnly = computed(() => game.value?.status === 'complete')
const isFirstTurnStep = computed(() => phase.value?.id === 'deployment' && step.value?.id === 'first-turn')
const isSetupArmiesStep = computed(() => phase.value?.id === 'setup' && step.value?.id === 'armies-battle')
const isSetupSpellsStep = computed(() => phase.value?.id === 'setup' && step.value?.id === 'spells')
const isOverviewStep = computed(() => phase.value?.id === 'overview')
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

watch(stepKey, () => { notes.value = game.value?.stepNotes?.[stepKey.value] || '' }, { immediate: true })
watch(() => step.value?.id, () => { if (isSetupSpellsStep.value) void preloadMagicChoices() })

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
  if (game.value.phaseIndex < gameWorkflow.length - 1) { persist({ phaseIndex: game.value.phaseIndex + 1, stepIndex: 0 }); return }
  const nextSide: GameSide = game.value.activeSide === 'player' ? 'opponent' : 'player'
  const nextRound = game.value.activeSide === 'opponent' ? game.value.round + 1 : game.value.round
  persist({ activeSide: nextSide, round: nextRound, phaseIndex: 1, stepIndex: 0 })
}
function back() {
  if (!game.value || !phase.value || isReadOnly.value) return
  saveNotes()
  if (game.value.stepIndex > 0) { persist({ stepIndex: game.value.stepIndex - 1 }); return }
  if (game.value.phaseIndex > 0) {
    const previous = gameWorkflow[game.value.phaseIndex - 1]
    persist({ phaseIndex: game.value.phaseIndex - 1, stepIndex: Math.max(0, previous.steps.length - 1) })
  }
}
function chooseFirstPlayer(side: GameSide) {
  if (!game.value || isReadOnly.value) return
  persist({ firstPlayer: side, firstPlayerConfirmed: true, activeSide: side })
}
function adjustScore(side: GameSide, delta: number) {
  if (!game.value || isReadOnly.value) return
  if (side === 'player') persist({ playerScore: Math.max(0, game.value.playerScore + delta) })
  else persist({ opponentScore: Math.max(0, game.value.opponentScore + delta) })
}
function finishMatch() {
  if (!game.value || isReadOnly.value) return
  saveNotes()
  const updated = completeSavedGame(game.value.id)
  if (updated) game.value = updated
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

const setupTip = computed(() => {
  if (isSetupArmiesStep.value) return 'Confirm the roster, scenario and battle-composition details before deployment. Wizard lore choices are made when the model permits a choice; changing a lore here changes this match setup only and does not rewrite the saved roster.'
  if (isSetupSpellsStep.value) return 'Generate spells before deployment. For a Wizard, roll one D6 per Wizard Level and re-roll duplicates; each result selects the matching numbered spell. One generated spell may be exchanged for the signature spell. A single Wizard cannot know the same spell twice.'
  if (isOverviewStep.value) return 'Use Overview as the at-a-glance battle dashboard. Check the matchup, scenario, score, prepared magic and current turn state here before moving into Deployment and the turn phases.'
  return ''
})

onMounted(() => { void hydrateMagicSetup() })
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

          <section class="setup-scenario-card"><span class="value-chip">SCENARIO</span><div><h3>{{ game.scenario }}</h3><p>Use the scenario selected on the Create Match screen. Scenario-specific deployment and scoring checks will be surfaced as the relevant battle steps are expanded.</p></div></section>

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
              <div v-else-if="caster.kind === 'Wizard' && caster.choices?.length" class="spell-choice-grid">
                <label v-for="choice in caster.choices" :key="choice.id" :class="{ selected: selectedMagicChoice(caster, choice.id), signature: choice.signature }">
                  <input type="checkbox" :checked="selectedMagicChoice(caster, choice.id)" :disabled="isReadOnly || casterChoiceDisabled(caster, choice.id)" @change="handleMagicChoice(caster, choice.id, $event)" />
                  <span><strong>{{ choice.name }}<small v-if="choice.signature">Signature Spell</small></strong><small v-if="choice.summary">{{ choice.summary }}</small></span>
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
          <section class="overview-status-grid">
            <article><small>Scenario</small><strong>{{ game.scenario }}</strong></article><article><small>Battle size</small><strong>{{ game.points }} pts</strong></article><article><small>Round</small><strong>{{ game.round }}</strong></article><article><small>First turn</small><strong>{{ game.firstPlayerConfirmed ? (game.firstPlayer === 'player' ? game.playerName : game.opponentName) : 'Resolve after deployment' }}</strong></article>
          </section>
          <section class="overview-matchup card-inset"><div><p class="eyebrow">FRIENDLY</p><h3>{{ game.playerName }}</h3><strong>{{ game.playerListName }}</strong><p>{{ game.playerArmyName }} · {{ playerActualPoints || game.points }}/{{ game.points }} pts</p></div><span>VS</span><div><p class="eyebrow">ENEMY</p><h3>{{ game.opponentName }}</h3><strong>{{ game.opponentListName || 'No enemy roster' }}</strong><p>{{ game.opponentArmyName || 'Opponent' }} · {{ opponentActualPoints || game.points }}/{{ game.points }} pts</p></div></section>
          <section class="overview-magic-panel card-inset"><div class="setup-section-heading"><div><p class="eyebrow">PREPARED MAGIC</p><h3>Friendly Wizards & Priests</h3></div><span>{{ magicCasters.length }}</span></div><div v-if="magicCasters.length" class="overview-caster-list"><article v-for="caster in magicCasters" :key="caster.instanceId"><strong>{{ caster.name }}</strong><span>{{ caster.selectedLore || 'No lore' }}</span><small v-if="caster.kind === 'Wizard'">{{ selectedChoiceNames(caster).length ? selectedChoiceNames(caster).join(' · ') : 'Spells not recorded yet' }}</small><small v-else>Prayers available during play</small></article></div><p v-else class="setup-inline-status">No friendly Wizards or Priests detected.</p></section>
          <section class="overview-phase-progress card-inset"><p class="eyebrow">BATTLE FLOW</p><div><span v-for="(item, index) in gameWorkflow" :key="item.id" :class="{ current: game.phaseIndex === index, complete: game.phaseIndex > index }">{{ item.label }}</span></div></section>
        </div>

        <section v-else-if="isFirstTurnStep" class="game-first-turn-window" aria-label="First turn result">
          <strong>Who takes the first turn?</strong>
          <p>Resolve the scenario’s first-turn procedure after deployment, then record the result here.</p>
          <div class="game-first-turn-actions">
            <button type="button" class="secondary-button" :class="{ active: game.firstPlayerConfirmed && game.firstPlayer === 'player' }" :disabled="isReadOnly" @click="chooseFirstPlayer('player')">{{ game.playerListName }}</button>
            <button type="button" class="secondary-button" :class="{ active: game.firstPlayerConfirmed && game.firstPlayer === 'opponent' }" :disabled="isReadOnly" @click="chooseFirstPlayer('opponent')">{{ game.opponentListName || game.opponentName }}</button>
          </div>
        </section>

        <label class="game-step-notes"><span>Step notes</span><textarea v-model="notes" :readonly="isReadOnly" rows="5" placeholder="Record targets, results, effects, or table notes for this step." @blur="saveNotes"></textarea></label>
        <div v-if="!isReadOnly" class="game-step-actions"><button type="button" class="secondary-button" @click="back">Back</button><button type="button" class="primary-button" @click="advance">Next</button></div>
      </section>

      <div v-if="!isReadOnly" class="game-finish-row"><button type="button" class="secondary-button danger-button" @click="finishMatch">Complete Match</button></div>
      <div v-else class="game-finish-row"><button type="button" class="secondary-button" @click="returnToGames">Return to Match History</button></div>
    </section>
    <section v-else class="empty-state card-surface"><div class="empty-icon">!</div><h2>Match not found</h2><p>This saved match is no longer available on this device.</p><RouterLink to="/games" class="primary-button">Back to Games</RouterLink></section>
  </main>
</template>
