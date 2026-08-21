<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { compositionOptionDescription, compositionOptions, compositionRuleLabel } from '../data/listBuilder'
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
const playerName = ref('')
const opponentName = ref('')
const scenario = ref('Open Battle')

const scenarioOptions = [
  { name: 'Open Battle', description: 'A standard battle without an additional scenario-specific deployment or victory condition.' },
  { name: 'Meeting Engagement', description: 'Units may be held in reserve before deployment. Reserve handling is resolved during battle setup and deployment.' },
  { name: 'Flank Attack', description: 'Each army may prepare a flanking force. Record the selected flank and force during battle setup.' },
  { name: 'Command & Control', description: 'A central special feature becomes an additional objective and can award bonus victory points.' },
  { name: 'Mountain Pass', description: 'The long battlefield edges are impassable, creating a narrow battlefield with restricted entry and escape.' },
  { name: 'Break Point', description: 'Army strength is checked against a Break Point during the battle. Old.dex will surface the required battle checks in the match workflow.' },
]

const friendlyLists = computed(() => lists.value.filter((list) => !list.enemyRoster))
const enemyLists = computed(() => lists.value.filter((list) => list.enemyRoster))
const playerList = computed(() => lists.value.find((list) => list.id === playerListId.value) || null)
const opponentList = computed(() => lists.value.find((list) => list.id === opponentListId.value) || null)
const selectedScenario = computed(() => scenarioOptions.find((option) => option.name === scenario.value) || scenarioOptions[0])
function rosterActualPoints(list: SavedArmyList | null) {
  if (!list) return 0
  const saved = Number(list.actualPoints || 0)
  if (saved > 0) return saved
  return (list.roster || []).reduce((sum, row) => sum + Math.max(0, Number(row.totalPoints || 0)), 0)
}
const matchRosterIssues = computed(() => {
  const issues: Array<{ severity: 'error' | 'warning'; message: string }> = []
  const inspect = (list: SavedArmyList | null, label: string) => {
    if (!list) return
    if (list.validationStatus === 'invalid') issues.push({ severity: 'error', message: `${label} roster is currently invalid. Open the roster to review its validation errors before the match.` })
    else if (list.validationStatus === 'warning') issues.push({ severity: 'warning', message: `${label} roster currently has a validation warning.` })
    const actual = rosterActualPoints(list)
    if (actual > Number(list.points || 0) && !list.options?.includes('over-under')) issues.push({ severity: 'error', message: `${label} roster is ${actual - Number(list.points || 0)} points over its ${list.points}-point allowance.` })
  }
  inspect(playerList.value, 'Friendly')
  inspect(opponentList.value, 'Enemy')
  if (playerList.value && opponentList.value && Number(playerList.value.points || 0) !== Number(opponentList.value.points || 0)) {
    issues.push({ severity: 'error', message: `Roster point allowances do not match: Friendly ${playerList.value.points} pts — Enemy ${opponentList.value.points} pts.` })
  }
  return issues
})
const canCreate = computed(() => Boolean(playerList.value))
const friendlyCompositionOptions = computed(() => {
  const list = playerList.value
  if (!list) return []
  return (list.options || []).map((id) => {
    const option = compositionOptions.find((candidate) => candidate.value === id)
    return { id, label: option?.label || id, description: option ? compositionOptionDescription(option.value) : '' }
  })
})

function rosterGeneralName(list: SavedArmyList | null) {
  const general = (list?.roster || []).find((row) => (row.options || []).some((value) => /^General$/i.test(String(value).replace(/\s*[×x]\d+\s*$/, '').trim())))
  return general?.name || ''
}
function friendlyNamePlaceholder() { return rosterGeneralName(playerList.value) || 'Friendly General' }
function enemyNamePlaceholder() { return rosterGeneralName(opponentList.value) || 'Enemy General' }

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
  const game = createSavedGame({
    playerList: playerList.value,
    opponentList: opponentList.value,
    playerName: playerName.value || friendlyNamePlaceholder(),
    opponentName: opponentName.value || enemyNamePlaceholder(),
    scenario: scenario.value,
  })
  void router.push(`/games/${game.id}`)
}
</script>

