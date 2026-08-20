<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { completeSavedGame, gameWorkflow, getSavedGame, updateSavedGame, type GameSide, type SavedGame } from '../services/games'

const route = useRoute()
const router = useRouter()
const game = ref<SavedGame | null>(getSavedGame(String(route.params.gameId || '')))
const notes = ref('')
const phase = computed(() => game.value ? gameWorkflow[Math.min(game.value.phaseIndex, gameWorkflow.length - 1)] : null)
const step = computed(() => phase.value && game.value ? phase.value.steps[Math.min(game.value.stepIndex, phase.value.steps.length - 1)] : null)
const isReadOnly = computed(() => game.value?.status === 'complete')
const isFirstTurnStep = computed(() => phase.value?.id === 'deployment' && step.value?.id === 'first-turn')
const stepKey = computed(() => game.value && phase.value && step.value ? `${game.value.round}:${game.value.activeSide}:${phase.value.id}:${step.value.id}` : '')

watch(stepKey, () => { notes.value = game.value?.stepNotes?.[stepKey.value] || '' }, { immediate: true })

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
        <section v-if="isFirstTurnStep" class="game-first-turn-window" aria-label="First turn result">
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
