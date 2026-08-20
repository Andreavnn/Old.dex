<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { createSavedGame, type GameSide } from '../services/games'
import { getSavedArmyLists } from '../services/savedLists'

const router = useRouter()
const lists = getSavedArmyLists()
const playerListId = ref(lists[0]?.id || '')
const opponentListId = ref('')
const opponentName = ref('Opponent')
const scenario = ref('Open Battle')
const firstPlayer = ref<GameSide>('player')

const playerList = computed(() => lists.find((list) => list.id === playerListId.value) || null)
const opponentList = computed(() => lists.find((list) => list.id === opponentListId.value) || null)
const canCreate = computed(() => Boolean(playerList.value))

function createMatch() {
  if (!playerList.value) return
  const game = createSavedGame({ playerList: playerList.value, opponentList: opponentList.value, opponentName: opponentName.value, scenario: scenario.value, firstPlayer: firstPlayer.value })
  void router.push(`/games/${game.id}`)
}
</script>

<template>
  <main class="page game-create-page">
    <AppHeader compact back-to="/games" prefer-back-to />
    <div class="page-title-block">
      <p class="eyebrow">NEW MATCH</p>
      <h1>Start New Match</h1>
      <p>Match creation now uses saved Old.dex army lists as the player-side source. More scenario-specific setup will be connected as the Games workflow expands.</p>
    </div>

    <section v-if="lists.length" class="form-card game-create-form">
      <label class="field-label">Your army list<select v-model="playerListId" class="field-control"><option v-for="list in lists" :key="list.id" :value="list.id">{{ list.name }} — {{ list.armyName }} — {{ list.points }} pts</option></select></label>
      <label class="field-label">Opponent saved list <select v-model="opponentListId" class="field-control"><option value="">No saved opponent list</option><option v-for="list in lists.filter((candidate) => candidate.id !== playerListId)" :key="list.id" :value="list.id">{{ list.name }} — {{ list.armyName }} — {{ list.points }} pts</option></select></label>
      <label v-if="!opponentList" class="field-label">Opponent name<input v-model="opponentName" class="field-control" maxlength="80" /></label>
      <label class="field-label">Scenario<select v-model="scenario" class="field-control"><option>Open Battle</option><option>Meeting Engagement</option><option>Flank Attack</option><option>Command &amp; Control</option><option>Mountain Pass</option><option>Break Point</option></select></label>
      <fieldset class="game-first-player"><legend>First player</legend><label><input v-model="firstPlayer" value="player" type="radio" /> {{ playerList?.name || 'Your army' }}</label><label><input v-model="firstPlayer" value="opponent" type="radio" /> {{ opponentList?.name || opponentName || 'Opponent' }}</label></fieldset>
      <RouterLink to="/games" class="secondary-button game-create-cancel">Cancel</RouterLink>
      <button type="button" class="primary-button" :disabled="!canCreate" @click="createMatch">Create Match</button>
    </section>

    <section v-else class="empty-state card-surface">
      <div class="empty-icon">≡</div><h2>Create an army list first</h2><p>Games start from a saved Old.dex army list.</p><RouterLink to="/lists/create" class="primary-button">Create a list</RouterLink>
    </section>
  </main>
</template>