<template>
  <main class="page game-create-page">
    <AppHeader compact back-to="/games" prefer-back-to />
    <div class="page-title-block">
      <p class="eyebrow">NEW MATCH</p>
      <h1>Start New Match</h1>
      <p>Choose the friendly and enemy generals, select or import their rosters, and then choose the battle scenario.</p>
    </div>

    <section class="form-card game-create-form">
      <section class="game-roster-card general-roster-card">
        <div class="general-panel-heading"><span><strong>Friendly General</strong><small>Select an Old.dex roster or import a JSON roster in the same panel.</small></span></div>
        <label class="field-label">Friendly general name<input v-model="playerName" class="field-control" maxlength="80" :placeholder="friendlyNamePlaceholder()" /></label>
        <div class="game-roster-source-controls">
          <label class="field-label roster-select-field">Select roster from list
            <select v-model="playerListId" class="field-control" required>
              <option value="" disabled>Select roster from list</option>
              <optgroup v-if="friendlyLists.length" label="Army Rosters">
                <option v-for="list in friendlyLists" :key="list.id" :value="list.id">{{ list.name }} — {{ list.armyName }} — {{ list.points }} pts</option>
              </optgroup>
              <optgroup v-if="enemyLists.length" label="Enemy Army Rosters">
                <option v-for="list in enemyLists" :key="list.id" :value="list.id">{{ list.name }} — {{ list.armyName }} — {{ list.points }} pts</option>
              </optgroup>
            </select>
          </label>
          <button type="button" class="secondary-button roster-import-button" @click="playerImportInput?.click()">Import roster</button>
          <input ref="playerImportInput" class="file-import-input" type="file" accept=".json,.owb.json,.owb.lists.json,application/json" @change="importRoster($event, 'player')" />
        </div>
        <p v-if="playerImportMessage" class="list-import-message" role="status">{{ playerImportMessage }}</p>
      </section>

      <section class="game-roster-card general-roster-card">
        <div class="general-panel-heading"><span><strong>Enemy General</strong><small>Select an enemy roster, another saved roster, or import a JSON roster.</small></span></div>
        <label class="field-label">Enemy general name<input v-model="opponentName" class="field-control" maxlength="80" :placeholder="enemyNamePlaceholder()" /></label>
        <div class="game-roster-source-controls">
          <label class="field-label roster-select-field">Select roster from list
            <select v-model="opponentListId" class="field-control">
              <option value="">Select roster from list</option>
              <optgroup v-if="enemyLists.length" label="Enemy Army Rosters">
                <option v-for="list in enemyLists.filter((candidate) => candidate.id !== playerListId)" :key="list.id" :value="list.id">{{ list.name }} — {{ list.armyName }} — {{ list.points }} pts</option>
              </optgroup>
              <optgroup v-if="friendlyLists.length" label="Army Rosters">
                <option v-for="list in friendlyLists.filter((candidate) => candidate.id !== playerListId)" :key="list.id" :value="list.id">{{ list.name }} — {{ list.armyName }} — {{ list.points }} pts</option>
              </optgroup>
            </select>
          </label>
          <button type="button" class="secondary-button roster-import-button" @click="opponentImportInput?.click()">Import roster</button>
          <input ref="opponentImportInput" class="file-import-input" type="file" accept=".json,.owb.json,.owb.lists.json,application/json" @change="importRoster($event, 'opponent')" />
        </div>
        <p v-if="opponentImportMessage" class="list-import-message" role="status">{{ opponentImportMessage }}</p>
      </section>

      <label class="field-label">Scenario<select v-model="scenario" class="field-control"><option v-for="option in scenarioOptions" :key="option.name" :value="option.name">{{ option.name }}</option></select></label>
      <aside class="scenario-info-window" aria-live="polite"><span class="value-chip">SCENARIO</span><div><strong>{{ selectedScenario.name }}</strong><p>{{ selectedScenario.description }}</p></div></aside>

      <aside v-if="playerList" class="battle-composition-window" aria-label="Friendly roster battle composition">
        <span class="value-chip">BATTLE COMPOSITION</span>
        <div class="battle-composition-copy">
          <strong>{{ playerList.compositionName }} · {{ compositionRuleLabel(playerList.rule) }}</strong>
          <p v-if="friendlyCompositionOptions.length">The friendly roster has the following battle composition options enabled.</p>
          <p v-else>No additional battle composition options are enabled for this friendly roster.</p>
          <ul v-if="friendlyCompositionOptions.length" class="battle-composition-option-list">
            <li v-for="option in friendlyCompositionOptions" :key="option.id"><strong>{{ option.label }}</strong><span v-if="option.description">{{ option.description }}</span></li>
          </ul>
        </div>
      </aside>

      <aside v-if="matchRosterIssues.length" class="match-roster-issue-panel" aria-live="polite" aria-label="Roster issues"><span class="value-chip">ROSTER CHECK</span><div><strong>Resolve or acknowledge these match setup issues</strong><ul><li v-for="(issue, index) in matchRosterIssues" :key="`${issue.message}-${index}`" :class="`severity-${issue.severity}`">{{ issue.message }}</li></ul></div></aside>

      <div class="game-create-actions">
        <button type="button" class="primary-button" :disabled="!canCreate" @click="createMatch">Create Match</button>
        <RouterLink to="/games" class="secondary-button game-create-cancel">Cancel</RouterLink>
      </div>
    </section>
  </main>
</template>
