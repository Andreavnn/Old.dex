<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { createSavedGame, type GameSide } from '../services/games'
import { getSavedArmyLists, importSavedArmyListJson, type SavedArmyList } from '../services/savedLists'

const router = useRouter()
const lists = ref<SavedArmyList[]>(getSavedArmyLists())
const importInput = ref<HTMLInputElement | null>(null)
const importMessage = ref('')
const playerListId = ref(lists.value[0]?.id || '')
const opponentListId = ref('')
const opponentName = ref('Opponent')
const scenario = ref('Open Battle')
const firstPlayer = ref<GameSide>('player')

const playerList = computed(() => lists.value.find((list) => list.id === playerListId.value) || null)
const opponentList = computed(() => lists.value.find((list) => list.id === opponentListId.value) || null)
const canCreate = computed(() => Boolean(playerList.value))

function refreshLists(preferredId = '') {
  lists.value = getSavedArmyLists()
  if (preferredId && lists.value.some((list) => list.id === preferredId)) playerListId.value = preferredId
  else if (!lists.value.some((list) => list.id === playerListId.value)) playerListId.value = lists.value[0]?.id || ''
}
async function importRoster(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importMessage.value = ''
  try {
    const imported = importSavedArmyListJson(await file.text())
    refreshLists(imported[0]?.id || '')
    importMessage.value = `${imported.length} roster${imported.length === 1 ? '' : 's'} imported and ready to use.`
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : 'This army-list JSON could not be imported.'
  } finally {
    input.value = ''
  }
}
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
      <p>Select one of your saved Army Lists or import a JSON roster, then choose the opponent and scenario.</p>
    </div>

    <section class="form-card game-create-form">
      <div class="game-roster-source-row">
        <strong>Your roster</strong>
        <button type="button" class="secondary-button" @click="importInput?.click()">Import JSON roster</button>
        <input ref="importInput" class="file-import-input" type="file" accept=".json,.owb.json,.owb.lists.json,application/json" @change="importRoster" />
      </div>
      <p v-if="importMessage" class="list-import-message" role="status">{{ importMessage }}</p>

      <label v-if="lists.length" class="field-label">Your army list<select v-model="playerListId" class="field-control"><option v-for="list in lists" :key="list.id" :value="list.id">{{ list.name }} — {{ list.armyName }} — {{ list.points }} pts</option></select></label>
      <div v-else class="inline-empty-note">No saved roster yet. Import a JSON army list above or create one in Army Lists.</div>
      <label v-if="lists.length" class="field-label">Opponent saved list <select v-model="opponentListId" class="field-control"><option value="">No saved opponent list</option><option v-for="list in lists.filter((candidate) => candidate.id !== playerListId)" :key="list.id" :value="list.id">{{ list.name }} — {{ list.armyName }} — {{ list.points }} pts</option></select></label>
      <label v-if="!opponentList" class="field-label">Opponent name<input v-model="opponentName" class="field-control" maxlength="80" /></label>
      <label class="field-label">Scenario<select v-model="scenario" class="field-control"><option>Open Battle</option><option>Meeting Engagement</option><option>Flank Attack</option><option>Command &amp; Control</option><option>Mountain Pass</option><option>Break Point</option></select></label>
      <fieldset class="game-first-player"><legend>First player</legend><label><input v-model="firstPlayer" value="player" type="radio" /> {{ playerList?.name || 'Your army' }}</label><label><input v-model="firstPlayer" value="opponent" type="radio" /> {{ opponentList?.name || opponentName || 'Opponent' }}</label></fieldset>
      <RouterLink to="/games" class="secondary-button game-create-cancel">Cancel</RouterLink>
      <button type="button" class="primary-button" :disabled="!canCreate" @click="createMatch">Create Match</button>
    </section>
  </main>
</template>
