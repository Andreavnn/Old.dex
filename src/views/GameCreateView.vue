<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { createSavedGame } from '../services/games'
import { getSavedArmyLists, importSavedArmyListJson, type SavedArmyList } from '../services/savedLists'

const router = useRouter()
const lists = ref<SavedArmyList[]>(getSavedArmyLists())
const playerImportInput = ref<HTMLInputElement | null>(null)
const opponentImportInput = ref<HTMLInputElement | null>(null)
const playerImportMessage = ref('')
const opponentImportMessage = ref('')
const playerListId = ref('')
const opponentListId = ref('')
const opponentName = ref('Opponent')
const scenario = ref('Open Battle')

const scenarioOptions = [
  { name: 'Open Battle', description: 'A standard battle without an additional scenario-specific deployment or victory condition.' },
  { name: 'Meeting Engagement', description: 'Units may be held in reserve before deployment. Reserve handling is resolved during battle setup and deployment.' },
  { name: 'Flank Attack', description: 'Each army may prepare a flanking force. Record the selected flank and force during battle setup.' },
  { name: 'Command & Control', description: 'A central special feature becomes an additional objective and can award bonus victory points.' },
  { name: 'Mountain Pass', description: 'The long battlefield edges are impassable, creating a narrow battlefield with restricted entry and escape.' },
  { name: 'Break Point', description: 'Army strength is checked against a Break Point during the battle. Old.dex will surface the required battle checks in the match workflow.' },
]

const playerList = computed(() => lists.value.find((list) => list.id === playerListId.value) || null)
const opponentList = computed(() => lists.value.find((list) => list.id === opponentListId.value) || null)
const selectedScenario = computed(() => scenarioOptions.find((option) => option.name === scenario.value) || scenarioOptions[0])
const canCreate = computed(() => Boolean(playerList.value))

function refreshLists(side: 'player' | 'opponent', preferredId = '') {
  lists.value = getSavedArmyLists()
  if (preferredId && lists.value.some((list) => list.id === preferredId)) {
    if (side === 'player') playerListId.value = preferredId
    else opponentListId.value = preferredId
  }
  if (playerListId.value && !lists.value.some((list) => list.id === playerListId.value)) playerListId.value = ''
  if (opponentListId.value && !lists.value.some((list) => list.id === opponentListId.value)) opponentListId.value = ''
}
async function importRoster(event: Event, side: 'player' | 'opponent') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (side === 'player') playerImportMessage.value = ''
  else opponentImportMessage.value = ''
  try {
    const imported = importSavedArmyListJson(await file.text())
    refreshLists(side, imported[0]?.id || '')
    const message = `${imported.length} roster${imported.length === 1 ? '' : 's'} imported and ready to use.`
    if (side === 'player') playerImportMessage.value = message
    else opponentImportMessage.value = message
  } catch (error) {
    const message = error instanceof Error ? error.message : 'This army-roster JSON could not be imported.'
    if (side === 'player') playerImportMessage.value = message
    else opponentImportMessage.value = message
  } finally {
    input.value = ''
  }
}
function createMatch() {
  if (!playerList.value) return
  const game = createSavedGame({ playerList: playerList.value, opponentList: opponentList.value, opponentName: opponentName.value, scenario: scenario.value })
  void router.push(`/games/${game.id}`)
}
</script>

<template>
  <main class="page game-create-page">
    <AppHeader compact back-to="/games" prefer-back-to />
    <div class="page-title-block">
      <p class="eyebrow">NEW MATCH</p>
      <h1>Start New Match</h1>
      <p>Select saved army rosters or import JSON rosters for both sides, then choose the scenario. First turn is resolved later in the battle workflow.</p>
    </div>

    <section class="form-card game-create-form">
      <section class="game-roster-card">
        <div class="game-roster-source-row">
          <span><strong>Your Army Roster</strong><small>Use a roster already saved in Old.dex or import one.</small></span>
          <button type="button" class="secondary-button" @click="playerImportInput?.click()">Import roster</button>
          <input ref="playerImportInput" class="file-import-input" type="file" accept=".json,.owb.json,.owb.lists.json,application/json" @change="importRoster($event, 'player')" />
        </div>
        <label class="field-label">Select roster from list
          <select v-model="playerListId" class="field-control" required>
            <option value="" disabled>Select roster from list</option>
            <option v-for="list in lists" :key="list.id" :value="list.id">{{ list.name }} — {{ list.armyName }} — {{ list.points }} pts</option>
          </select>
        </label>
        <p v-if="playerImportMessage" class="list-import-message" role="status">{{ playerImportMessage }}</p>
      </section>

      <section class="game-roster-card">
        <div class="game-roster-source-row">
          <span><strong>Opponent Army Roster</strong><small>Select a saved opponent roster or import one.</small></span>
          <button type="button" class="secondary-button" @click="opponentImportInput?.click()">Import roster</button>
          <input ref="opponentImportInput" class="file-import-input" type="file" accept=".json,.owb.json,.owb.lists.json,application/json" @change="importRoster($event, 'opponent')" />
        </div>
        <label class="field-label">Select roster from list
          <select v-model="opponentListId" class="field-control">
            <option value="">Select roster from list</option>
            <option v-for="list in lists.filter((candidate) => candidate.id !== playerListId)" :key="list.id" :value="list.id">{{ list.name }} — {{ list.armyName }} — {{ list.points }} pts</option>
          </select>
        </label>
        <label v-if="!opponentList" class="field-label">Opponent name<input v-model="opponentName" class="field-control" maxlength="80" /></label>
        <p v-if="opponentImportMessage" class="list-import-message" role="status">{{ opponentImportMessage }}</p>
      </section>

      <label class="field-label">Scenario<select v-model="scenario" class="field-control"><option v-for="option in scenarioOptions" :key="option.name" :value="option.name">{{ option.name }}</option></select></label>
      <aside class="scenario-info-window" aria-live="polite"><span class="value-chip">SCENARIO</span><div><strong>{{ selectedScenario.name }}</strong><p>{{ selectedScenario.description }}</p></div></aside>

      <div class="game-create-actions">
        <RouterLink to="/games" class="secondary-button game-create-cancel">Cancel</RouterLink>
        <button type="button" class="primary-button" :disabled="!canCreate" @click="createMatch">Create Match</button>
      </div>
    </section>
  </main>
</template>
